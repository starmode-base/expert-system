import { and, eq, gte, lt, inArray, sql } from "drizzle-orm";
import { db, schema } from "~/postgres/db";
import { inngest } from "../client";
import { fetchEarningsCalendar } from "~/lib/earnings-calendar";

interface TrackedCompanyWithSymbol {
  userId: string;
  symbol: string;
}

/**
 * Sync earnings calendar from Alpha Vantage.
 * Runs weekly at 6 AM Phoenix time.
 * - Fetches 3-month earnings calendar
 * - Upserts into earningsSchedule table
 * - Creates earningsFetchJobs for tracked companies reporting tomorrow
 */
export const syncEarningsCalendar = inngest.createFunction(
  { id: "scheduler.sync-earnings-calendar" },
  { cron: "TZ=America/Phoenix 0 6 * * 0" }, // Weekly on Sundays at 6 AM
  // { event: "scheduler/sync-earnings-calendar" },
  async ({ step }) => {
    // Step 1: Fetch earnings calendar from Alpha Vantage
    const calendarEntries = await step.run(
      "fetch-earnings-calendar",
      async () => {
        const entries = await fetchEarningsCalendar("3month");
        console.log(`Fetched ${entries.length} earnings calendar entries`);
        // Serialize dates for step return
        // Only return entries where normalized symbol and name are not the same
        const filteredEntries = entries
          .filter(
            (e) =>
              e.symbol.trim().toLowerCase() !== e.name.trim().toLowerCase(),
          )
          .map((e) => ({
            ...e,
            reportDate: e.reportDate.toISOString(),
          }));

        console.log("filteredEntries length: ", filteredEntries.length);
        return filteredEntries;
      },
    );

    if (calendarEntries.length === 0) {
      console.log("No earnings calendar entries found");
      return { synced: 0, jobsCreated: 0 };
    }

    // Step 2: Upsert earnings schedule entries
    const upsertedCount = await step.run(
      "upsert-earnings-schedule",
      async () => {
        // Deduplicate entries by (symbol, fiscalDateEnding) - keep the last occurrence
        const uniqueEntriesMap = new Map<string, (typeof calendarEntries)[0]>();
        for (const entry of calendarEntries) {
          const key = `${entry.symbol}|${entry.fiscalDateEnding}`;
          uniqueEntriesMap.set(key, entry);
        }
        const uniqueEntries = Array.from(uniqueEntriesMap.values());

        console.log(
          `Deduped ${calendarEntries.length} entries to ${uniqueEntries.length}`,
        );

        // Process in batches using bulk upsert
        const batchSize = 500;
        for (let i = 0; i < uniqueEntries.length; i += batchSize) {
          const batch = uniqueEntries.slice(i, i + batchSize);

          const values = batch.map((entry) => ({
            symbol: entry.symbol,
            name: entry.name,
            reportDate: new Date(entry.reportDate),
            fiscalDateEnding: entry.fiscalDateEnding,
            estimate: entry.estimate,
            currency: entry.currency,
          }));

          await db
            .insert(schema.earningsSchedule)
            .values(values)
            .onConflictDoUpdate({
              target: [
                schema.earningsSchedule.symbol,
                schema.earningsSchedule.fiscalDateEnding,
              ],
              set: {
                name: sql`excluded.name`,
                reportDate: sql`excluded.report_date`,
                estimate: sql`excluded.estimate`,
                currency: sql`excluded.currency`,
              },
            });
        }

        return uniqueEntries.length;
      },
    );

    // Step 3: Create fetch jobs for tracked companies reporting tomorrow
    const jobsCreated = await step.run("create-fetch-jobs", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

      // Get all tracked companies with their stock symbols
      const trackedCompaniesRaw = await db.query.trackedCompanies.findMany({
        with: {
          stockSymbol: true,
        },
      });

      if (trackedCompaniesRaw.length === 0) {
        console.log("No tracked companies found");
        return 0;
      }

      // Map to simpler structure
      const trackedCompanies: TrackedCompanyWithSymbol[] =
        trackedCompaniesRaw.map((tc) => ({
          userId: tc.userId,
          symbol: tc.stockSymbol.symbol,
        }));

      // Get symbols of tracked companies
      const trackedSymbols = trackedCompanies.map((tc) => tc.symbol);

      // Find earnings scheduled for tomorrow for tracked symbols
      const earningsForTomorrow = await db.query.earningsSchedule.findMany({
        where: and(
          gte(schema.earningsSchedule.reportDate, tomorrow),
          lt(schema.earningsSchedule.reportDate, dayAfterTomorrow),
          inArray(schema.earningsSchedule.symbol, trackedSymbols),
        ),
      });

      if (earningsForTomorrow.length === 0) {
        console.log("No tracked earnings scheduled for tomorrow");
        return 0;
      }

      // Create fetch jobs for each user tracking these companies
      let jobCount = 0;
      for (const earnings of earningsForTomorrow) {
        // Find users tracking this symbol
        const usersTracking = trackedCompanies.filter(
          (tc) => tc.symbol === earnings.symbol,
        );

        for (const tracked of usersTracking) {
          // Check if job already exists
          const existingJob = await db.query.earningsFetchJobs.findFirst({
            where: and(
              eq(schema.earningsFetchJobs.userId, tracked.userId),
              eq(schema.earningsFetchJobs.earningsScheduleId, earnings.id),
            ),
          });

          if (!existingJob) {
            await db.insert(schema.earningsFetchJobs).values({
              userId: tracked.userId,
              earningsScheduleId: earnings.id,
              status: "pending",
            });
            jobCount++;
          }
        }
      }

      console.log(`Created ${jobCount} fetch jobs for tomorrow's earnings`);
      return jobCount;
    });

    return { synced: upsertedCount, jobsCreated };
  },
);
