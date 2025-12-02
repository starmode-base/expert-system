import { eq } from "drizzle-orm";
import { db, schema } from "~/postgres/db";
import { inngest } from "../client";
import { fetchAlphaVantageEarningsTranscript } from "~/lib/earnings-transcripts";
import { saveContent } from "../steps/scrapers/save-content";
import type { EarningsScheduleSelect } from "~/postgres/schema";

interface PendingJob {
  id: string;
  userId: string;
  earningsSchedule: EarningsScheduleSelect;
}

/**
 * Parses fiscalDateEnding (e.g., "2024-12-31") to determine year and quarter.
 */
function parseFiscalQuarter(fiscalDateEnding: string): {
  year: number;
  quarter: number;
} {
  const date = new Date(fiscalDateEnding);
  const month = date.getMonth() + 1; // getMonth() is 0-indexed
  const year = date.getFullYear();

  // Determine quarter based on fiscal end month
  let quarter: number;
  if (month <= 3) {
    quarter = 1;
  } else if (month <= 6) {
    quarter = 2;
  } else if (month <= 9) {
    quarter = 3;
  } else {
    quarter = 4;
  }

  return { year, quarter };
}

/**
 * Process pending earnings fetch jobs.
 * Runs daily at 8 AM Phoenix time (day after reports).
 * - Queries pending jobs where reportDate = yesterday
 * - Fetches transcripts and saves documents
 * - Generates takeaways for each document
 */
export const processEarningsJobs = inngest.createFunction(
  { id: "scheduler.process-earnings-jobs" },
  { cron: "TZ=America/Phoenix 0 8 * * *" },
  async ({ step }) => {
    // Calculate yesterday's date range
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Step 1: Get pending jobs for yesterday's earnings
    const pendingJobs = await step.run("get-pending-jobs", async () => {
      const jobs = await db.query.earningsFetchJobs.findMany({
        where: eq(schema.earningsFetchJobs.status, "pending"),
        with: {
          earningsSchedule: true,
          user: true,
        },
      });

      // Filter for jobs where report date was yesterday and map to simpler type
      const filtered: PendingJob[] = [];
      for (const job of jobs) {
        const reportDate = new Date(job.earningsSchedule.reportDate);
        reportDate.setHours(0, 0, 0, 0);
        if (reportDate >= yesterday && reportDate < today) {
          filtered.push({
            id: job.id,
            userId: job.userId,
            earningsSchedule: job.earningsSchedule,
          });
        }
      }
      return filtered;
    });

    if (pendingJobs.length === 0) {
      console.log("No pending earnings jobs to process");
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    console.log(`Processing ${pendingJobs.length} pending earnings jobs`);

    let succeeded = 0;
    let failed = 0;

    // Step 2: Process each job
    for (const job of pendingJobs) {
      const result = await step.run(`process-job-${job.id}`, async () => {
        // Mark job as processing
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
          // Fetch transcript from Alpha Vantage
          const transcript = await fetchAlphaVantageEarningsTranscript({
            symbol: earningsSchedule.symbol,
            year,
            quarter,
          });

          // Format article text
          const articleText = transcript
            .map(
              (entry) =>
                `${entry.speaker} (${entry.title}): "${entry.content}"`,
            )
            .join("\n");

          // Save document
          const documentId = await saveContent({
            source: "Earnings Calls",
            title,
            description: title,
            publicationDate: new Date(earningsSchedule.reportDate),
            link: "",
            articleText,
          });

          // Mark job as completed
          await db
            .update(schema.earningsFetchJobs)
            .set({
              status: "completed",
              processedAt: new Date(),
            })
            .where(eq(schema.earningsFetchJobs.id, job.id));

          return {
            success: true as const,
            documentId,
            userId: job.userId,
          };
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
      });

      if (result.success && "documentId" in result) {
        succeeded++;

        const successResult = result as {
          success: true;
          documentId: string;
          userId: string;
        };

        // Generate takeaways for the document using sendEvent

        await step.sendEvent(`generate-takeaways-${job.id}`, {
          name: "app/generate-takeaways",
          data: {
            documentId: successResult.documentId,
            takeawayPrompt:
              "Focus on articulating the most notable insight that can be drawn about markets, the economy, new technologies, consumer demand or the business environment at large. Only include financial performance of the company to the extent that it supports insights about any of the afore mentioned themes.",
            model: "gpt-5.1",
          },
          user: {
            id: successResult.userId,
            email: "",
          },
        } as any);
      } else {
        failed++;
      }
    }

    return {
      processed: pendingJobs.length,
      succeeded,
      failed,
    };
  },
);
