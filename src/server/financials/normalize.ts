import { z } from "zod";
import {
  financialMetricCatalog,
  type FinancialMetricDefinition,
  type FinancialMetricId,
  type FinancialUnitClass,
} from "./catalog";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const secFactSchema = z.object({
  start: isoDateSchema.optional(),
  end: isoDateSchema,
  val: z.number(),
  accn: z.string(),
  fy: z.number().nullable().optional(),
  fp: z.string().nullable().optional(),
  form: z.string(),
  filed: isoDateSchema,
  frame: z.string().optional(),
});

const secConceptSchema = z.object({
  label: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  units: z.record(z.string(), z.array(secFactSchema)),
});

export const secCompanyFactsSchema = z.object({
  cik: z.number(),
  entityName: z.string(),
  facts: z.object({
    "us-gaap": z.record(z.string(), secConceptSchema).default({}),
  }),
});

export type SecCompanyFacts = z.infer<typeof secCompanyFactsSchema>;
type SecFact = z.infer<typeof secFactSchema>;
type SecConcept = z.infer<typeof secConceptSchema>;

export type FinancialPeriod = "annual" | "quarterly";
export type FinancialPeriodType =
  | "instant"
  | "quarter"
  | "yearToDate"
  | "annual";

export interface NormalizedFinancialObservation {
  date: string;
  value: number;
  periodType: FinancialPeriodType;
  start?: string;
  filed: string;
  form: string;
  accession: string;
  concept: string;
}

export interface NormalizedFinancialMetric {
  unit: string;
  data: NormalizedFinancialObservation[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function durationDays(fact: SecFact): number | undefined {
  if (!fact.start) return undefined;
  const start = Date.parse(`${fact.start}T00:00:00Z`);
  const end = Date.parse(`${fact.end}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return undefined;
  }
  return Math.round((end - start) / DAY_MS) + 1;
}

function classifyFact(
  fact: SecFact,
  definition: FinancialMetricDefinition,
  period: FinancialPeriod,
): FinancialPeriodType | undefined {
  const annualForm = fact.form === "10-K" || fact.form === "10-K/A";
  const quarterlyForm = fact.form === "10-Q" || fact.form === "10-Q/A";

  if (period === "annual" && !annualForm) return undefined;
  if (period === "quarterly" && !quarterlyForm) return undefined;

  if (definition.factType === "instant") {
    return fact.start === undefined ? "instant" : undefined;
  }

  const days = durationDays(fact);
  if (days === undefined) return undefined;

  if (period === "annual") {
    return days >= 300 && days <= 430 ? "annual" : undefined;
  }

  if (definition.statement !== "cashFlow") {
    return days >= 60 && days <= 120 ? "quarter" : undefined;
  }

  if (days >= 60 && days <= 120) return "quarter";
  if (days > 120 && days <= 310) return "yearToDate";
  return undefined;
}

function unitPriority(unit: string, unitClass: FinancialUnitClass): number {
  if (unitClass === "monetary") {
    if (unit === "USD") return 0;
    return /^[A-Z]{3}$/.test(unit) ? 1 : Number.POSITIVE_INFINITY;
  }

  if (unit === "USD/shares") return 0;
  return /^[A-Z]{3}\/shares$/.test(unit) ? 1 : Number.POSITIVE_INFINITY;
}

function orderedUnits(
  concept: SecConcept,
  unitClass: FinancialUnitClass,
): [string, SecFact[]][] {
  return Object.entries(concept.units)
    .filter(([unit]) => Number.isFinite(unitPriority(unit, unitClass)))
    .sort(([left], [right]) => {
      const priorityDifference =
        unitPriority(left, unitClass) - unitPriority(right, unitClass);
      return priorityDifference || left.localeCompare(right);
    });
}

function isNewerFact(candidate: SecFact, existing: SecFact): boolean {
  const filedComparison = candidate.filed.localeCompare(existing.filed);
  if (filedComparison !== 0) return filedComparison > 0;
  return candidate.accn.localeCompare(existing.accn) > 0;
}

function selectFacts(
  facts: SecFact[],
  concept: string,
  definition: FinancialMetricDefinition,
  period: FinancialPeriod,
  limit: number,
): NormalizedFinancialObservation[] {
  const latestBySpan = new Map<
    string,
    { fact: SecFact; periodType: FinancialPeriodType }
  >();

  for (const fact of facts) {
    const periodType = classifyFact(fact, definition, period);
    if (!periodType) continue;
    const spanKey = `${fact.start ?? "instant"}:${fact.end}`;
    const existing = latestBySpan.get(spanKey);
    if (!existing || isNewerFact(fact, existing.fact)) {
      latestBySpan.set(spanKey, { fact, periodType });
    }
  }

  let selected = [...latestBySpan.values()];

  if (definition.statement === "cashFlow" && period === "quarterly") {
    const preferredByEnd = new Map<
      string,
      { fact: SecFact; periodType: FinancialPeriodType }
    >();
    for (const candidate of selected) {
      const existing = preferredByEnd.get(candidate.fact.end);
      if (
        !existing ||
        (candidate.periodType === "quarter" &&
          existing.periodType === "yearToDate") ||
        (candidate.periodType === existing.periodType &&
          isNewerFact(candidate.fact, existing.fact))
      ) {
        preferredByEnd.set(candidate.fact.end, candidate);
      }
    }
    selected = [...preferredByEnd.values()];
  }

  return selected
    .sort((left, right) => {
      const endComparison = right.fact.end.localeCompare(left.fact.end);
      if (endComparison !== 0) return endComparison;
      return (right.fact.start ?? "").localeCompare(left.fact.start ?? "");
    })
    .slice(0, limit)
    .map(({ fact, periodType }) => ({
      date: fact.end,
      value: fact.val,
      periodType,
      ...(periodType === "yearToDate" && fact.start
        ? { start: fact.start }
        : {}),
      filed: fact.filed,
      form: fact.form,
      accession: fact.accn,
      concept,
    }));
}

export function normalizeFinancialMetric(
  company: SecCompanyFacts,
  metricId: FinancialMetricId,
  period: FinancialPeriod,
  limit: number,
): NormalizedFinancialMetric | undefined {
  const definition = financialMetricCatalog[metricId];
  const concepts = company.facts["us-gaap"];

  for (const conceptName of definition.concepts) {
    const concept = concepts[conceptName];
    if (!concept) continue;

    for (const [unit, facts] of orderedUnits(concept, definition.unitClass)) {
      const data = selectFacts(facts, conceptName, definition, period, limit);
      if (data.length > 0) return { unit, data };
    }
  }

  return undefined;
}
