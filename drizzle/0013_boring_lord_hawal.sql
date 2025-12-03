CREATE TABLE "earnings_fetch_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"earnings_schedule_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"processed_at" timestamp,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "earnings_schedule" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"symbol" text NOT NULL,
	"name" text NOT NULL,
	"report_date" timestamp NOT NULL,
	"fiscal_date_ending" text NOT NULL,
	"estimate" double precision,
	"currency" text,
	CONSTRAINT "earnings_schedule_symbol_fiscalDateEnding_unique" UNIQUE("symbol","fiscal_date_ending")
);
--> statement-breakpoint
CREATE TABLE "tracked_companies" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"stock_symbol_id" text NOT NULL,
	CONSTRAINT "tracked_companies_userId_stockSymbolId_unique" UNIQUE("user_id","stock_symbol_id")
);
--> statement-breakpoint
ALTER TABLE "earnings_fetch_jobs" ADD CONSTRAINT "earnings_fetch_jobs_earnings_schedule_id_earnings_schedule_id_fk" FOREIGN KEY ("earnings_schedule_id") REFERENCES "public"."earnings_schedule"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracked_companies" ADD CONSTRAINT "tracked_companies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracked_companies" ADD CONSTRAINT "tracked_companies_stock_symbol_id_stock_symbols_id_fk" FOREIGN KEY ("stock_symbol_id") REFERENCES "public"."stock_symbols"("id") ON DELETE cascade ON UPDATE no action;