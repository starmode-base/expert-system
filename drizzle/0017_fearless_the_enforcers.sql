DROP TABLE "insight_takeaways" CASCADE;--> statement-breakpoint
ALTER TABLE "insights" ADD COLUMN "seed_text" text;--> statement-breakpoint
ALTER TABLE "insights" ADD COLUMN "insight_prompt" text;