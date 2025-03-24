import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";
import * as cheerio from "cheerio";
import { invariant } from "@tanstack/react-router";
import { Article, saveContent } from "./save-content";
import { getArticleTags } from "~/lib/ai-helpers/tag-article";

// Define the output structure
interface RSSItem {
  title: string[];
  link: string[];
  description: string[];
  pubDate: string[];
  guid?: string[];
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

export async function scrapeScientificDaily(rssUrl: string): Promise<string[]> {
  try {
    const res = await fetch(rssUrl);
    const xml = await res.text();

    const parsed = (await parseStringPromise(xml)) as RSSFeed;
    invariant(parsed.rss.channel[0], "Invalid RSS feed");

    const items = parsed.rss.channel[0].item;

    const results: Article[] = [];

    for (const item of items.slice(0, 5)) {
      const pubDate = item.pubDate[0];
      const title = item.title[0];
      const description = item.description[0];
      const link = item.link[0];

      if (!pubDate || !title || !description || !link) {
        console.log(`Skipping item due to missing data:`, item);
        continue;
      }

      const articleText = await scrapeArticleText(link);
      const tags = await getArticleTags(description);

      results.push({ pubDate, title, description, link, articleText, tags });
    }

    return await saveContent(results);
  } catch (err) {
    console.error("Failed to parse RSS feed:", err);
    return [];
  }
}
