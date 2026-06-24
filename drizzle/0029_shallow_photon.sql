CREATE TABLE "earnings_calls" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"provider_call_id" integer NOT NULL,
	"tracked_stock_id" text NOT NULL,
	"transcript_title" text NOT NULL,
	"event_type" text NOT NULL,
	"event_date_time" timestamp NOT NULL,
	"provider_added_at" timestamp NOT NULL,
	"sector" text,
	"industry" text,
	"duration_seconds" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"document_id" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"takeaways_queued_at" timestamp,
	CONSTRAINT "earnings_calls_providerCallId_unique" UNIQUE("provider_call_id"),
	CONSTRAINT "earnings_calls_documentId_unique" UNIQUE("document_id")
);
--> statement-breakpoint
CREATE TABLE "earnings_company_catalog" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"symbol" text NOT NULL,
	"company_name" text NOT NULL,
	"sector" text,
	"industry" text,
	"exchange" text NOT NULL,
	"country" text NOT NULL,
	"mic" text NOT NULL,
	"market_cap" bigint,
	"call_count" integer NOT NULL,
	"latest_call_at" timestamp,
	"earliest_call_at" timestamp,
	"catalog_synced_at" timestamp NOT NULL,
	"sync_run_id" text NOT NULL,
	CONSTRAINT "earnings_company_catalog_symbol_mic_unique" UNIQUE("symbol","mic")
);
--> statement-breakpoint
CREATE TABLE "earnings_sync_state" (
	"provider" text PRIMARY KEY NOT NULL,
	"after_id" integer NOT NULL,
	"last_polled_at" timestamp,
	"last_successful_sync_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracked_stocks" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"symbol" text NOT NULL,
	"company_name" text NOT NULL,
	"exchange" text NOT NULL,
	"mic" text NOT NULL,
	"country" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "tracked_stocks_symbol_mic_unique" UNIQUE("symbol","mic")
);
--> statement-breakpoint
ALTER TABLE "earnings_fetch_jobs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "earnings_schedule" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "stock_symbol_embeddings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tracked_companies" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "earnings_fetch_jobs" CASCADE;--> statement-breakpoint
DROP TABLE "earnings_schedule" CASCADE;--> statement-breakpoint
DROP TABLE "stock_symbol_embeddings" CASCADE;--> statement-breakpoint
DROP TABLE "tracked_companies" CASCADE;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "earnings_calls" ADD CONSTRAINT "earnings_calls_tracked_stock_id_tracked_stocks_id_fk" FOREIGN KEY ("tracked_stock_id") REFERENCES "public"."tracked_stocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earnings_calls" ADD CONSTRAINT "earnings_calls_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "earnings_calls_status_idx" ON "earnings_calls" USING btree ("status");--> statement-breakpoint
CREATE INDEX "earnings_calls_stock_date_idx" ON "earnings_calls" USING btree ("tracked_stock_id","event_date_time");--> statement-breakpoint
CREATE INDEX "earnings_company_catalog_name_idx" ON "earnings_company_catalog" USING btree ("company_name");--> statement-breakpoint
CREATE INDEX "earnings_company_catalog_symbol_idx" ON "earnings_company_catalog" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "earnings_company_catalog_market_cap_idx" ON "earnings_company_catalog" USING btree ("market_cap");--> statement-breakpoint
ALTER TABLE "stock_symbols" DROP COLUMN "overview_fetched_at";--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_externalId_unique" UNIQUE("external_id");