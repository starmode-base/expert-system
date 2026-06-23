import { ne, sql } from "drizzle-orm";
import { db, schema } from "~/postgres/db";
import type { EarningsCompanyCatalogEntry } from "../api/earnings-calls";

const normalizeSymbol = (symbol: string) => symbol.trim().toUpperCase();
const normalizeMic = (mic: string) => mic.trim().toUpperCase();

function listingKey(symbol: string, mic: string): string {
  return `${normalizeSymbol(symbol)}:${normalizeMic(mic)}`;
}

export function filterUsCatalogEntries(
  companies: EarningsCompanyCatalogEntry[],
): EarningsCompanyCatalogEntry[] {
  return [
    ...companies
      .filter((company) => company.country === "US" && company.callCount > 0)
      .reduce(
        (byListing, company) =>
          byListing.set(listingKey(company.symbol, company.mic), company),
        new Map<string, EarningsCompanyCatalogEntry>(),
      )
      .values(),
  ];
}

export function selectCatalogStocksToHydrate<
  T extends { id: string; symbol: string; mic: string },
>(
  catalogRows: T[],
  trackedStocks: { symbol: string; mic: string; active: boolean }[],
): T[] {
  const trackedByListing = new Map(
    trackedStocks.map((stock) => [listingKey(stock.symbol, stock.mic), stock]),
  );

  return catalogRows.filter((company) => {
    const existing = trackedByListing.get(
      listingKey(company.symbol, company.mic),
    );
    return !existing?.active;
  });
}

export async function upsertCatalogPage(params: {
  companies: EarningsCompanyCatalogEntry[];
  syncRunId: string;
  syncedAt: Date;
}): Promise<number> {
  const companies = filterUsCatalogEntries(params.companies);
  if (companies.length === 0) {
    return 0;
  }

  await db
    .insert(schema.earningsCompanyCatalog)
    .values(
      companies.map((company) => ({
        symbol: normalizeSymbol(company.symbol),
        companyName: company.companyName,
        sector: company.sector,
        industry: company.industry,
        exchange: company.exchange,
        country: company.country,
        mic: normalizeMic(company.mic),
        callCount: company.callCount,
        latestCallAt: company.latestCallAt,
        earliestCallAt: company.earliestCallAt,
        catalogSyncedAt: params.syncedAt,
        syncRunId: params.syncRunId,
      })),
    )
    .onConflictDoUpdate({
      target: [
        schema.earningsCompanyCatalog.symbol,
        schema.earningsCompanyCatalog.mic,
      ],
      set: {
        companyName: sql`excluded.company_name`,
        sector: sql`excluded.sector`,
        industry: sql`excluded.industry`,
        exchange: sql`excluded.exchange`,
        country: sql`excluded.country`,
        callCount: sql`excluded.call_count`,
        latestCallAt: sql`excluded.latest_call_at`,
        earliestCallAt: sql`excluded.earliest_call_at`,
        catalogSyncedAt: params.syncedAt,
        syncRunId: params.syncRunId,
        updatedAt: params.syncedAt,
      },
    });

  return companies.length;
}

export async function finalizeCatalogSync(syncRunId: string): Promise<number> {
  const deleted = await db
    .delete(schema.earningsCompanyCatalog)
    .where(ne(schema.earningsCompanyCatalog.syncRunId, syncRunId))
    .returning({ id: schema.earningsCompanyCatalog.id });
  return deleted.length;
}

export async function activateCatalogStocks(catalogIds: string[]): Promise<
  {
    catalogId: string;
    symbol: string;
    mic: string;
  }[]
> {
  if (catalogIds.length === 0) {
    return [];
  }

  const catalogRows = await db.query.earningsCompanyCatalog.findMany({
    where: (catalog, { inArray }) => inArray(catalog.id, catalogIds),
  });
  if (catalogRows.length !== new Set(catalogIds).size) {
    throw new Error("One or more selected companies are no longer available");
  }

  const trackedStocks = await db.query.trackedStocks.findMany();
  const toHydrate = selectCatalogStocksToHydrate(catalogRows, trackedStocks);

  await db
    .insert(schema.trackedStocks)
    .values(
      catalogRows.map((company) => ({
        symbol: company.symbol,
        companyName: company.companyName,
        exchange: company.exchange,
        mic: company.mic,
        country: company.country,
        active: true,
      })),
    )
    .onConflictDoUpdate({
      target: [schema.trackedStocks.symbol, schema.trackedStocks.mic],
      set: {
        companyName: sql`excluded.company_name`,
        exchange: sql`excluded.exchange`,
        country: sql`excluded.country`,
        active: true,
        updatedAt: new Date(),
      },
    });

  return toHydrate.map((company) => ({
    catalogId: company.id,
    symbol: company.symbol,
    mic: company.mic,
  }));
}
