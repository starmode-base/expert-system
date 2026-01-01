import { invariant } from "@tanstack/react-router";
import { isNotNull } from "drizzle-orm";

import { postToX } from "~/lib/post-to-x";
import { db, schema } from "~/postgres/db";

async function main() {
  const [latest] = await db.query.insights.findMany({
    where: isNotNull(schema.insights.insight),
    orderBy: (insights, { desc }) => [desc(insights.createdAt)],
    limit: 1,
  });
  invariant(latest, "No insights found to post");
  invariant(latest.insight, "No insight found to post");

  const replyLink = `https://expert-system.starmode.dev/insight/${latest.id}`;

  const result = await postToX(latest.insight, replyLink);

  console.log("Posted tweet id:", result.post.id);
  console.log("Reply tweet id:", result.reply.id);
}

main().catch((error) => {
  console.error("Failed to post latest insight", error);
  process.exit(1);
});
