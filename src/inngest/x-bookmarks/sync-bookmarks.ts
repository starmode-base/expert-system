import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { NonRetriableError } from "inngest";
import { inngest } from "~/inngest/client";
import { getDocumentSummary } from "~/inngest/importers/helpers/get-document-summary";
import { db, schema } from "~/postgres/db";
import {
  calculateExpiresAt,
  getBookmarksByFolder,
  getBookmarksPage,
  getPostsByIds,
  IncompleteXArticleError,
  isTokenExpired,
  normalizeXPost,
  refreshAccessToken,
  XApiRequestError,
  type XPost,
  type XPostsResponse,
} from "~/x-client/x-sdk";
import type { XBookmarkSyncTrigger } from "~/postgres/schema";

const INITIAL_LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_PAGES = 50;
const KNOWN_PAGE_STOP_COUNT = 2;

function safeError(error: unknown): string {
  if (error instanceof IncompleteXArticleError) return error.message;
  if (error instanceof XApiRequestError) {
    if (error.reconnectRequired) return "X authorization must be renewed";
    if (error.status === 429) return "X API rate limit reached";
    return `X API request failed (${String(error.status)})`;
  }
  return error instanceof Error ? error.message.slice(0, 500) : "Unknown error";
}

async function getFreshAccessToken(userId: string): Promise<{
  accessToken: string;
  xUserId: string;
  selectedFolderId: string | null;
}> {
  const auth = await db.query.xBookmarksAuth.findFirst({
    where: eq(schema.xBookmarksAuth.userId, userId),
  });
  if (!auth) throw new NonRetriableError("X account is not connected");

  if (!isTokenExpired(auth.expiresAt)) {
    return {
      accessToken: auth.accessToken,
      xUserId: auth.xUserId,
      selectedFolderId: auth.selectedFolderId,
    };
  }

  const tokens = await refreshAccessToken(auth.refreshToken);
  const refreshToken = tokens.refresh_token ?? auth.refreshToken;
  await db
    .update(schema.xBookmarksAuth)
    .set({
      accessToken: tokens.access_token,
      refreshToken,
      expiresAt: calculateExpiresAt(tokens.expires_in),
    })
    .where(
      and(
        eq(schema.xBookmarksAuth.id, auth.id),
        eq(schema.xBookmarksAuth.refreshToken, auth.refreshToken),
      ),
    );

  const current = await db.query.xBookmarksAuth.findFirst({
    where: eq(schema.xBookmarksAuth.id, auth.id),
  });
  if (!current) throw new NonRetriableError("X account was disconnected");
  return {
    accessToken: current.accessToken,
    xUserId: current.xUserId,
    selectedFolderId: current.selectedFolderId,
  };
}

async function fetchPage(
  auth: Awaited<ReturnType<typeof getFreshAccessToken>>,
  cursor?: string,
): Promise<XPostsResponse> {
  if (!auth.selectedFolderId) {
    return getBookmarksPage(auth.accessToken, auth.xUserId, cursor);
  }
  const folderPage = await getBookmarksByFolder(
    auth.accessToken,
    auth.xUserId,
    auth.selectedFolderId,
    cursor,
  );
  const hydrated = await getPostsByIds(
    auth.accessToken,
    (folderPage.data ?? []).map((item) => item.id),
  );
  return {
    ...hydrated,
    errors: [...(folderPage.errors ?? []), ...(hydrated.errors ?? [])],
    meta: { next_token: folderPage.meta?.next_token },
  };
}

async function fetchPageResult(
  auth: Awaited<ReturnType<typeof getFreshAccessToken>>,
  cursor?: string,
): Promise<
  | { ok: true; page: XPostsResponse }
  | {
      ok: false;
      status: number;
      retryAt: string | null;
      reconnectRequired: boolean;
    }
> {
  try {
    return { ok: true, page: await fetchPage(auth, cursor) };
  } catch (error) {
    if (!(error instanceof XApiRequestError)) throw error;
    return {
      ok: false,
      status: error.status,
      retryAt: error.retryAt?.toISOString() ?? null,
      reconnectRequired: error.reconnectRequired,
    };
  }
}

async function upsertBookmarkItem(
  userId: string,
  postId: string,
): Promise<void> {
  await db
    .insert(schema.xBookmarkItems)
    .values({ userId, xPostId: postId })
    .onConflictDoNothing({
      target: [schema.xBookmarkItems.userId, schema.xBookmarkItems.xPostId],
    });
}

