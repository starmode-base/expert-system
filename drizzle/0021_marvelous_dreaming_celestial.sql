CREATE TABLE "blogs" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"xml_url" text NOT NULL,
	"html_url" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"content_in_feed" boolean DEFAULT false NOT NULL,
	"last_scraped_at" timestamp,
	CONSTRAINT "blogs_xmlUrl_unique" UNIQUE("xml_url")
);
