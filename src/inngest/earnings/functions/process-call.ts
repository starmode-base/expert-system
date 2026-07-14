import { NonRetriableError } from "inngest";
import { inngest } from "~/inngest/client";
import {
  EARNINGS_TAKEAWAY_MODEL,
  EARNINGS_TAKEAWAY_PROMPT,
} from "../constants";
import { EarningsCallsApiError, fetchTranscript } from "../api/earnings-calls";
import {
  claimEarningsCall,
  getSystemUser,
  markTakeawaysQueued,
  recordCallError,
  saveTranscriptDocument,
} from "../services/earnings-repository";

export const processEarningsCall = inngest.createFunction(
  {
    id: "earnings.process-call",
    retries: 5,
    concurrency: { limit: 5 },
  },
  { event: "earnings/call.discovered" },
  async ({ event, step }) => {
    const call = await step.run("claim-call", () =>
      claimEarningsCall(event.data.callId),
    );

    if (!call) {
      return { status: "ignored" as const };
    }

    let documentId: string;
    try {
      documentId = await step.run("fetch-and-save-transcript", async () => {
        const transcript = await fetchTranscript(call.providerCallId);
        return saveTranscriptDocument({
          callId: call.id,
          transcript,
        });
      });
    } catch (error) {
      const nonRetryable =
        error instanceof EarningsCallsApiError && !error.retryable;
      await step.run("record-call-error", () =>
        recordCallError(call.id, error, { failed: nonRetryable }),
      );

      if (nonRetryable) {
        throw new NonRetriableError(error.message);
      }
      throw error;
    }

    const systemUser = await step.run("load-system-user", getSystemUser);

    // Mark queued before sending the event so the takeaways worker's
    // "complete" write can never be overwritten by this one.
    await step.run("mark-takeaways-queued", () => markTakeawaysQueued(call.id));

    await step.sendEvent("generate-takeaways", {
      name: "app/generate-takeaways",
      data: {
        documentId,
        takeawayPrompt: EARNINGS_TAKEAWAY_PROMPT,
        model: EARNINGS_TAKEAWAY_MODEL,
        user: systemUser,
      },
    });

    return { status: "takeaways_queued" as const, documentId };
  },
);
