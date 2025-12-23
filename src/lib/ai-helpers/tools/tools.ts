import { db, schema } from "~/postgres/db";
import { eq } from "drizzle-orm";
import { buildTakeawayPreviews } from "~/inngest/functions/generate-insight";
import { vectorTakeawaySearchTimeWeighted } from "~/server/vector-queries";

// ------------------------------------------------------------
// TOOLS
// ------------------------------------------------------------

/**
 * Arguments for {@link fetchTakeawayPreviews}
 */
export interface FetchTakeawayPreviewsArgs {
  query: string;
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
  const takeaways = await vectorTakeawaySearchTimeWeighted(args.query, {
    limit: count,
    halfLifeDays: 90, // 3 months relevance half life
  });

  return buildTakeawayPreviews(takeaways);
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
    Source: ${takeaway.document.title} - ${takeaway.document.source}
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
