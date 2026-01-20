import { invariant } from "@tanstack/react-router";
import { inArray } from "drizzle-orm";

import { db, schema } from "~/postgres/db";
import { generateEmbedding } from "~/postgres/generate-embedding";

const documentIds = [
  "eku0Tv96HnWhHNfZMzRxC3Im",
  "Quk01SxI3hJRNJrQI9s1uGdK",
  "2nKsSNPn5dvZmA5DxZIMgjpH",
  "qFxV0eGDP2UPxyWBQLVuRg96",
];

async function main() {
  const takeaways = await db.query.takeaways.findMany({
    where: inArray(schema.takeaways.documentId, documentIds),
    columns: {
      id: true,
      summary: true,
      concept: true,
      documentId: true,
    },
  });

  if (takeaways.length === 0) {
    console.log("No takeaways found for provided document ids");
    return;
  }

  const takeawayIds = takeaways.map((takeaway) => takeaway.id);

  await db.transaction(async (tx) => {
    await tx
      .delete(schema.takeawayEmbeddings)
      .where(inArray(schema.takeawayEmbeddings.takeawayId, takeawayIds));
    await tx
      .delete(schema.conceptEmbeddings)
      .where(inArray(schema.conceptEmbeddings.takeawayId, takeawayIds));
  });

  for (const takeaway of takeaways) {
    invariant(takeaway.summary, `Missing summary for ${takeaway.id}`);
    invariant(takeaway.concept, `Missing concept for ${takeaway.id}`);

    console.log(`Generating takeaway embedding for ${takeaway.id}`);
    const takeawayEmbedding = await generateEmbedding(takeaway.summary);

    await db
      .insert(schema.takeawayEmbeddings)
      .values({
        takeawayId: takeaway.id,
        embedding: takeawayEmbedding,
      })
      .onConflictDoUpdate({
        target: schema.takeawayEmbeddings.takeawayId,
        set: { embedding: takeawayEmbedding },
      });

    console.log(`Generating concept embedding for ${takeaway.id}`);
    const conceptEmbedding = await generateEmbedding(takeaway.concept);

    await db
      .insert(schema.conceptEmbeddings)
      .values({
        takeawayId: takeaway.id,
        embedding: conceptEmbedding,
      })
      .onConflictDoUpdate({
        target: schema.conceptEmbeddings.takeawayId,
        set: { embedding: conceptEmbedding },
      });
  }

  console.log(`Regenerated embeddings for ${takeaways.length} takeaways`);
}

main().catch((error) => {
  console.error("Failed to regenerate takeaway embeddings", error);
  process.exit(1);
});
