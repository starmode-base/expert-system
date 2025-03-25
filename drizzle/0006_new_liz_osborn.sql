CREATE TABLE "concept_embeddings" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"takeaway_id" text NOT NULL,
	"embedding" vector(1536)
);
--> statement-breakpoint
CREATE TABLE "takeaway_embeddings" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"takeaway_id" text NOT NULL,
	"embedding" vector(1536)
);
--> statement-breakpoint
ALTER TABLE "concept_embeddings" ADD CONSTRAINT "concept_embeddings_takeaway_id_takeaways_id_fk" FOREIGN KEY ("takeaway_id") REFERENCES "public"."takeaways"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "takeaway_embeddings" ADD CONSTRAINT "takeaway_embeddings_takeaway_id_takeaways_id_fk" FOREIGN KEY ("takeaway_id") REFERENCES "public"."takeaways"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conceptEmbeddingIndex" ON "concept_embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "takeawayEmbeddingIndex" ON "takeaway_embeddings" USING hnsw ("embedding" vector_cosine_ops);