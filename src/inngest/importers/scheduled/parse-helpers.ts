import * as cheerio from "cheerio";

export function htmlToPlainText(html: string): string {
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

export function coerceToArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export function extractXmlText(value: unknown): string | null {
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

export function normalizeLink(rawLink: string): string {
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
