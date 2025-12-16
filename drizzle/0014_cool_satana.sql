CREATE TABLE "takeaway_references" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"takeaway_id" text NOT NULL,
	"reference_number" integer NOT NULL,
	"reference" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "takeaways" ADD COLUMN "summary" text NOT NULL;--> statement-breakpoint
ALTER TABLE "takeaway_references" ADD CONSTRAINT "takeaway_references_takeaway_id_takeaways_id_fk" FOREIGN KEY ("takeaway_id") REFERENCES "public"."takeaways"("id") ON DELETE cascade ON UPDATE no action;