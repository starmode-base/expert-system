/**
 * Quick test script for the new scraper + image pipeline.
 *
 * Usage:
 *   bun run scripts/test-scrape.ts <url>
 *
 * Example:
 *   bun run scripts/test-scrape.ts https://example.com/some-article
 */

import { scrapePage } from "~/inngest/importers/scrapers/scrape-page";
import { processAndUploadImages } from "~/inngest/importers/scrapers/process-images";

const url = process.argv[2];
if (!url) {
  console.error("Usage: bun run scripts/test-scrape.ts <url>");
  process.exit(1);
}

console.log(`\nScraping: ${url}\n`);

const result = await scrapePage(url);

console.log("--- Scrape Result ---");
console.log(`Title:      ${result.title ?? "(none)"}`);
console.log(`Is Article: ${String(result.isArticle)}`);
console.log(`Text:       ${String(result.articleText.length)} chars`);
console.log(`Images:     ${String(result.images.length)} found`);

if (result.articleText.length > 0) {
  console.log(`\n--- First 500 chars ---`);
  console.log(result.articleText.slice(0, 500));
}

if (result.images.length > 0) {
  console.log(`\n--- Images ---`);
  for (const img of result.images) {
    console.log(
      `  [${String(img.position)}] ${img.src.slice(0, 80)}${img.src.length > 80 ? "..." : ""}`,
    );
    if (img.alt) console.log(`       alt: ${img.alt}`);
  }

  console.log(`\n--- Processing & uploading images to Vercel Blob ---`);
  const processed = await processAndUploadImages(result.images, "test-scrape");
  console.log(`Uploaded ${String(processed.length)} images:`);
  for (const img of processed) {
    console.log(
      `  [${String(img.position)}] ${img.widthPx}x${img.heightPx} (${String(Math.round(img.sizeBytes / 1024))}KB) → ${img.blobUrl}`,
    );
  }
}

console.log("\nDone.");
