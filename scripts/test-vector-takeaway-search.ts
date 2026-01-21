import { cosineDistance, desc, gt, sql } from "drizzle-orm";
import { db, schema } from "~/postgres/db";
import { generateEmbedding } from "~/postgres/generate-embedding";
import { vectorTakeawaySearch } from "~/server/vector-queries";

const query ="What is the latest news on AI in enterprise adoption and productivity?";
const iterations = Number.parseInt(process.argv[3] ?? "3", 10);

if (!Number.isFinite(iterations) || iterations < 1) {
  console.error("Iterations must be a positive number.");
  process.exit(1);
}

for (let i = 0; i < iterations; i += 1) {
  const label = `iteration-${i + 1}`;
  console.log(`\n--- ${label} ---`);

  const embedStart = Date.now();
  const embedding = await generateEmbedding(query);
  console.log(
    `Embedding OK (${label}): ${Date.now() - embedStart}ms, length=${embedding.length}`,
  );

  const drizzleStart = Date.now();
  const drizzleRows = await db.query.takeawayEmbeddings.findMany({
    with: {
      takeaway: {
        with: {
          document: true,
        },
      },
    },
    limit: 5,
  });
  console.log(
    `Drizzle query OK (${label}): ${Date.now() - drizzleStart}ms, rows=${drizzleRows.length}`,
  );

  const rawStart = Date.now();
  const rawRows = await db.execute(sql`
    select id, document_id, title
    from ${schema.takeaways}
    order by created_at desc
    limit 5
  `);
  const rawRowCount = Array.isArray(rawRows.rows) ? rawRows.rows.length : 0;
  console.log(
    `Raw SQL OK (${label}): ${Date.now() - rawStart}ms, rows=${rawRowCount}`,
  );

  const vectorStart = Date.now();
  const vectorLiteral = `[${embedding.join(",")}]`;
  const vectorSql = sql.raw(`'${vectorLiteral}'::vector`);
  const vectorRows = await db.execute(sql`
    select
      te.takeaway_id,
      t.title,
      (1 - (te.embedding <=> ${vectorSql})) as similarity
    from ${schema.takeawayEmbeddings} te
    join ${schema.takeaways} t on t.id = te.takeaway_id
    order by te.embedding <=> ${vectorSql}
    limit 5
  `);
  const vectorRowCount = Array.isArray(vectorRows.rows)
    ? vectorRows.rows.length
    : 0;
  console.log(
    `Vector SQL OK (${label}): ${Date.now() - vectorStart}ms, rows=${vectorRowCount}`,
  );

  const drizzleVectorStart = Date.now();
  const similarity = sql<number>`1 - (${cosineDistance(schema.takeawayEmbeddings.embedding, embedding)})`;
  const drizzleVectorRows = await db.query.takeawayEmbeddings.findMany({
    with: {
      takeaway: {
        with: {
          document: true,
        },
      },
    },
    where: gt(similarity, 0.2),
    orderBy: [desc(similarity)],
    limit: 5,
  });
  console.log(
    `Vector Drizzle OK (${label}): ${Date.now() - drizzleVectorStart}ms, rows=${drizzleVectorRows.length}`,
  );

  const helperStart = Date.now();
  const helperRows = await vectorTakeawaySearch(query, 10);
  console.log(
    `Vector Helper OK (${label}): ${Date.now() - helperStart}ms, rows=${helperRows.length}`,
  );
}
