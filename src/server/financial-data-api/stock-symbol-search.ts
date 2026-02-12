import { asc, cosineDistance, sql } from "drizzle-orm";
import { cosineSimilarity } from "~/lib/vector-similarity";
import { db, schema } from "~/postgres/db";
import { generateEmbedding } from "~/postgres/generate-embedding";

export async function vectorStockSymbolSearch(searchInput: string, limit = 10) {
  const searchEmbedding = await generateEmbedding(searchInput);
  const distance = sql<number>`${cosineDistance(schema.stockSymbolEmbeddings.embedding, searchEmbedding)}`;

  const similarSymbols = await db.query.stockSymbolEmbeddings.findMany({
    with: {
      stockSymbol: true,
    },
    orderBy: [asc(distance)],
    limit,
  });

  return similarSymbols.map((row) => ({
    id: row.stockSymbol.id,
    symbol: row.stockSymbol.symbol,
    name: row.stockSymbol.name,
    description: row.stockSymbol.description,
    sector: row.stockSymbol.sector,
    industry: row.stockSymbol.industry,
    similarity: cosineSimilarity(searchEmbedding, row.embedding),
  }));
}