async function processPost(
  userId: string,
  post: XPost,
  response: XPostsResponse,
): Promise<"imported" | "skipped"> {
  const normalized = normalizeXPost(post, response);
  const existing = await db.query.documents.findFirst({
    where: eq(schema.documents.externalId, normalized.externalId),
  });

  let documentId = existing?.id;
  let isSubstantive = existing?.isSubstantive ?? true;
  if (!documentId) {
    const summary = await getDocumentSummary(
      normalized.articleText,
      normalized.title,
    );
    const [inserted] = await db
      .insert(schema.documents)
      .values({
        source: "X",
        title: normalized.title,
        description: summary.summary,
        publicationDate: normalized.publicationDate,
        link: normalized.link,
        externalId: normalized.externalId,
        articleText: normalized.articleText,
        isSubstantive: summary.isSubstantive,
      })
      .onConflictDoNothing({ target: schema.documents.externalId })
      .returning({
        id: schema.documents.id,
        isSubstantive: schema.documents.isSubstantive,
      });
    if (inserted) {
      documentId = inserted.id;
      isSubstantive = inserted.isSubstantive;
    } else {
      const raced = await db.query.documents.findFirst({
        where: eq(schema.documents.externalId, normalized.externalId),
      });
      if (!raced) throw new Error("Unable to resolve imported X document");
      documentId = raced.id;
      isSubstantive = raced.isSubstantive;
    }
  }

  await db
    .update(schema.xBookmarkItems)
    .set({
      documentId,
      status: isSubstantive ? "imported" : "skipped",
      lastError: null,
    })
    .where(
      and(
        eq(schema.xBookmarkItems.userId, userId),
        eq(schema.xBookmarkItems.xPostId, post.id),
      ),
    );
  return isSubstantive ? "imported" : "skipped";
}

export const scheduleDailyXBookmarkSync = inngest.createFunction(
  { id: "x/bookmarks.schedule-daily" },
  { cron: "TZ=America/Los_Angeles 0 4 * * *" },
  async ({ step }) => {
    const userIds = await step.run("list-connected-users", async () => {
      const rows = await db
        .select({ userId: schema.xBookmarksAuth.userId })
        .from(schema.xBookmarksAuth);
      return rows.map((row) => row.userId);
    });
    await Promise.all(
      userIds.map((userId) =>
        step.sendEvent(`sync-${userId}`, {
          name: "x/bookmarks.sync.requested",
          data: { userId, trigger: "daily" as const },
        }),
      ),
    );
    return { scheduled: userIds.length };
  },
);

