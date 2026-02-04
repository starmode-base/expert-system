CREATE TABLE "x_bookmarks_auth" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"x_user_id" text NOT NULL,
	"refresh_token" text NOT NULL,
	"access_token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"last_sync_cursor" text,
	"selected_folder_id" text,
	"selected_folder_name" text
);
--> statement-breakpoint
ALTER TABLE "x_bookmarks_auth" ADD CONSTRAINT "x_bookmarks_auth_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;