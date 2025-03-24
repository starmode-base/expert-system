CREATE TABLE "takeaways" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"document_id" text NOT NULL,
	"takeaway" text NOT NULL,
	"novelty" text NOT NULL,
	"importance" text NOT NULL,
	"monetization" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "tags" text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "takeaways" ADD CONSTRAINT "takeaways_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;