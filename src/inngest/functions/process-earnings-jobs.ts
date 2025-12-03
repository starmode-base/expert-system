import { eq } from "drizzle-orm";
import { db, schema } from "~/postgres/db";
import { inngest } from "../client";
import { fetchAlphaVantageEarningsTranscript } from "~/lib/earnings-transcripts";
import { saveContent } from "../steps/scrapers/save-content";
import type { EarningsScheduleSelect } from "~/postgres/schema";

interface PendingJob {
  id: string;
  earningsSchedule: EarningsScheduleSelect;
}

/**
 * Parses fiscalDateEnding (e.g., "2024-12-31") to determine year and quarter.
 */
function parseFiscalQuarter(fiscalDateEnding: string) {
  const date = new Date(fiscalDateEnding);
  const month = date.getMonth() + 1;
  return {
    year: date.getFullYear(),
    quarter: Math.ceil(month / 3),
  };
}

/**
 * Process pending earnings fetch jobs.
 * Runs daily at 8 AM Phoenix time (day after reports).
 */
export const processEarningsJobs = inngest.createFunction(
  { id: "scheduler.process-earnings-jobs" },
  { cron: "TZ=America/Phoenix 0 8 * * *" },
  async ({ step }) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pendingJobs = await step.run("get-pending-jobs", async () => {
      const jobs = await db.query.earningsFetchJobs.findMany({
        where: eq(schema.earningsFetchJobs.status, "pending"),
        with: { earningsSchedule: true },
      });

      return jobs
        .filter((job) => {
          const reportDate = new Date(job.earningsSchedule.reportDate);
          reportDate.setHours(0, 0, 0, 0);
          return reportDate >= yesterday && reportDate < today;
        })
        .map(
          (job): PendingJob => ({
            id: job.id,
            earningsSchedule: job.earningsSchedule,
          }),
        );
    });

    if (pendingJobs.length === 0) {
      console.log("No pending earnings jobs to process");
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    console.log(`Processing ${pendingJobs.length} pending earnings jobs`);

    const results = await Promise.all(
      pendingJobs.map((job) =>
        step.run(`process-job-${job.id}`, async () => {
          await db
            .update(schema.earningsFetchJobs)
            .set({ status: "processing" })
            .where(eq(schema.earningsFetchJobs.id, job.id));

          const { earningsSchedule } = job;
          const { year, quarter } = parseFiscalQuarter(
            earningsSchedule.fiscalDateEnding,
          );
          const title = `${earningsSchedule.name} - Q${quarter} ${year} Earnings Call Transcript`;

          try {
            const transcript = await fetchAlphaVantageEarningsTranscript({
              symbol: earningsSchedule.symbol,
              year,
              quarter,
            });

            const articleText = transcript
              .map(
                (entry) =>
                  `${entry.speaker} (${entry.title}): "${entry.content}"`,
              )
              .join("\n");

            const documentId = await saveContent({
              source: "Earnings Calls",
              title,
              description: title,
              publicationDate: new Date(earningsSchedule.reportDate),
              link: "",
              articleText,
            });

            await db
              .update(schema.earningsFetchJobs)
              .set({ status: "completed", processedAt: new Date() })
              .where(eq(schema.earningsFetchJobs.id, job.id));

            return { success: true as const, documentId, jobId: job.id };
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";
            console.error(`Failed to process job ${job.id}:`, errorMessage);

            await db
              .update(schema.earningsFetchJobs)
              .set({
                status: "failed",
                processedAt: new Date(),
                errorMessage,
              })
              .where(eq(schema.earningsFetchJobs.id, job.id));

            return { success: false as const, error: errorMessage };
          }
        }),
      ),
    );

    const successfulResults = results.filter(
      (r): r is { success: true; documentId: string; jobId: string } =>
        r.success,
    );

    await Promise.all(
      successfulResults.map((result) =>
        step.sendEvent(`generate-takeaways-${result.jobId}`, {
          name: "app/generate-takeaways",
          data: {
            documentId: result.documentId,
            takeawayPrompt:
              "Focus on articulating the most notable insight that can be drawn about markets, the economy, new technologies, consumer demand or the business environment at large. Only include financial performance of the company to the extent that it supports insights about any of the afore mentioned themes.",
            model: "gpt-5.1",
          },
          user: { id: "", email: "" },
        }),
      ),
    );

    return {
      processed: pendingJobs.length,
      succeeded: successfulResults.length,
      failed: results.length - successfulResults.length,
    };
  },
);
