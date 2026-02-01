import { inngest } from "~/inngest/client";
import { db, schema } from "~/postgres/db";
import { eq, inArray } from "drizzle-orm";
import { getDocumentSummary } from "../../helpers/get-document-summary";
import {
  createXClient,
  refreshAccessToken,
  isTokenExpired,
  calculateExpiresAt,
} from "./x-client";
import {
  mapBookmarksToCandidates,
  mapCandidateToDocument,
  xBookmarksTakeawayPrompt,
} from "./x-bookmarks-helpers";

/**
 * Scheduled job to sync X Bookmarks daily.
 * Runs daily at 6 AM Phoenix time (after other importers).
 */
const trigger =
  process.env.NODE_ENV === "production"
    ? ({ cron: "TZ=America/Phoenix 0 6 * * *" } as const)
    : ({ event: "dev/scheduler.x-bookmarks-sync.manual" } as const);

export const xBookmarksSync = inngest.createFunction(
  { id: "scheduler.x-bookmarks-sync" },
  trigger,
  async ({ step }) => {
    // Get all auth records (for now, process all users)
    const authRecords = await step.run("get-auth-records", async () => {
      const records = await db.select().from(schema.xBookmarksAuth);
      // Convert dates to ISO strings for serialization
      return records.map((r) => ({
        ...r,
        expiresAt: r.expiresAt.toISOString(),
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }));
    });

    if (authRecords.length === 0) {
      return { message: "No X Bookmarks auth records found", processed: 0 };
    }

    let totalInserted = 0;
    let totalSkipped = 0;

    // Process each user's bookmarks
    for (const auth of authRecords) {
      const authId = auth.id;

      // Refresh token if expired or expiring soon
      const accessToken = await step.run(
        `refresh-token-${authId}`,
        async () => {
          if (isTokenExpired(new Date(auth.expiresAt))) {
            const tokens = await refreshAccessToken(auth.refreshToken);
            const expiresAt = calculateExpiresAt(tokens.expires_in);

            // Update stored tokens
            await db
              .update(schema.xBookmarksAuth)
              .set({
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token ?? auth.refreshToken,
                expiresAt,
              })
              .where(eq(schema.xBookmarksAuth.id, authId));

            return tokens.access_token;
          }

          return auth.accessToken;
        },
      );

      // Fetch bookmarks
      const candidates = await step.run(
        `fetch-bookmarks-${authId}`,
        async () => {
          const client = createXClient(accessToken);
          const response = await client.getBookmarks(auth.xUserId, {
            maxResults: 50,
          });
          return mapBookmarksToCandidates(response);
        },
      );

      if (candidates.length === 0) {
        continue;
      }

      // Check for existing documents by link
      const uniqueLinks = Array.from(
        new Set(candidates.map((c) => c.link)),
      );
      const existingLinks = await step.run(
        `get-existing-links-${authId}`,
        async () => {
          const rows = await db
            .select({ link: schema.documents.link })
            .from(schema.documents)
            .where(inArray(schema.documents.link, uniqueLinks));
          return rows.map((r) => r.link);
        },
      );

      const existingLinkSet = new Set(existingLinks);
      const newCandidates = candidates.filter(
        (c) => !existingLinkSet.has(c.link),
      );

      if (newCandidates.length === 0) {
        totalSkipped += candidates.length;
        continue;
      }

      // Generate summaries for each new candidate
      const summaries = await Promise.all(
        newCandidates.map(async (candidate, index) => {
          return await step.run(
            `generate-summary-${authId}-${index}`,
            async () => {
              return await getDocumentSummary(candidate.text, candidate.title);
            },
          );
        }),
      );

      // Insert new documents
      const inserted = await step.run(
        `insert-documents-${authId}`,
        async () => {
          const values = newCandidates.map((candidate, index) =>
            mapCandidateToDocument(
              candidate,
              summaries[index] ?? candidate.text,
            ),
          );

          return await db.insert(schema.documents).values(values).returning({
            id: schema.documents.id,
          });
        },
      );

      // Trigger takeaway generation for each inserted document
      await Promise.all(
        inserted.map(async (doc) => {
          await step.sendEvent(`generate-takeaways-${doc.id}`, {
            name: "app/generate-takeaways",
            data: {
              documentId: doc.id,
              takeawayPrompt: xBookmarksTakeawayPrompt,
              model: "gpt-5.2",
              user: { id: "", email: "" },
            },
          });
        }),
      );

      totalInserted += inserted.length;
      totalSkipped += candidates.length - newCandidates.length;
    }

    return {
      processed: authRecords.length,
      inserted: totalInserted,
      skipped: totalSkipped,
    };
  },
);
