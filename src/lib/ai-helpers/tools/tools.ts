import { vectorTakeawaySearch } from "~/server/vector-queries";
import { db, schema } from "~/postgres/db";
import { eq } from "drizzle-orm";

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

export interface FetchTakeawaysArgs {
  query: string;
  timeWeighted?: boolean;
}

export async function fetchTakeaways(args: FetchTakeawaysArgs) {
  const takeaways = await vectorTakeawaySearch(args.query, 10);

  if (args.timeWeighted === false) {
    return takeaways;
  }

  const now = new Date();
  const weightedTakeaways = takeaways
    .map((takeaway) => {
      const recencyWeight = computeRecencyWeight(takeaway.publicationDate, now);
      const weightedSimilarity = takeaway.similarity * recencyWeight;

      return {
        ...takeaway,
        similarity: weightedSimilarity,
        unweightedSimilarity: takeaway.similarity,
        recencyWeight,
      };
    })
    .sort((a, b) => b.similarity - a.similarity);

  return weightedTakeaways;
}

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

  console.log("***** TAKEAWAY", takeaway.title);

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
