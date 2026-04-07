import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { AnyNode } from "domhandler";
import { htmlToPlainText } from "../blogs/blog-helpers";

export interface MacroVoicesCandidate {
  link: string;
  title: string;
  description: string;
  publicationDate: string;
}

function extractDate(text: string): string | null {
  const match = /Created:\s*([0-9]{1,2}\s+\w+\s+20\d{2})/i.exec(text);
  if (!match?.[1]) {
    return null;
  }

  const parsed = new Date(`${match[1]} UTC`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function makeDescription(
  container: cheerio.Cheerio<AnyNode>,
  root: cheerio.CheerioAPI,
) {
  const paragraphs = container.find("p").toArray();
  const firstWithText = paragraphs.find(
    (p) => root(p).text().trim().length > 0,
  );
  if (!firstWithText) {
    return "";
  }

  const paragraph = root(firstWithText);
  const paragraphText = paragraph.html() ?? paragraph.text();
  const plain = htmlToPlainText(paragraphText);
  const maxLength = 400;
  if (plain.length <= maxLength) {
    return plain;
  }

  return `${plain.slice(0, maxLength).trim()}…`;
}

export function parseMacroVoicesList(
  listHtml: string,
  baseUrl: string,
): MacroVoicesCandidate[] {
  const $ = cheerio.load(listHtml);
  const items: MacroVoicesCandidate[] = [];

  $('div[itemprop="blogPost"]').each((_, containerEl) => {
    const container = $(containerEl);
    const anchor = container.find('h2[itemprop="headline"] a').first();
    const rawTitle = anchor.text().trim();
    const rawHref = anchor.attr("href")?.trim();
    if (!rawTitle || !rawHref) {
      return;
    }

    const link = new URL(rawHref, baseUrl).toString();
    const publicationDate = extractDate(container.text());
    if (!publicationDate) {
      return;
    }

    const description = makeDescription(container, $);

    items.push({
      link,
      title: rawTitle,
      description,
      publicationDate,
    });
  });

  return items;
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function shouldSkipParagraph(text: string) {
  const normalized = text.toLowerCase();
  return (
    normalized.includes("macro voices is presented") ||
    normalized.includes("copyright") ||
    normalized.includes("consider a donation")
  );
}

export function parseMacroVoicesTranscriptHtml(html: string) {
  const $ = cheerio.load(html);
  const articleCandidates = [
    $(".item-page"),
    $('[itemprop="articleBody"]'),
    $("article[itemtype*='Article']"),
  ];
  const articleCandidate = articleCandidates.find(
    (candidate) => candidate.length > 0,
  );

  if (!articleCandidate) {
    return "";
  }

  const article = articleCandidate.first();

  let currentSpeaker = "";
  const lines: string[] = [];

  const paragraphs = article.find("p").toArray();
  for (const p of paragraphs) {
    const paragraph = $(p);
    const text = cleanText(paragraph.text());
    if (!text || shouldSkipParagraph(text)) {
      continue;
    }

    const strongText = cleanText(paragraph.find("strong").first().text());
    const speakerName = strongText.replace(/[:\-–\s]+$/, "");
    const normalizedSpeaker = speakerName || strongText;
    const isSpeakerLine =
      normalizedSpeaker &&
      (text === strongText ||
        text === speakerName ||
        text === `${strongText}:` ||
        text === `${speakerName}:` ||
        text === `${strongText} -` ||
        text === `${speakerName} -`);

    if (isSpeakerLine) {
      currentSpeaker = normalizedSpeaker;
      continue;
    }

    const startsWithSpeaker =
      normalizedSpeaker &&
      text.startsWith(strongText) &&
      text.length > strongText.length + 1;

    if (startsWithSpeaker) {
      currentSpeaker = normalizedSpeaker;
      const spoken = cleanText(
        text.slice(strongText.length).replace(/^[:\-–\s]+/, ""),
      );
      if (spoken) {
        lines.push(`${currentSpeaker}: ${spoken}`);
      }
      continue;
    }

    if (!currentSpeaker) {
      lines.push(text);
      continue;
    }

    lines.push(`${currentSpeaker}: ${text}`);
  }

  return lines.join("\n\n").trim();
}

export async function fetchMacroVoicesTranscript(url: string) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  const html = await res.text();
  return parseMacroVoicesTranscriptHtml(html);
}

export const macroVoicesTakeawayPrompt = `
Focus on durable macro and market insights from the conversation, especially policy, rates, credit, commodities, geopolitics, and portfolio construction.

Guidelines:
- Capture theses, frameworks, and forward-looking views with any stated probabilities or price levels
- Note disagreements, scenario drivers, and catalysts
`.trim();
