-- Authorized one-time Clerk identity reset. Cascades only to user-linked data.
DELETE FROM "users";
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" text NOT NULL,
	"auth0_sid" text,
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	CONSTRAINT "auth_sessions_tokenHash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "auth_transactions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"state" text NOT NULL,
	"nonce" text NOT NULL,
	"verifier" text NOT NULL,
	"return_to" text NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revoked_mcp_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_clerkUserId_unique";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "nickname" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "auth0_subject" text NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "clerk_user_id";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_auth0Subject_unique" UNIQUE("auth0_subject");