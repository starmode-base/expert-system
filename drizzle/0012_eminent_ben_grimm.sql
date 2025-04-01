CREATE TABLE "insight_takeaways" (
	"insight_id" text NOT NULL,
	"takeaway_id" text NOT NULL,
	CONSTRAINT "insight_takeaways_insight_id_takeaway_id_pk" PRIMARY KEY("insight_id","takeaway_id")
);
--> statement-breakpoint
CREATE TABLE "insights" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"insight" text
);
--> statement-breakpoint
ALTER TABLE "insight_takeaways" ADD CONSTRAINT "insight_takeaways_insight_id_insights_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight_takeaways" ADD CONSTRAINT "insight_takeaways_takeaway_id_takeaways_id_fk" FOREIGN KEY ("takeaway_id") REFERENCES "public"."takeaways"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "takeaways" DROP COLUMN "novelty";--> statement-breakpoint
ALTER TABLE "takeaways" DROP COLUMN "importance";--> statement-breakpoint
ALTER TABLE "takeaways" DROP COLUMN "monetization";