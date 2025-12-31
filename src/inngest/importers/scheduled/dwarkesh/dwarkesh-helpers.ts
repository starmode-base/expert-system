import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";
import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { invariant } from "@tanstack/react-router";

export interface DwarkeshPodcastCandidate {
  link: string;
  title: string;
  description: string;
  publicationDate: string;
}

interface DwarkeshPodcastRssItem {
  title?: (string | { _: string })[];
  guid?: (string | { _: string; $?: Record<string, string> })[];
  link?: (string | { _: string })[];
  description?: (string | { _: string })[];
  pubDate?: (string | { _: string })[];
}

interface DwarkeshPodcastRssChannel {
  item?: DwarkeshPodcastRssItem[] | DwarkeshPodcastRssItem;
}

interface DwarkeshPodcastRssFeed {
  rss: {
    channel: DwarkeshPodcastRssChannel[] | DwarkeshPodcastRssChannel;
  };
}

interface TranscriptEntry {
  speaker: string;
  timestamp?: string;
  text: string;
}

function normalizeText(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findContentRoot($: cheerio.CheerioAPI) {
  const selectors = [
    "article .body.markup",
    "article [data-testid='post-body']",
    "[data-testid='post-content']",
    "article",
  ];

  return (
    selectors
      .map((selector) => $(selector))
      .find((node) => node.length > 0)
      ?.first() ?? $.root()
  );
}

function collectTextBlocks(
  $: cheerio.CheerioAPI,
  root: cheerio.Cheerio<AnyNode>,
): string[] {
  return root
    .find("p, li")
    .toArray()
    .map((el: AnyNode) => normalizeText($(el).text()))
    .filter((text): text is string => Boolean(text))
    .filter((text: string) => {
      const lower = text.toLowerCase();
      const skipStartsWith = ["sponsors", "ready for more", "subscribe"];
      const skipIncludes = [
        "recent episodes",
        "commentsrestacks",
        "discussion about this video",
      ];

      const isSkippedPrefix = skipStartsWith.some((phrase) =>
        lower.startsWith(phrase),
      );
      const isSkippedContains = skipIncludes.some((phrase) =>
        lower.includes(phrase),
      );

      return !(isSkippedPrefix || isSkippedContains);
    });
}

function parseTranscriptEntries(blocks: string[]): TranscriptEntry[] {
  const speakerPattern =
    /^([A-Z][\w .,'-]{1,80}?)\s+_?(\d{2}:\d{2}:\d{2})_?(?:\s*[-–]\s*.+)?$/;

  const { entries, current } = blocks.reduce(
    (state, block) => {
      const match = speakerPattern.exec(block);

      if (match) {
        const speaker = match[1];
        const timestamp = match[2];
        if (!speaker || !timestamp) {
          return state;
        }

        const nextEntries = state.current?.text
          ? [...state.entries, state.current]
          : state.entries;

        return {
          entries: nextEntries,
          current: {
            speaker: speaker.trim(),
            timestamp,
            text: "",
          },
        };
      }

      if (!state.current) {
        return state;
      }

      const combinedText = state.current.text
        ? `${state.current.text} ${block}`
        : block;

      return {
        entries: state.entries,
        current: { ...state.current, text: combinedText },
      };
    },
    {
      entries: [] as TranscriptEntry[],
      current: null as TranscriptEntry | null,
    },
  );

  return current?.text ? [...entries, current] : entries;
}

function renderTranscript(
  entries: TranscriptEntry[],
  fallbackBlocks: string[],
) {
  if (entries.length === 0) {
    return fallbackBlocks.join("\n\n");
  }

  return entries
    .map((entry) => {
      const prefix = entry.timestamp ? `[${entry.timestamp}] ` : "";
      return `${prefix}${entry.speaker}: ${entry.text}`;
    })
    .join("\n");
}

export async function fetchDwarkeshPodcastTranscript(url: string) {
  const res = await fetch(url);
  const html = await res.text();
  const $ = cheerio.load(html);

  const root = findContentRoot($);
  const blocks = collectTextBlocks($, root);
  const entries = parseTranscriptEntries(blocks);

  return renderTranscript(entries, blocks);
}

function normalizeLink(rawLink: string) {
  const trimmed = rawLink.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed);
    url.hash = "";
    return url.toString();
  } catch {
    return trimmed;
  }
}

function coerceToArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function extractXmlText(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return extractXmlText(value[0]);
  }

  if (typeof value === "object") {
    const maybeText = (value as { _: unknown })._;
    if (typeof maybeText === "string") {
      return maybeText;
    }
  }

  return null;
}

function htmlToPlainText(html: string) {
  const $ = cheerio.load(html);
  const text = $.text();

  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const dwarkeshPodcastTakeawayPrompt = `
Focus on durable insights from long-form podcast conversations, especially around technology, science, economics, policy, and strategy.

Guidelines:
- Extract arguments, frameworks, or mental models
- Highlight disagreements, surprising claims, or quantified estimates when present
- Connect ideas to practical implications for builders, researchers, and investors
`.trim();

export async function parseDwarkeshPodcastCandidates(rssXml: string) {
  const parsed = (await parseStringPromise(rssXml, {
    trim: true,
    explicitArray: true,
  })) as DwarkeshPodcastRssFeed;

  const channel = coerceToArray(parsed.rss.channel)[0];
  invariant(channel, "Invalid RSS feed");

  const rssItems = coerceToArray(channel.item);

  return rssItems
    .map((item) => {
      const rawGuid = extractXmlText(item.guid);
      const rawLink = extractXmlText(item.link);
      const rawTitle = extractXmlText(item.title);
      const rawDescription = extractXmlText(item.description);
      const rawPubDate = extractXmlText(item.pubDate);

      const link = normalizeLink(rawLink ?? rawGuid ?? "");
      if (!link || !rawTitle || !rawDescription || !rawPubDate) {
        return null;
      }

      const publicationDate = new Date(rawPubDate);
      if (Number.isNaN(publicationDate.getTime())) {
        return null;
      }

      return {
        link,
        title: rawTitle,
        description: htmlToPlainText(rawDescription),
        publicationDate: publicationDate.toISOString(),
      };
    })
    .filter((candidate): candidate is DwarkeshPodcastCandidate =>
      Boolean(candidate),
    );
}

type DwarkeshPodcastCandidateWithTranscript = DwarkeshPodcastCandidate & {
  articleText: string;
};

export async function fetchDwarkeshCandidatesWithTranscripts(
  candidates: DwarkeshPodcastCandidate[],
) {
  const results = await Promise.all(
    candidates.map(async (candidate) => {
      try {
        const articleText = await fetchDwarkeshPodcastTranscript(
          candidate.link,
        );
        if (!articleText) {
          return null;
        }

        return { ...candidate, articleText };
      } catch {
        return null;
      }
    }),
  );

  return results.filter(
    (candidate): candidate is DwarkeshPodcastCandidateWithTranscript =>
      Boolean(candidate),
  );
}
