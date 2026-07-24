CREATE TABLE "earnings_api_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"endpoint" text NOT NULL,
	"status" integer
);
--> statement-breakpoint
ALTER TABLE "tracked_stocks" ADD COLUMN "hydration_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "tracked_stocks" ADD COLUMN "hydration_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tracked_stocks" ADD COLUMN "hydration_last_error" text;--> statement-breakpoint
ALTER TABLE "tracked_stocks" ADD COLUMN "hydration_next_attempt_at" timestamp;--> statement-breakpoint
ALTER TABLE "tracked_stocks" ADD COLUMN "hydrated_at" timestamp;--> statement-breakpoint
UPDATE "tracked_stocks" ts
SET
	"hydration_status" = 'complete',
	"hydrated_at" = coalesce(
		(
			SELECT max(ec."updated_at")
			FROM "earnings_calls" ec
			WHERE ec."tracked_stock_id" = ts."id"
		),
		now()
	)
WHERE EXISTS (
	SELECT 1
	FROM "earnings_calls" ec
	WHERE ec."tracked_stock_id" = ts."id"
);--> statement-breakpoint
CREATE INDEX "earnings_api_requests_created_idx" ON "earnings_api_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "tracked_stocks_hydration_idx" ON "tracked_stocks" USING btree ("active","hydration_status","hydration_next_attempt_at");
