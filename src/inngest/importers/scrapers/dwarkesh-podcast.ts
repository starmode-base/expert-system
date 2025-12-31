import fetch from "node-fetch";
import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";

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

const findContentRoot = ($: cheerio.CheerioAPI): cheerio.Cheerio<AnyNode> => {
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
};

const collectTextBlocks = (
  $: cheerio.CheerioAPI,
  root: cheerio.Cheerio<AnyNode>,
): string[] =>
  root
    .find("p, li")
    .toArray()
    .map((el) => normalizeText($(el).text()))
    .filter((text) => Boolean(text))
    .filter((text) => {
      const lower = text.toLowerCase();
      return !(
        lower.startsWith("sponsors") ||
        lower.startsWith("ready for more") ||
        lower.startsWith("subscribe") ||
        lower.includes("recent episodes") ||
        lower.includes("commentsrestacks") ||
        lower.includes("discussion about this video")
      );
    });

const parseTranscriptEntries = (blocks: string[]): TranscriptEntry[] => {
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
};

function renderTranscript(
  entries: TranscriptEntry[],
  fallbackBlocks: string[],
): string {
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

export async function fetchDwarkeshPodcastTranscript(
  url: string,
): Promise<string> {
  const res = await fetch(url);
  const html = await res.text();
  const $ = cheerio.load(html);

  const root = findContentRoot($);
  const blocks = collectTextBlocks($, root);
  const entries = parseTranscriptEntries(blocks);

  return renderTranscript(entries, blocks);
}
