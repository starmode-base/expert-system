import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";
import * as cheerio from "cheerio";
import { invariant } from "@tanstack/react-router";
import { Document, saveContent } from "./save-content";
import { db } from "~/postgres/db";

// Define the output structure
interface RSSItem {
  title: string;
  source: string;
  link: string;
  description: string;
  pubDate: string;
  guid?: string;
}

interface RSSChannel {
  item: RSSItem[];
}

interface RSSFeed {
  rss: {
    channel: RSSChannel[];
  };
}

// Extract article content from linked page
async function scrapeArticleText(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    const html = await res.text();
    const $ = cheerio.load(html);

    const rawText = $("#story_text").text();

    // AI parsing not needed.
    // const text = await getArticleText(rawText);

    return rawText.trim();
  } catch (err) {
    console.error(`Failed to scrape article text from ${url}:`, err);
    return "";
  }
}

// Function to extract and filter valid RSS items
export async function extractRssItems(rssUrl: string): Promise<RSSItem[]> {
  try {
    const res = await fetch(rssUrl);
    const xml = await res.text();

    const parsed = (await parseStringPromise(xml)) as RSSFeed;
    invariant(parsed.rss.channel[0], "Invalid RSS feed");

    const items = parsed.rss.channel[0].item;

    const rssItems: RSSItem[] = [];

    for (const item of items) {
      const pubDate = item.pubDate[0];
      const title = item.title[0];
      const description = item.description[0];
      const link = item.link[0];

      if (!pubDate || !title || !description || !link) {
        console.log(`Missing data, skipping item:`, item);
        continue;
      }

      const exsists = await db.query.documents.findFirst({
        where: (documents, { eq }) => eq(documents.link, link),
      });

      if (exsists) {
        continue;
      }

      rssItems.push({
        pubDate,
        source: "ScienceDaily",
        title,
        description,
        link,
      });
    }

    return rssItems;
  } catch (err) {
    console.error("Failed to extract RSS items:", err);
    return [];
  }
}

// Function to scrape article text and tags concurrently for each RSS item
export async function scrapeLink(item: RSSItem): Promise<string | undefined> {
  try {
    const articleText = await scrapeArticleText(item.link);

    const document: Document = {
      pubDate: item.pubDate,
      source: "ScienceDaily",
      title: item.title,
      description: item.description,
      link: item.link,
      articleText,
    };

    return await saveContent(document);
  } catch (err) {
    console.error("Failed to scrape links:", err);
    return;
  }
}
