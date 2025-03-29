ALTER TABLE "documents" RENAME COLUMN "articleText" TO "article_text";--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "publication_date" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "takeaways" ADD COLUMN "title" text NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" DROP COLUMN "pubDate";