import { db, schema } from "~/postgres/db";
import { eq, inArray } from "drizzle-orm";
import { buildTakeawayPreviews } from "~/inngest/insights/insight-prompts";
import { vectorTakeawaySearchTimeWeighted } from "~/server/vector-queries";

// ------------------------------------------------------------
// TOOLS
// ------------------------------------------------------------

/**
 * Arguments for {@link fetchTakeawayPreviews}
 */
export interface FetchTakeawayPreviewsArgs {
  query: string;
  count: number;
}

function normalizeTakeawayCount(count: number | undefined) {
  if (typeof count !== "number" || !Number.isFinite(count)) {
    return 5;
  }

  return Math.max(1, Math.min(20, Math.floor(count)));
}

/**
 * Fetch up to 10 relevant time-weighted takeaway previews via vector search
 *
 * This tool is intended for quickly expanding context (summaries only), not for
 * retrieving full takeaway bodies or references.
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
    Source: ${takeaway.document.source}
    Source Document Title: ${takeaway.document.title}
    Key Takeaway:
    ${takeaway.takeaway},
    Takeaway ID: ${takeaway.id}
    Takeaway References: ${takeaway.takeawayReferences.map((reference) => `${reference.referenceNumber}. (reference_id: ${reference.id}) ${reference.reference}`).join("\n")}
`;
}



export async function fetchFormattedTakeawaysByIds(args: {
  ids: string[];
}){
  const dateFormatter = new Intl.DateTimeFormat("en-US");

  const takeaways = await db.query.takeaways.findMany({
    where: inArray(schema.takeaways.id, args.ids),
    with: {
      document: true,
      takeawayReferences: true,
    },
  });

  const formattedTakeaways = takeaways
    .map(
      (takeaway) => `
  ${takeaway.title}
  Takeaway ID: ${takeaway.id}
  Publication Date: ${dateFormatter.format(new Date(takeaway.document.publicationDate))}
  Source: ${takeaway.document.source}
  Source Document Title: ${takeaway.document.title}
  Key Takeaway:
  ${takeaway.summary}
  `,
    )
    .join("\n------\n");

  return formattedTakeaways;
}
