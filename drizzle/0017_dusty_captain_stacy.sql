ALTER TABLE "insight_takeaways" ADD COLUMN "type" text NOT NULL;--> statement-breakpoint
ALTER TABLE "insights" ADD COLUMN "seed_text" text;--> statement-breakpoint
ALTER TABLE "insights" ADD COLUMN "insight_prompt" text;