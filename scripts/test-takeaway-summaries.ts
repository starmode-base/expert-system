import { db } from "~/postgres/db";
import { getSummary } from "~/inngest/takeaways/helpers/get-summary";

const limit = Number.parseInt(process.argv[2] ?? "5", 10);

if (!Number.isFinite(limit) || limit < 1) {
  console.error("Limit must be a positive number.");
  process.exit(1);
}

const takeaways = await db.query.takeaways.findMany({
  columns: { id: true, title: true, takeaway: true },
  orderBy: (takeaways, { desc }) => [desc(takeaways.createdAt)],
  limit,
});

if (takeaways.length === 0) {
  console.log("No takeaways found.");
  process.exit(0);
}

for (const [index, takeaway] of takeaways.entries()) {
  const text = takeaway.takeaway;
  const label = `takeaway-${index + 1}`;

  console.log(`\n--- ${label} ---`);
  console.log(`Id: ${takeaway.id}`);
  console.log(`Title: ${takeaway.title}`);
  console.log(`Input: ${text}`);

  const startedAt = Date.now();
  const summary = await getSummary(text);
  const elapsedMs = Date.now() - startedAt;

  console.log(`Summary: ${summary.summary}`);
  console.log(`Retrieval summary: ${summary.retrieval_summary}`);
  console.log(`Elapsed: ${elapsedMs}ms`);
}
