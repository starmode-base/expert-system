import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";
import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";
import { invariant } from "@tanstack/react-router";
import {
  coerceToArray,
  extractXmlText,
  htmlToPlainText,
  normalizeLink,
} from "../parse-helpers";

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

const SKIP_PREFIXES = [
  "sponsors",
  "ready for more",
  "subscribe",
  "description",
  "timestamps",
];

const SKIP_INCLUDES = [
  "recent episodes",
  "commentsrestacks",
  "discussion about this video",
];

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

function findTranscriptHeading(
  $: cheerio.CheerioAPI,
  root: cheerio.Cheerio<AnyNode>,
): cheerio.Cheerio<Element> | null {
  const headingSelectors =
    "h1, h2, h3, h4, h5, h6, strong, b, p strong, p b, [data-testid='heading']";

  const heading = root
    .find(headingSelectors)
    .filter(
      (_, el) => normalizeText($(el).text()).toLowerCase() === "transcript",
    )
    .first();

  return heading.length > 0 ? heading : null;
}

function isElementNode(node: AnyNode): node is Element {
  return typeof (node as Element).tagName === "string";
}

function collectTextBlocks(
  $: cheerio.CheerioAPI,
  root: cheerio.Cheerio<AnyNode>,
  startAfter?: cheerio.Cheerio<Element> | null,
): string[] {
  const orderedNodes: AnyNode[] = root.find("*").toArray();
  const startNode: Element | null = startAfter?.get(0) ?? null;
  const startIndex = startNode
    ? orderedNodes.findIndex((node) => node === startNode)
    : -1;

  const blocks: string[] = [];

  for (
    let i = startIndex >= 0 ? startIndex + 1 : 0;
    i < orderedNodes.length;
    i += 1
  ) {
    const node = orderedNodes[i];
    if (!node) {
      continue;
    }

    if (!isElementNode(node)) {
      continue;
    }

    const tag = node.tagName.toLowerCase();
    if (tag !== "p" && tag !== "li") {
      continue;
    }

    const text = normalizeText($(node).text());
    if (!text) {
      continue;
    }

    const lower = text.toLowerCase();
    const isTimeline =
      /^\(?\d{2}:\d{2}:\d{2}\)?\s*[-–—]?\s*/.test(lower) &&
      !/^([a-z]|[a-z].+)/i.test(lower);

    const isSkippedPrefix = SKIP_PREFIXES.some((phrase) =>
      lower.startsWith(phrase),
    );
    const isSkippedContains = SKIP_INCLUDES.some((phrase) =>
      lower.includes(phrase),
    );

    if (isSkippedPrefix || isSkippedContains || isTimeline) {
      continue;
    }

    blocks.push(text);
  }

  return blocks;
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
      if (entry.timestamp) {
        return `${entry.speaker} (${entry.timestamp}): ${entry.text}`;
      }
      return `${entry.speaker}: ${entry.text}`;
    })
    .join("\n");
}

export async function fetchDwarkeshPodcastTranscript(url: string) {
  const res = await fetch(url);
  const html = await res.text();
  const $ = cheerio.load(html);

  const root = findContentRoot($);
  const transcriptHeading = findTranscriptHeading($, root);
  const blocks = collectTextBlocks($, root, transcriptHeading);
  const entries = parseTranscriptEntries(blocks);

  return renderTranscript(entries, blocks);
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
      const articleText = await fetchDwarkeshPodcastTranscript(candidate.link);
      if (!articleText) {
        return null;
      }

      return { ...candidate, articleText };
    }),
  );

  return results.filter(
    (candidate): candidate is DwarkeshPodcastCandidateWithTranscript =>
      Boolean(candidate),
  );
}
