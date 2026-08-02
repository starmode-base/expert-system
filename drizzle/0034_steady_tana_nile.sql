CREATE TABLE "sec_company_facts_cache" (
	"cik" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"fetched_at" timestamp NOT NULL
);
