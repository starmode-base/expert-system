CREATE TABLE "stock_symbol_embeddings" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"stock_symbol_id" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	CONSTRAINT "stock_symbol_embeddings_stockSymbolId_unique" UNIQUE("stock_symbol_id")
);
--> statement-breakpoint
ALTER TABLE "stock_symbol_embeddings" ADD CONSTRAINT "stock_symbol_embeddings_stock_symbol_id_stock_symbols_id_fk" FOREIGN KEY ("stock_symbol_id") REFERENCES "public"."stock_symbols"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stockSymbolEmbeddingIndex" ON "stock_symbol_embeddings" USING hnsw ("embedding" vector_cosine_ops);