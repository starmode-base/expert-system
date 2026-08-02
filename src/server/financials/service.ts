import { eq } from "drizzle-orm";
import { db, schema } from "~/postgres/db";
import {
  FINANCIAL_CATALOG_VERSION,
  financialMetricCatalog,
  financialMetricIds,
  type FinancialMetricId,
} from "./catalog";
import { FinancialApiError, type FinancialErrorCode } from "./errors";
import {
  normalizeFinancialMetric,
  type FinancialPeriod,
  type NormalizedFinancialMetric,
  type NormalizedFinancialObservation,
  type SecCompanyFacts,
} from "./normalize";
import {
  getSecCompanyFacts,
  normalizeCik,
  secCompanyFactsUrl,
} from "./sec-client";

interface CompanyIdentifier {
  cik: string;
  symbol?: string;
}

export interface FinancialQueryOptions {
  period: FinancialPeriod;
  limit: number;
  includeProvenance: boolean;
}

interface CompactObservation {
  date: string;
  value: number;
  periodType: NormalizedFinancialObservation["periodType"];
  start?: string;
  filed?: string;
  form?: string;
  accession?: string;
  concept?: string;
}

interface PublicFinancialMetric {
  unit: string;
  data: CompactObservation[];
}

interface PublicMetricError {
  code: FinancialErrorCode;
  message: string;
}

function isCikIdentifier(identifier: string): boolean {
  return /^(?:CIK)?\d{1,10}$/i.test(identifier.trim());
}

export async function resolveCompanyIdentifier(
  identifier: string,
): Promise<CompanyIdentifier> {
  const trimmed = identifier.trim();
  if (isCikIdentifier(trimmed)) return { cik: normalizeCik(trimmed) };

  const symbol = trimmed.toUpperCase();
  const stock = await db.query.stockSymbols.findFirst({
    where: eq(schema.stockSymbols.symbol, symbol),
    columns: { cik: true },
  });
  if (!stock?.cik) {
    throw new FinancialApiError(
      "COMPANY_NOT_FOUND",
      `No SEC CIK found for ${symbol}`,
      404,
    );
  }
  return { cik: normalizeCik(stock.cik), symbol };
}

function publicIdentity(
  identifier: CompanyIdentifier,
  company: SecCompanyFacts,
) {
  return {
    ...(identifier.symbol ? { symbol: identifier.symbol } : {}),
    cik: identifier.cik,
    company: company.entityName,
  };
}

function publicObservation(
  observation: NormalizedFinancialObservation,
  includeProvenance: boolean,
): CompactObservation {
  return {
    date: observation.date,
    value: observation.value,
    periodType: observation.periodType,
    ...(observation.start ? { start: observation.start } : {}),
    ...(includeProvenance
      ? {
          filed: observation.filed,
          form: observation.form,
          accession: observation.accession,
          concept: observation.concept,
        }
      : {}),
  };
}

function publicMetric(
  metric: NormalizedFinancialMetric,
  includeProvenance: boolean,
): PublicFinancialMetric {
  return {
    unit: metric.unit,
    data: metric.data.map((observation) =>
      publicObservation(observation, includeProvenance),
    ),
  };
}

function publicSource(cik: string, includeProvenance: boolean) {
  return includeProvenance
    ? { provider: "SEC EDGAR", url: secCompanyFactsUrl(cik) }
    : "SEC";
}

async function loadCompany(identifier: string) {
  const resolved = await resolveCompanyIdentifier(identifier);
  const company = await getSecCompanyFacts(resolved.cik);
  return { resolved, company };
}

export async function getSingleFinancialMetric(
  identifier: string,
  metricId: FinancialMetricId,
  options: FinancialQueryOptions,
) {
  const { resolved, company } = await loadCompany(identifier);
  const normalized = normalizeFinancialMetric(
    company,
    metricId,
    options.period,
    options.limit,
  );
  if (!normalized) {
    throw new FinancialApiError(
      "METRIC_UNAVAILABLE",
      `${metricId} is unavailable for ${resolved.symbol ?? `CIK${resolved.cik}`}`,
      404,
    );
  }

  return {
    catalogVersion: FINANCIAL_CATALOG_VERSION,
    ...publicIdentity(resolved, company),
    metric: metricId,
    period: options.period,
    ...publicMetric(normalized, options.includeProvenance),
    source: publicSource(resolved.cik, options.includeProvenance),
  };
}

export async function getBatchFinancialMetrics(
  identifier: string,
  metricIds: FinancialMetricId[],
  options: FinancialQueryOptions,
) {
  const { resolved, company } = await loadCompany(identifier);
  const metrics: Partial<Record<FinancialMetricId, PublicFinancialMetric>> = {};
  const errors: Partial<Record<FinancialMetricId, PublicMetricError>> = {};

  for (const metricId of metricIds) {
    const normalized = normalizeFinancialMetric(
      company,
      metricId,
      options.period,
      options.limit,
    );
    if (normalized) {
      metrics[metricId] = publicMetric(normalized, options.includeProvenance);
    } else {
      errors[metricId] = {
        code: "METRIC_UNAVAILABLE",
        message: `${metricId} is unavailable for ${resolved.symbol ?? `CIK${resolved.cik}`}`,
      };
    }
  }

  return {
    catalogVersion: FINANCIAL_CATALOG_VERSION,
    ...publicIdentity(resolved, company),
    period: options.period,
    metrics,
    ...(Object.keys(errors).length > 0 ? { errors } : {}),
    source: publicSource(resolved.cik, options.includeProvenance),
  };
}

export async function getCompanyFinancialCatalog(
  identifier: string,
  period: FinancialPeriod,
) {
  const { resolved, company } = await loadCompany(identifier);
  const metrics = financialMetricIds.flatMap((id) => {
    const normalized = normalizeFinancialMetric(company, id, period, 1);
    if (!normalized) return [];
    const definition = financialMetricCatalog[id];
    return [
      {
        id,
        label: definition.label,
        statement: definition.statement,
        unit: normalized.unit,
      },
    ];
  });

  return {
    catalogVersion: FINANCIAL_CATALOG_VERSION,
    ...publicIdentity(resolved, company),
    period,
    metrics,
    source: "SEC",
  };
}
