import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { DEV_CLERK_USER_ID } from "~/lib/dev-user";
import { db, schema } from "~/postgres/db";
import type {
  EarningsCallMetadata,
  EarningsTranscript,
} from "../api/earnings-calls";
import {
  EARNINGS_SYNC_PROVIDER,
  EARNINGS_TRANSCRIPT_SOURCE,
} from "../constants";

const normalizeSymbol = (symbol: string) => symbol.trim().toUpperCase();
const normalizeMic = (mic: string) => mic.trim().toUpperCase();

function trackedStockKey(symbol: string, mic: string): string {
  return `${normalizeSymbol(symbol)}:${normalizeMic(mic)}`;
}

export function matchTrackedCalls(
  calls: EarningsCallMetadata[],
  stocks: (typeof schema.trackedStocks.$inferSelect)[],
): {
  call: EarningsCallMetadata;
  stock: typeof schema.trackedStocks.$inferSelect;
}[] {
  const stocksByKey = new Map(
    stocks
      .filter((stock) => stock.active)
      .map((stock) => [trackedStockKey(stock.symbol, stock.mic), stock]),
  );

  return calls.flatMap((call) => {
    if (call.country.toUpperCase() !== "US") {
      return [];
    }
    const stock = stocksByKey.get(trackedStockKey(call.symbol, call.mic));
    return stock ? [{ call, stock }] : [];
  });
}

function callValues(
  trackedStockId: string,
  call: EarningsCallMetadata,
): typeof schema.earningsCalls.$inferInsert {
  return {
    providerCallId: call.providerCallId,
    trackedStockId,
    transcriptTitle: call.transcriptTitle,
    eventType: call.eventType,
    eventDateTime: call.eventDateTime,
    providerAddedAt: call.providerAddedAt,
    sector: call.sector,
    industry: call.industry,
    durationSeconds: call.durationSeconds,
  };
}

export async function upsertTrackedStockAndCall(
  call: EarningsCallMetadata,
): Promise<{
  stock: typeof schema.trackedStocks.$inferSelect;
  callId: string;
}> {
  const [stock] = await db
    .insert(schema.trackedStocks)
    .values({
      symbol: normalizeSymbol(call.symbol),
      companyName: call.companyName,
      exchange: call.exchange,
      mic: normalizeMic(call.mic),
      country: call.country.toUpperCase(),
      active: true,
    })
    .onConflictDoUpdate({
      target: [schema.trackedStocks.symbol, schema.trackedStocks.mic],
      set: {
        companyName: call.companyName,
        exchange: call.exchange,
        country: call.country.toUpperCase(),
        active: true,
        updatedAt: new Date(),
      },
    })
    .returning();

  if (!stock) {
    throw new Error("Failed to save tracked stock");
  }

  const [earningsCall] = await db
    .insert(schema.earningsCalls)
    .values(callValues(stock.id, call))
    .onConflictDoUpdate({
      target: schema.earningsCalls.providerCallId,
      set: {
        trackedStockId: stock.id,
        transcriptTitle: call.transcriptTitle,
        eventType: call.eventType,
        eventDateTime: call.eventDateTime,
        providerAddedAt: call.providerAddedAt,
        sector: call.sector,
        industry: call.industry,
        durationSeconds: call.durationSeconds,
        updatedAt: new Date(),
      },
    })
    .returning({ id: schema.earningsCalls.id });

  if (!earningsCall) {
    throw new Error("Failed to save latest earnings call");
  }

  return { stock, callId: earningsCall.id };
}

export async function ingestRecentCalls(
  calls: EarningsCallMetadata[],
): Promise<string[]> {
  if (calls.length === 0) {
    return [];
  }

  const stocks = await db.query.trackedStocks.findMany();
  const matched = matchTrackedCalls(calls, stocks);

  if (matched.length === 0) {
    return [];
  }

  const rows = await db
    .insert(schema.earningsCalls)
    .values(matched.map(({ call, stock }) => callValues(stock.id, call)))
    .onConflictDoUpdate({
      target: schema.earningsCalls.providerCallId,
      set: {
        transcriptTitle: sql`excluded.transcript_title`,
        eventType: sql`excluded.event_type`,
        eventDateTime: sql`excluded.event_date_time`,
        providerAddedAt: sql`excluded.provider_added_at`,
        sector: sql`excluded.sector`,
        industry: sql`excluded.industry`,
        durationSeconds: sql`excluded.duration_seconds`,
        updatedAt: new Date(),
      },
    })
    .returning({ id: schema.earningsCalls.id });

  return rows.map((row) => row.id);
}

export async function getSyncCursor(): Promise<number | null> {
  const state = await db.query.earningsSyncState.findFirst({
    where: eq(schema.earningsSyncState.provider, EARNINGS_SYNC_PROVIDER),
    columns: { afterId: true },
  });
  return state?.afterId ?? null;
}

