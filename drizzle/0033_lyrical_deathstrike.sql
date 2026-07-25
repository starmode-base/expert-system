CREATE TABLE "x_bookmark_items" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"x_post_id" text NOT NULL,
	"status" text DEFAULT 'discovered' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"discovered_at" timestamp DEFAULT now() NOT NULL,
	"document_id" text,
	CONSTRAINT "x_bookmark_items_user_post_unique" UNIQUE("user_id","x_post_id")
);
--> statement-breakpoint
CREATE TABLE "x_bookmark_sync_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"trigger" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"checkpoint" text,
	"discovered_count" integer DEFAULT 0 NOT NULL,
	"imported_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "x_bookmark_items" ADD CONSTRAINT "x_bookmark_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "x_bookmark_items" ADD CONSTRAINT "x_bookmark_items_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "x_bookmark_sync_runs" ADD CONSTRAINT "x_bookmark_sync_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "x_bookmark_items_user_status_idx" ON "x_bookmark_items" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "x_bookmark_sync_runs_user_created_idx" ON "x_bookmark_sync_runs" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "x_bookmarks_auth" ADD CONSTRAINT "x_bookmarks_auth_userId_unique" UNIQUE("user_id");