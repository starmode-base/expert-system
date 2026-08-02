import { eq, sql } from "drizzle-orm";
import { db, schema } from "~/postgres/db";
import { FinancialApiError } from "./errors";
import { secCompanyFactsSchema, type SecCompanyFacts } from "./normalize";

const SEC_COMPANY_FACTS_BASE_URL = "https://data.sec.gov/api/xbrl/companyfacts";
const SEC_USER_AGENT = "Expert System financial-data contact@starmode.dev";
const CACHE_TTL_MS = 15 * 60 * 1000;
const SEC_GLOBAL_LOCK_ID = 1_904_202_608;
const SEC_REQUEST_INTERVAL_MS = 125;

type Fetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

interface SecClientOptions {
  fetcher?: Fetcher;
  now?: () => Date;
}

const inFlightRequests = new Map<string, Promise<SecCompanyFacts>>();

export function normalizeCik(cik: string | number): string {
  const raw = String(cik).trim().replace(/^CIK/i, "");
  if (!/^\d{1,10}$/.test(raw)) {
    throw new FinancialApiError(
      "INVALID_REQUEST",
      "CIK must contain between 1 and 10 digits",
      400,
    );
  }
  const digits = raw.replace(/^0+/, "") || "0";
  return digits.padStart(10, "0");
}

export function secCompanyFactsUrl(cik: string): string {
  return `${SEC_COMPANY_FACTS_BASE_URL}/CIK${cik}.json`;
}

export function isSecCacheFresh(fetchedAt: Date, now: Date): boolean {
  const age = now.getTime() - fetchedAt.getTime();
  return age >= 0 && age < CACHE_TTL_MS;
}

function parseCachedPayload(payload: unknown): SecCompanyFacts | undefined {
  const parsed = secCompanyFactsSchema.safeParse(payload);
  return parsed.success ? parsed.data : undefined;
}

async function readFreshCache(
  cik: string,
  now: Date,
): Promise<SecCompanyFacts | undefined> {
  const [cached] = await db
    .select({
      payload: schema.secCompanyFactsCache.payload,
      fetchedAt: schema.secCompanyFactsCache.fetchedAt,
    })
    .from(schema.secCompanyFactsCache)
    .where(eq(schema.secCompanyFactsCache.cik, cik))
    .limit(1);

  if (!cached || !isSecCacheFresh(cached.fetchedAt, now)) return undefined;
  return parseCachedPayload(cached.payload);
}

async function fetchFromSec(
  cik: string,
  fetcher: Fetcher,
): Promise<SecCompanyFacts> {
  const source = secCompanyFactsUrl(cik);
  let response: Response;
  try {
    response = await fetcher(source, {
      headers: {
        Accept: "application/json",
        "User-Agent": SEC_USER_AGENT,
      },
    });
  } catch {
    throw new FinancialApiError(
      "SEC_UNAVAILABLE",
      "SEC EDGAR is temporarily unavailable",
      502,
    );
  }

  if (response.status === 404) {
    throw new FinancialApiError(
      "COMPANY_NOT_FOUND",
      `No SEC company facts found for CIK ${cik}`,
      404,
    );
  }
  if (response.status === 429) {
    throw new FinancialApiError(
      "RATE_LIMITED",
      "SEC EDGAR rate limit reached",
      429,
    );
  }
  if (!response.ok) {
    throw new FinancialApiError(
      "SEC_UNAVAILABLE",
      "SEC EDGAR is temporarily unavailable",
      502,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new FinancialApiError(
      "SEC_UNAVAILABLE",
      "SEC EDGAR returned an invalid response",
      502,
    );
  }

  const parsed = secCompanyFactsSchema.safeParse(payload);
  if (!parsed.success || normalizeCik(parsed.data.cik) !== cik) {
    throw new FinancialApiError(
      "SEC_UNAVAILABLE",
      "SEC EDGAR returned an invalid company-facts payload",
      502,
    );
  }
  return parsed.data;
}

async function refreshCompanyFacts(
  cik: string,
  fetcher: Fetcher,
  now: () => Date,
): Promise<SecCompanyFacts> {
  return db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`sec-company-facts:${cik}`}))`,
    );

    const [cached] = await transaction
      .select({
        payload: schema.secCompanyFactsCache.payload,
        fetchedAt: schema.secCompanyFactsCache.fetchedAt,
      })
      .from(schema.secCompanyFactsCache)
      .where(eq(schema.secCompanyFactsCache.cik, cik))
      .limit(1);
    const cachedPayload =
      cached && isSecCacheFresh(cached.fetchedAt, now())
        ? parseCachedPayload(cached.payload)
        : undefined;
    if (cachedPayload) return cachedPayload;

    await transaction.execute(
      sql`select pg_advisory_xact_lock(${SEC_GLOBAL_LOCK_ID})`,
    );
    await new Promise<void>((resolve) => {
      setTimeout(resolve, SEC_REQUEST_INTERVAL_MS);
    });

    const company = await fetchFromSec(cik, fetcher);
    const fetchedAt = now();
    await transaction
      .insert(schema.secCompanyFactsCache)
      .values({ cik, payload: company, fetchedAt })
      .onConflictDoUpdate({
        target: schema.secCompanyFactsCache.cik,
        set: { payload: company, fetchedAt },
      });
    return company;
  });
}

export async function getSecCompanyFacts(
  cikInput: string | number,
  options: SecClientOptions = {},
): Promise<SecCompanyFacts> {
  const cik = normalizeCik(cikInput);
  const now = options.now ?? (() => new Date());
  const cached = await readFreshCache(cik, now());
  if (cached) return cached;

  const existingRequest = inFlightRequests.get(cik);
  if (existingRequest) return existingRequest;

  const request = refreshCompanyFacts(cik, options.fetcher ?? fetch, now);
  inFlightRequests.set(cik, request);
  try {
    return await request;
  } finally {
    if (inFlightRequests.get(cik) === request) inFlightRequests.delete(cik);
  }
}
