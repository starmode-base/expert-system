CREATE TABLE "document_images" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"document_id" text NOT NULL,
	"blob_url" text NOT NULL,
	"alt_text" text,
	"position" integer NOT NULL,
	"width_px" integer,
	"height_px" integer,
	"size_bytes" integer
);
--> statement-breakpoint
ALTER TABLE "document_images" ADD CONSTRAINT "document_images_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;