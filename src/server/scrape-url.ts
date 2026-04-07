import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "~/middleware/auth-middleware";
import { scrapePage } from "~/inngest/importers/scrapers/scrape-page";
import { processAndUploadImages } from "~/inngest/importers/scrapers/process-images";
import { getDocumentSummary } from "~/inngest/importers/helpers/get-document-summary";
import { db, schema } from "~/postgres/db";
import { inngest } from "~/inngest/client";

/**
 * Scrape an arbitrary URL and run the full blog-post pipeline:
 * scrape → process images → summary → save document → generate takeaways
 */
export const scrapeUrlSF = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ url: z.url() }))
  .handler(async ({ context, data }) => {
    const { url } = data;

    // 1. Scrape page
    const scraped = await scrapePage(url);

    if (!scraped.isArticle || scraped.articleText.length === 0) {
      return {
        success: false as const,
        error:
          "Could not extract article content from this URL. It may be a login page, paywall, or non-article page.",
      };
    }

    // 2. Generate summary
    const title = scraped.title ?? new URL(url).hostname;
    const summary = await getDocumentSummary(scraped.articleText, title);

    // 3. Save document
    const [doc] = await db
      .insert(schema.documents)
      .values({
        source: new URL(url).hostname,
        title,
        description: summary.summary,
        publicationDate: new Date(),
        link: url,
        articleText: scraped.articleText,
        isSubstantive: summary.isSubstantive,
      })
      .returning({ id: schema.documents.id });

    if (!doc) {
      return { success: false as const, error: "Failed to save document." };
    }

    // 4. Process and save images
    const images =
      scraped.images.length > 0
        ? await processAndUploadImages(scraped.images, doc.id)
        : [];

    if (images.length > 0) {
      await db.insert(schema.documentImages).values(
        images.map((img) => ({
          documentId: doc.id,
          blobUrl: img.blobUrl,
          altText: img.altText,
          position: img.position,
          widthPx: img.widthPx,
          heightPx: img.heightPx,
          sizeBytes: img.sizeBytes,
        })),
      );
    }

    // 5. Trigger takeaway generation (same as blog scraper)
    if (summary.isSubstantive) {
      await inngest.send({
        name: "app/generate-takeaways",
        data: {
          documentId: doc.id,
          takeawayPrompt: `- If relevant, include one concrete implication for builders/investors/operators
- If relevant, include one concrete implication for technology, business, market, etc.`,
          user: {
            id: context.viewer.id,
            email: context.viewer.email,
          },
        },
      });
    }

    return {
      success: true as const,
      documentId: doc.id,
      title,
      summary: summary.summary,
      isSubstantive: summary.isSubstantive,
      imageCount: images.length,
      textLength: scraped.articleText.length,
    };
  });
