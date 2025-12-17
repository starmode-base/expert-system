CREATE TABLE "insight_references" (
	"insight_id" text NOT NULL,
	"insight_reference_number" integer NOT NULL,
	"reference_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "insight_references_insight_id_reference_id_pk" PRIMARY KEY("insight_id","reference_id")
);
--> statement-breakpoint
ALTER TABLE "insight_references" ADD CONSTRAINT "insight_references_insight_id_insights_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight_references" ADD CONSTRAINT "insight_references_reference_id_takeaway_references_id_fk" FOREIGN KEY ("reference_id") REFERENCES "public"."takeaway_references"("id") ON DELETE cascade ON UPDATE no action;