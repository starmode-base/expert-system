import { vectorTakeawaySearch } from "~/server/vector-queries";
import { db, schema } from "~/postgres/db";
import { eq } from "drizzle-orm";
import { buildTakeawayPreviews } from "~/inngest/functions/generate-insight";

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

/**
 * Compute a recency weight (0..1) to down-rank older content
 *
 * The curve is an S-shape that declines over ~3 months and clamps to [0, 1].
 * If the publication date is invalid, returns 1 to avoid accidental suppression.
 */
function computeRecencyWeight(
  publicationDate: Date | string,
  now = new Date(),
) {
  const publishedAt =
    publicationDate instanceof Date
      ? publicationDate
      : new Date(publicationDate);

  const publishedAtMs = publishedAt.getTime();
  if (Number.isNaN(publishedAtMs)) {
    return 1;
  }

  const ageMs = Math.max(0, now.getTime() - publishedAtMs);
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  // S-curve that declines over ~3 months
  const threeMonthsDays = 90;
  const midpointDays = threeMonthsDays / 2;
  const k = Math.log(99) / midpointDays;

  const weight = 1 / (1 + Math.exp(k * (ageDays - midpointDays)));
  return Math.max(0, Math.min(1, weight));
}

// ------------------------------------------------------------
// TOOLS
// ------------------------------------------------------------

/**
 * Arguments for {@link fetchTakeawayPreviews}
 */
export interface FetchTakeawayPreviewsArgs {
  query: string;
  timeWeighted?: boolean;
  count?: number;
}

function normalizeTakeawayCount(count: number | undefined) {
  if (typeof count !== "number" || !Number.isFinite(count)) {
    return 5;
  }

  return Math.max(1, Math.min(20, Math.floor(count)));
}

/**
 * Fetch up to 10 relevant takeaway previews via vector search
 *
 * This tool is intended for quickly expanding context (summaries only), not for
 * retrieving full takeaway bodies or references.
 *
 * - If `timeWeighted` is omitted or true, results are re-ranked to prefer newer sources.
 * - If `timeWeighted` is false, results are returned in pure similarity order.
 *
 * Returns a single formatted preview string (title, publication date, source, summary)
 * for each takeaway, separated by `------`.
 */
export async function fetchTakeawayPreviews(args: FetchTakeawayPreviewsArgs) {
  const count = normalizeTakeawayCount(args.count);
  const takeaways = await vectorTakeawaySearch(args.query);

  if (args.timeWeighted === false) {
    return buildTakeawayPreviews(takeaways.slice(0, count));
  }

  const now = new Date();
  const weightedTakeaways = takeaways
    .map((takeaway) => {
      const recencyWeight = computeRecencyWeight(takeaway.publicationDate, now);
      const weightedSimilarity = takeaway.similarity * recencyWeight;

      return {
        ...takeaway,
        similarity: weightedSimilarity,
      };
    })
    .sort((a, b) => b.similarity - a.similarity);

  return buildTakeawayPreviews(weightedTakeaways.slice(0, count));
}

/**
 * Fetch a single takeaway by id, formatted for use in an LLM prompt
 *
 * Returns a formatted string containing the takeaway title, publication date, source,
 * full takeaway text, takeaway id, and the full list of references (including each `reference_id`).
 * Returns null if `id` is missing or the takeaway cannot be found.
 */
export async function fetchTakeawayById(args: { id: string }) {
  if (!args.id) {
    console.log("***** NO ID");
    console.log("ARGS", args);
    return null;
  }

  const takeaway = await db.query.takeaways.findFirst({
    where: eq(schema.takeaways.id, args.id),
    with: {
      category: true,
      document: true,
      takeawayReferences: true,
    },
  });

  if (!takeaway) {
    console.log("***** NO TAKEAWAY");
    return null;
  }

  console.log("***** FETCH TAKEAWAY BY ID TOOL - TAKEAWAY", takeaway.title);

  return `
    ${takeaway.title}
    Publication Date: ${takeaway.document.publicationDate.toISOString()}
    Source: ${takeaway.document.source}
    Key Takeaway:
    ${takeaway.takeaway},
    Takeaway ID: ${takeaway.id}
    Takeaway References: ${takeaway.takeawayReferences.map((reference) => `${reference.referenceNumber}. (reference_id: ${reference.id}) ${reference.reference}`).join("\n")}
`;
}

export function buildFinalInsight(args: {
  insight: string;
  key_arguments: string;
  references_ids: string[];
}) {
  return `
    Core Insight: ${args.insight}
    Key Arguments: ${args.key_arguments}
    References: ${args.references_ids.map((reference_id) => `(reference_id: ${reference_id})`).join("\n")}
  `;
}