export async function saveSyncCursor(
  afterId: number,
  options?: { complete?: boolean },
): Promise<void> {
  const now = new Date();
  await db
    .insert(schema.earningsSyncState)
    .values({
      provider: EARNINGS_SYNC_PROVIDER,
      afterId,
      lastPolledAt: now,
      lastSuccessfulSyncAt: options?.complete ? now : null,
    })
    .onConflictDoUpdate({
      target: schema.earningsSyncState.provider,
      set: {
        afterId,
        lastPolledAt: now,
        ...(options?.complete ? { lastSuccessfulSyncAt: now } : {}),
        updatedAt: now,
      },
    });
}

export async function listDispatchableCallIds(): Promise<string[]> {
  const staleBefore = new Date(Date.now() - 60 * 60 * 1000);
  await db
    .update(schema.earningsCalls)
    .set({
      status: "failed",
      lastError: "Recovered stale processing lease",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.earningsCalls.status, "processing"),
        lt(schema.earningsCalls.updatedAt, staleBefore),
      ),
    );

  const rows = await db
    .select({ id: schema.earningsCalls.id })
    .from(schema.earningsCalls)
    .innerJoin(
      schema.trackedStocks,
      eq(schema.earningsCalls.trackedStockId, schema.trackedStocks.id),
    )
    .where(
      and(
        eq(schema.trackedStocks.active, true),
        inArray(schema.earningsCalls.status, ["pending", "failed"]),
      ),
    );

  return rows.map((row) => row.id);
}

export async function claimEarningsCall(
  callId: string,
): Promise<typeof schema.earningsCalls.$inferSelect | null> {
  const [claimed] = await db
    .update(schema.earningsCalls)
    .set({
      status: "processing",
      attempts: sql`${schema.earningsCalls.attempts} + 1`,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.earningsCalls.id, callId),
        inArray(schema.earningsCalls.status, ["pending", "failed"]),
        sql`exists (
          select 1
          from ${schema.trackedStocks}
          where ${schema.trackedStocks.id} = ${schema.earningsCalls.trackedStockId}
            and ${schema.trackedStocks.active} = true
        )`,
      ),
    )
    .returning();

  return claimed ?? null;
}

export async function saveTranscriptDocument(params: {
  callId: string;
  transcript: EarningsTranscript;
}): Promise<string> {
  const externalId = `earningscalls:${String(params.transcript.providerCallId)}`;
  const description = `${params.transcript.companyName} ${params.transcript.eventType} transcript from ${params.transcript.eventDateTime.toLocaleDateString(
    "en-US",
    {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    },
  )}.`;

  const [inserted] = await db
    .insert(schema.documents)
    .values({
      externalId,
      source: EARNINGS_TRANSCRIPT_SOURCE,
      title: params.transcript.transcriptTitle,
      description,
      publicationDate: params.transcript.eventDateTime,
      link: "",
      articleText: params.transcript.text,
      isSubstantive: true,
    })
    .onConflictDoNothing({ target: schema.documents.externalId })
    .returning({ id: schema.documents.id });

  const documentId =
    inserted?.id ??
    (
      await db.query.documents.findFirst({
        where: eq(schema.documents.externalId, externalId),
        columns: { id: true },
      })
    )?.id;

  if (!documentId) {
    throw new Error("Failed to save earnings transcript document");
  }

  await db
    .update(schema.earningsCalls)
    .set({
      documentId,
      transcriptTitle: params.transcript.transcriptTitle,
      eventType: params.transcript.eventType,
      eventDateTime: params.transcript.eventDateTime,
      sector: params.transcript.sector,
      industry: params.transcript.industry,
      durationSeconds: params.transcript.durationSeconds,
      updatedAt: new Date(),
    })
    .where(eq(schema.earningsCalls.id, params.callId));

  return documentId;
}

export async function recordCallError(
  callId: string,
  error: unknown,
  options?: { failed?: boolean },
): Promise<void> {
  const message = error instanceof Error ? error.message : "Unknown error";
  await db
    .update(schema.earningsCalls)
    .set({
      status: options?.failed ? "failed" : "processing",
      lastError: message.slice(0, 2000),
      updatedAt: new Date(),
    })
    .where(eq(schema.earningsCalls.id, callId));
}

export async function markTakeawaysQueued(callId: string): Promise<void> {
  await db
    .update(schema.earningsCalls)
    .set({
      status: "takeaways_queued",
      lastError: null,
      takeawaysQueuedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.earningsCalls.id, callId),
        // Only transition in-flight calls so a retry can never overwrite "complete"
        eq(schema.earningsCalls.status, "processing"),
      ),
    );
}

export async function markEarningsCallComplete(
  documentId: string,
): Promise<void> {
  await db
    .update(schema.earningsCalls)
    .set({
      status: "complete",
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(schema.earningsCalls.documentId, documentId));
}

export async function getSystemUser(): Promise<{ id: string; email: string }> {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.clerkUserId, DEV_CLERK_USER_ID),
    columns: { id: true, email: true },
  });

  if (!user) {
    throw new Error(
      "The configured earnings system user is not in the database",
    );
  }

  return user;
}
