import { and, gte, lt, inArray, sql } from "drizzle-orm";
import { db, schema } from "~/postgres/db";
import { inngest } from "../../client";
import { fetchEarningsCalendar } from "~/inngest/importers/scrapers/earnings-calendar";

const toBatches = <T>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size),
  );

const getDateRange = (daysFromNow: number, rangeDays: number) => {
  const start = new Date();
  start.setDate(start.getDate() + daysFromNow);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + rangeDays);
  return { start, end };
};

/**
 * Sync earnings calendar from Alpha Vantage.
 * Runs weekly at 6 AM Phoenix time.
 * - Fetches 3-month earnings calendar
 * - Upserts into earningsSchedule table
 * - Creates earningsFetchJobs for tracked companies reporting in the next week
 */
export const syncEarningsCalendar = inngest.createFunction(
  { id: "scheduler.sync-earnings-calendar" },
  { cron: "TZ=America/Phoenix 35 9 * * 3" }, // Weekly on Wednesdays at 9:35 AM
  // { event: "scheduler/sync-earnings-calendar" },
  async ({ step }) => {
    // Step 1: Fetch earnings calendar from Alpha Vantage
    const calendarEntries = await step.run(
      "fetch-earnings-calendar",
      async () => {
        const entries = await fetchEarningsCalendar("3month");
        console.log(`Fetched ${entries.length} earnings calendar entries`);

        // Filter entries where symbol and name are the same, serialize dates
        // This removes low quality companies from the dataset.
        return entries
          .filter(
            (e) =>
              e.symbol.trim().toLowerCase() !== e.name.trim().toLowerCase(),
          )
          .map((e) => ({ ...e, reportDate: e.reportDate.toISOString() }));
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
        // Deduplicate by (symbol, fiscalDateEnding) - keep last occurrence
        const uniqueEntries = [
          ...calendarEntries
            .reduce(
              (map, entry) =>
                map.set(`${entry.symbol}|${entry.fiscalDateEnding}`, entry),
              new Map<string, (typeof calendarEntries)[0]>(),
            )
            .values(),
        ];

        console.log(
          `Deduped ${calendarEntries.length} entries to ${uniqueEntries.length}`,
        );

        // Process in batches
        await Promise.all(
          toBatches(uniqueEntries, 500).map((batch) =>
            db
              .insert(schema.earningsSchedule)
              .values(
                batch.map((entry) => ({
                  symbol: entry.symbol,
                  name: entry.name,
                  reportDate: new Date(entry.reportDate),
                  fiscalDateEnding: entry.fiscalDateEnding,
                  estimate: entry.estimate,
                  currency: entry.currency,
                })),
              )
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
              }),
          ),
        );

        return uniqueEntries.length;
      },
    );

    // Step 3: Create fetch jobs for tracked companies reporting in the next week
    // Note: Transcripts are system-wide, so we only need one job per earnings report
    const jobsCreated = await step.run("create-fetch-jobs", async () => {
      const { start: tomorrow, end: oneWeekFromTomorrow } = getDateRange(1, 7);

      // Get tracked companies (need userId for job ownership)
      const trackedCompanies = await db.query.trackedCompanies.findMany({
        with: { stockSymbol: true },
      });

      if (trackedCompanies.length === 0) {
        console.log("No tracked companies found");
        return 0;
      }

      // Find earnings scheduled for the next week for tracked symbols
      const earningsNextWeek = await db.query.earningsSchedule.findMany({
        where: and(
          gte(schema.earningsSchedule.reportDate, tomorrow),
          lt(schema.earningsSchedule.reportDate, oneWeekFromTomorrow),
          inArray(
            schema.earningsSchedule.symbol,
            trackedCompanies.map((tc) => tc.stockSymbol.symbol),
          ),
        ),
      });

      if (earningsNextWeek.length === 0) {
        console.log("No tracked earnings scheduled for the next week");
        return 0;
      }

      // Get existing jobs (one per earningsScheduleId is sufficient)
      const existingScheduleIds = new Set(
        (
          await db.query.earningsFetchJobs.findMany({
            where: inArray(
              schema.earningsFetchJobs.earningsScheduleId,
              earningsNextWeek.map((e) => e.id),
            ),
            columns: { earningsScheduleId: true },
          })
        ).map((j) => j.earningsScheduleId),
      );

      // Create one job per earnings (system-wide, not per user)
      const newJobs = earningsNextWeek
        .filter((e) => !existingScheduleIds.has(e.id))
        .map((e) => ({
          earningsScheduleId: e.id,
          status: "pending" as const,
        }));

      if (newJobs.length > 0) {
        await db.insert(schema.earningsFetchJobs).values(newJobs);
      }

      console.log(
        `Created ${newJobs.length} fetch jobs for next week's earnings`,
      );
      return newJobs.length;
    });

    return { synced: upsertedCount, jobsCreated };
  },
);
