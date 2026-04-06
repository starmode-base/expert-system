import { put } from "@vercel/blob";
import fetch from "node-fetch";
import sharp from "sharp";
import type { ExtractedImage } from "./scrape-page";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProcessedImage {
  blobUrl: string;
  altText: string | null;
  position: number;
  widthPx: number;
  heightPx: number;
  sizeBytes: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_IMAGES = 8;
const MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
const DOWNLOAD_TIMEOUT_MS = 10_000;
const MIN_DIMENSION_PX = 100;
const MIN_SIZE_BYTES = 5 * 1024; // 5 KB
const MAX_ASPECT_RATIO = 10;
const MAX_WIDTH_PX = 1200;
const WEBP_QUALITY = 80;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function downloadImage(
  src: string,
): Promise<{ buffer: Buffer; contentType: string | null } | null> {
  try {
    const res = await fetch(src, {
      headers: { "User-Agent": "ExpertSystem/1.0 ImageFetcher" },
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });

    if (!res.ok) return null;

    const contentLength = res.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_DOWNLOAD_BYTES) {
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_DOWNLOAD_BYTES) return null;

    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: res.headers.get("content-type"),
    };
  } catch {
    return null;
  }
}

function isJunkImage(
  width: number,
  height: number,
  sizeBytes: number,
): boolean {
  if (width < MIN_DIMENSION_PX || height < MIN_DIMENSION_PX) return true;
  if (sizeBytes < MIN_SIZE_BYTES) return true;

  const aspectRatio = Math.max(width / height, height / width);
  if (aspectRatio > MAX_ASPECT_RATIO) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Download, filter, process, and upload article images to Vercel Blob.
 * Processes images sequentially to control memory usage.
 * Returns at most MAX_IMAGES processed images.
 */
export async function processAndUploadImages(
  images: ExtractedImage[],
  documentId: string,
): Promise<ProcessedImage[]> {
  const results: ProcessedImage[] = [];

  // Take only the first N candidates to avoid excessive downloads
  const candidates = images.slice(0, MAX_IMAGES * 2);

  for (const image of candidates) {
    if (results.length >= MAX_IMAGES) break;

    const downloaded = await downloadImage(image.src);
    if (!downloaded) continue;

    // Get metadata to check dimensions
    let metadata: sharp.Metadata;
    try {
      metadata = await sharp(downloaded.buffer).metadata();
    } catch {
      continue; // Not a valid image
    }

    if (!metadata.width || !metadata.height) continue;
    if (
      isJunkImage(metadata.width, metadata.height, downloaded.buffer.byteLength)
    )
      continue;

    // Process: resize + convert to webp
    const processed = await sharp(downloaded.buffer)
      .resize({ width: MAX_WIDTH_PX, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    const processedMeta = await sharp(processed).metadata();
    const finalWidth = processedMeta.width
      ? processedMeta.width
      : metadata.width;
    const finalHeight = processedMeta.height
      ? processedMeta.height
      : metadata.height;

    // Upload to Vercel Blob
    const blob = await put(
      `documents/${documentId}/${String(image.position)}.webp`,
      processed,
      {
        access: "public",
        contentType: "image/webp",
      },
    );

    results.push({
      blobUrl: blob.url,
      altText: image.alt,
      position: image.position,
      widthPx: finalWidth,
      heightPx: finalHeight,
      sizeBytes: processed.byteLength,
    });
  }

  return results;
}
