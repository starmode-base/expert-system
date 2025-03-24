import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";
import * as cheerio from "cheerio";
import { invariant } from "@tanstack/react-router";
import { db } from "~/postgres/db";
import { documents } from "~/postgres/schema";

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

interface Article {
  pubDate: string;
  title: string;
  description: string;
  link: string;
  articleText: string;
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

async function saveResults(articles: Article[]) {
  const userId = "JfdOiPJhx9FnAarLLOKi6JOO";
  const organizationId = "Org1";

  await db.insert(documents).values(
    articles.map((article) => ({
      userId,
      organizationId,
      title: article.title,
      description: article.description,
      pubDate: article.pubDate,
      link: article.link,
      articleText: article.articleText,
    })),
  );
}

export async function scrapeRSSFeed(rssUrl: string): Promise<Article[]> {
  try {
    const res = await fetch(rssUrl);
    const xml = await res.text();

    const parsed = (await parseStringPromise(xml)) as RSSFeed;
    invariant(parsed.rss.channel[0], "Invalid RSS feed");

    const items = parsed.rss.channel[0].item;

    const results: Article[] = [];

    for (const item of items) {
      const pubDate = item.pubDate[0];
      const title = item.title[0];
      const description = item.description[0];
      const link = item.link[0];

      if (!pubDate || !title || !description || !link) {
        console.log(`Skipping item due to missing data:`, item);
        continue;
      }

      const articleText = await scrapeArticleText(link);
      results.push({ pubDate, title, description, link, articleText });
    }

    await saveResults(results);

    return results;
  } catch (err) {
    console.error("Failed to parse RSS feed:", err);
    return [];
  }
}
