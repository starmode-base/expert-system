CREATE TABLE "stock_symbols" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"symbol" text NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
DROP TABLE "stocks" CASCADE;