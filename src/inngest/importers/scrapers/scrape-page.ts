import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import fetch from "node-fetch";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { MODEL_VERSIONS } from "~/lib/model-versions";

const client = new OpenAI();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExtractedImage {
  /** Absolute URL of the image */
  src: string;
  /** Alt text from the img element */
  alt: string | null;
  /** Ordinal position in the article (0-based) */
  position: number;
}

export interface ScrapedPage {
  articleText: string;
  articleHtml: string;
  title: string | null;
  images: ExtractedImage[];
  isArticle: boolean;
  /** ISO 8601 publication date extracted from page metadata, or null if not found. */
  publishedDate: string | null;
}

// ---------------------------------------------------------------------------
// 1. Fetch HTML
// ---------------------------------------------------------------------------

const TRACKER_URL_PATTERNS = [
  /pixel/i,
  /tracker/i,
  /1x1/i,
  /beacon/i,
  /analytics/i,
  /doubleclick/i,
  /facebook\.com\/tr/i,
];

async function fetchHtmlWithPlaywright(url: string): Promise<string> {
  const { chromium } = await import("playwright-core");
  const wsEndpoint = process.env.BROWSER_WS_ENDPOINT;
  if (!wsEndpoint) {
    throw new Error("BROWSER_WS_ENDPOINT not set");
  }

  const browser = await chromium.connectOverCDP(wsEndpoint);
  try {
    const context = browser.contexts()[0] ?? (await browser.newContext());
    const page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
      return await page.content();
    } finally {
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

async function fetchHtmlWithNodeFetch(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "ExpertSystem/1.0 ArticleScraper" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`Fetch failed (${String(res.status)}): ${url}`);
  }
  return await res.text();
}

async function fetchHtml(url: string): Promise<string> {
  if (process.env.BROWSER_WS_ENDPOINT) {
    try {
      return await fetchHtmlWithPlaywright(url);
    } catch {
      // Fall back to node-fetch if Playwright fails
      return await fetchHtmlWithNodeFetch(url);
    }
  }
  return await fetchHtmlWithNodeFetch(url);
}

// ---------------------------------------------------------------------------
// 2. Readability extraction
// ---------------------------------------------------------------------------

function extractWithReadability(html: string, url: string) {
  const { document } = parseHTML(html);

  // Set the base URL so Readability can resolve relative links
  const base = document.createElement("base");
  base.setAttribute("href", url);
  document.head.appendChild(base);

  const reader = new Readability(document);
  return reader.parse();
}

// ---------------------------------------------------------------------------
// 3. Image extraction from clean HTML
// ---------------------------------------------------------------------------

function extractImages(articleHtml: string, baseUrl: string): ExtractedImage[] {
  const { document } = parseHTML(articleHtml);
  const imgElements = document.querySelectorAll("img");
  const images: ExtractedImage[] = [];

  let position = 0;
  for (const img of imgElements) {
    const rawSrc = img.getAttribute("src");
    if (!rawSrc) continue;

    // Skip data URIs
    if (rawSrc.startsWith("data:")) continue;

    // Resolve to absolute URL
    let absoluteSrc: string;
    try {
      absoluteSrc = new URL(rawSrc, baseUrl).toString();
    } catch {
      continue;
    }

    // Skip known tracker patterns
    if (TRACKER_URL_PATTERNS.some((pattern) => pattern.test(absoluteSrc))) {
      continue;
    }

    images.push({
      src: absoluteSrc,
      alt: img.getAttribute("alt") ?? null,
      position,
    });
    position++;
  }

  return images;
}

// ---------------------------------------------------------------------------
// 4. Publication date extraction from HTML metadata
// ---------------------------------------------------------------------------

function extractPublicationDate(html: string): string | null {
  const { document } = parseHTML(html);

  // JSON-LD datePublished / dateCreated
  for (const script of document.querySelectorAll(
    'script[type="application/ld+json"]',
  )) {
    try {
      const data = JSON.parse(script.textContent ?? "") as Record<
        string,
        unknown
      >;
      const raw = data.datePublished ?? data.dateCreated;
      if (typeof raw === "string") {
        const d = new Date(raw);
        if (!Number.isNaN(d.getTime())) return d.toISOString();
      }
    } catch {
      // skip malformed JSON-LD
    }
  }

  // Common <meta> tags
  const metaSelectors = [
    'meta[property="article:published_time"]',
    'meta[name="date"]',
    'meta[name="DC.date.issued"]',
    'meta[name="publication_date"]',
  ];
  for (const sel of metaSelectors) {
    const content = document.querySelector(sel)?.getAttribute("content");
    if (content) {
      const d = new Date(content);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
  }

  // First <time datetime="..."> element
  const datetime = document
    .querySelector("time[datetime]")
    ?.getAttribute("datetime");
  if (datetime) {
    const d = new Date(datetime);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }

  return null;
}

// ---------------------------------------------------------------------------
// 5. LLM QA pass
// ---------------------------------------------------------------------------

const qaSchema = z.object({
  isArticle: z
    .boolean()
    .describe(
      "True if the text is substantive article/document content. False if it is a login page, 404, paywall block, cookie wall, or other non-article content.",
    ),
});

async function qaCheck(textContent: string): Promise<boolean> {
  const snippet = textContent.slice(0, 2000);
  if (snippet.trim().length < 50) {
    return false;
  }

  const response = await client.responses.parse({
    model: MODEL_VERSIONS.economy,
    input: [
      {
        role: "system",
        content:
          "You determine whether extracted text is a real article or document. Return isArticle: true if the text contains substantive article content (news, blog post, research, speech, essay, report). Return isArticle: false if it appears to be a login page, 404 error, paywall block, cookie consent page, navigation-only content, or other non-article content.",
      },
      {
        role: "user",
        content: `Is this extracted text from a real article?\n\n${snippet}`,
      },
    ],
    text: { format: zodTextFormat(qaSchema, "article_qa") },
  });

  return response.output_parsed?.isArticle ?? false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scrape a page by URL: fetch HTML (Playwright or node-fetch), extract
 * article content with Readability, extract images, and run a light LLM QA.
 */
export async function scrapePage(url: string): Promise<ScrapedPage> {
  const html = await fetchHtml(url);
  return scrapePageFromHtml(html, url);
}

/**
 * Extract article content from raw HTML using Readability, extract images,
 * and run a light LLM QA check.
 */
export async function scrapePageFromHtml(
  html: string,
  url: string,
): Promise<ScrapedPage> {
  const parsed = extractWithReadability(html, url);

  // Extract date from raw HTML before Readability strips metadata
  const publishedDate = extractPublicationDate(html);

  if (!parsed?.textContent || !parsed.content) {
    return {
      articleText: "",
      articleHtml: "",
      title: null,
      images: [],
      isArticle: false,
      publishedDate,
    };
  }

  const articleText = parsed.textContent.trim();
  const articleHtml = parsed.content;
  const title = parsed.title?.trim() ?? null;

  const images = extractImages(articleHtml, url);
  const isArticle = await qaCheck(articleText);

  return {
    articleText,
    articleHtml,
    title,
    images,
    isArticle,
    publishedDate,
  };
}