export const syncXBookmarks = inngest.createFunction(
  {
    id: "x/bookmarks.sync",
    concurrency: [{ limit: 1, key: "event.data.userId" }],
    retries: 4,
  },
  { event: "x/bookmarks.sync.requested" },
  async ({ event, step }) => {
    const { userId } = event.data;
    const priorSuccess = await step.run("find-prior-success", async () => {
      return db.query.xBookmarkSyncRuns.findFirst({
        where: and(
          eq(schema.xBookmarkSyncRuns.userId, userId),
          inArray(schema.xBookmarkSyncRuns.status, ["completed", "partial"]),
        ),
        orderBy: [desc(schema.xBookmarkSyncRuns.createdAt)],
      });
    });
    const trigger: XBookmarkSyncTrigger = priorSuccess
      ? event.data.trigger
      : "initial";
    const run = await step.run("create-run", async () => {
      if (event.data.runId) {
        const [started] = await db
          .update(schema.xBookmarkSyncRuns)
          .set({ status: "running", startedAt: new Date() })
          .where(eq(schema.xBookmarkSyncRuns.id, event.data.runId))
          .returning();
        if (!started) throw new Error("Queued X bookmark sync run not found");
        return started;
      }
      const [created] = await db
        .insert(schema.xBookmarkSyncRuns)
        .values({
          userId,
          trigger,
          status: "running",
          startedAt: new Date(),
        })
        .returning();
      if (!created) throw new Error("Unable to create X bookmark sync run");
      return created;
    });

    try {
      const auth = await step.run("refresh-auth", () =>
        getFreshAccessToken(userId),
      );
      const knownIds = new Set(
        await step.run("load-known-items", async () => {
          const rows = await db
            .select({
              xPostId: schema.xBookmarkItems.xPostId,
              status: schema.xBookmarkItems.status,
            })
            .from(schema.xBookmarkItems)
            .where(eq(schema.xBookmarkItems.userId, userId));
          return rows
            .filter((row) => row.status !== "failed")
            .map((row) => row.xPostId);
        }),
      );
      const cutoff = Date.now() - INITIAL_LOOKBACK_MS;
      let cursor: string | undefined;
      let knownPages = 0;
      let oldPages = 0;
      let discovered = 0;
      let imported = 0;
      let skipped = 0;
      let failed = 0;

      for (let pageNumber = 0; pageNumber < MAX_PAGES; pageNumber += 1) {
        let pageResult = await step.run(
          `fetch-page-${String(pageNumber)}`,
          () => fetchPageResult(auth, cursor),
        );
        if (!pageResult.ok && pageResult.status === 429 && pageResult.retryAt) {
          await step.sleepUntil(
            `rate-limit-${String(pageNumber)}`,
            new Date(pageResult.retryAt),
          );
          pageResult = await step.run(
            `fetch-page-after-rate-limit-${String(pageNumber)}`,
            () => fetchPageResult(auth, cursor),
          );
        }
        if (!pageResult.ok) {
          throw new XApiRequestError(
            `X API request failed with status ${String(pageResult.status)}`,
            pageResult.status,
            pageResult.retryAt ? new Date(pageResult.retryAt) : null,
            pageResult.reconnectRequired,
          );
        }
        const page = pageResult.page;
        const posts = page.data ?? [];
        const pageWasKnown =
          posts.length > 0 && posts.every((post) => knownIds.has(post.id));
        knownPages = pageWasKnown ? knownPages + 1 : 0;
        const pageWasOld =
          posts.length > 0 &&
          posts.every(
            (post) =>
              post.created_at !== undefined &&
              new Date(post.created_at).getTime() < cutoff,
          );
        oldPages = pageWasOld ? oldPages + 1 : 0;

        for (const post of posts) {
          if (
            trigger === "initial" &&
            post.created_at &&
            new Date(post.created_at).getTime() < cutoff
          ) {
            skipped += 1;
            continue;
          }
          if (knownIds.has(post.id)) continue;

          discovered += 1;
          knownIds.add(post.id);
          await step.run(`discover-${post.id}`, () =>
            upsertBookmarkItem(userId, post.id),
          );
          try {
            const result = await step.run(`process-${post.id}`, () =>
              processPost(userId, post, page),
            );
            if (result === "imported") {
              imported += 1;
              const user = await step.run(`load-user-${post.id}`, () =>
                db.query.users.findFirst({
                  where: eq(schema.users.id, userId),
                }),
              );
              const item = await step.run(`load-item-${post.id}`, () =>
                db.query.xBookmarkItems.findFirst({
                  where: and(
                    eq(schema.xBookmarkItems.userId, userId),
                    eq(schema.xBookmarkItems.xPostId, post.id),
                  ),
                }),
              );
              if (user && item?.documentId) {
                await step.sendEvent(`takeaways-${post.id}`, {
                  name: "app/generate-takeaways",
                  data: {
                    documentId: item.documentId,
                    user: { id: user.id, email: user.email },
                  },
                });
              }
            } else {
              skipped += 1;
            }
          } catch (error) {
            failed += 1;
            await step.run(`fail-${post.id}`, async () => {
              await db
                .update(schema.xBookmarkItems)
                .set({
                  status: "failed",
                  attempts: sql`${schema.xBookmarkItems.attempts} + 1`,
                  lastError: safeError(error),
                })
                .where(
                  and(
                    eq(schema.xBookmarkItems.userId, userId),
                    eq(schema.xBookmarkItems.xPostId, post.id),
                  ),
                );
            });
          }
        }

        cursor = page.meta?.next_token;
        await step.run(`checkpoint-${String(pageNumber)}`, async () => {
          await db
            .update(schema.xBookmarkSyncRuns)
            .set({
              checkpoint: cursor ?? null,
              discoveredCount: discovered,
              importedCount: imported,
              skippedCount: skipped,
              failedCount: failed,
            })
            .where(eq(schema.xBookmarkSyncRuns.id, run.id));
        });

        if (
          !cursor ||
          (trigger === "initial" && oldPages >= KNOWN_PAGE_STOP_COUNT) ||
          (trigger !== "initial" && knownPages >= KNOWN_PAGE_STOP_COUNT)
        ) {
          break;
        }
      }

      await step.run("complete-run", async () => {
        await db
          .update(schema.xBookmarkSyncRuns)
          .set({
            status: failed > 0 ? "partial" : "completed",
            completedAt: new Date(),
            checkpoint: null,
            discoveredCount: discovered,
            importedCount: imported,
            skippedCount: skipped,
            failedCount: failed,
          })
          .where(eq(schema.xBookmarkSyncRuns.id, run.id));
      });
      return { discovered, imported, skipped, failed };
    } catch (error) {
      await step.run("fail-run", async () => {
        await db
          .update(schema.xBookmarkSyncRuns)
          .set({
            status: "failed",
            completedAt: new Date(),
            error: safeError(error),
          })
          .where(eq(schema.xBookmarkSyncRuns.id, run.id));
      });
      throw error;
    }
  },
);
