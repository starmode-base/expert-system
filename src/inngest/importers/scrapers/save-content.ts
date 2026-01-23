import { invariant } from "@tanstack/react-router";
import { and } from "drizzle-orm";
import { fetchAlphaVantageEarningsTranscript } from "~/inngest/importers/scrapers/earnings-transcripts";
import { db, schema } from "~/postgres/db";
import { getDocumentSummary } from "../helpers/get-document-summary";

export interface Document {
  publicationDate: Date;
  source: string;
  title: string;
  description: string;
  link: string;
  articleText: string;
}

export async function transcriptExists({
  source,
  title,
}: {
  source: string;
  title: string;
}): Promise<string | null> {
  // check if transcript exists before saveing
  const transcript = await db.query.documents.findFirst({
    where: (documents, { eq }) =>
      and(eq(documents.title, title), eq(documents.source, source)),
    columns: { id: true },
  });

  // if transcript exists, skip
  if (transcript?.id) {
    return transcript.id;
  } else {
    return null;
  }
}

export async function saveContent(document: Document) {
  // TODO - add user and org foreign keys

  // Only save new articles
  const result = await db
    .insert(schema.documents)
    .values({
      source: document.source,
      title: document.title,
      description: document.description,
      publicationDate: document.publicationDate,
      link: document.link,
      articleText: document.articleText,
    })
    .returning({ id: schema.documents.id });

  invariant(result[0], "Failed to create document");

  return result[0].id;
}

// Map each quarter to the first month of the following quarter. For Q4, increment the year.
function getEarningsDate(year: number, quarter: number) {
  const nextQuarterMapping = {
    1: { month: 4, yearOffset: 0 },
    2: { month: 7, yearOffset: 0 },
    3: { month: 10, yearOffset: 0 },
    4: { month: 1, yearOffset: 1 },
  };
  const { month, yearOffset } = nextQuarterMapping[quarter as 1 | 2 | 3 | 4];
  const publicationYear = year + yearOffset;
  const monthString = String(month).padStart(2, "0");
  const publicationDate = new Date(`${publicationYear}-${monthString}-01`);
  return publicationDate;
}

export async function fetchAndSaveTranscript({
  symbol,
  name,
  year,
  quarter,
  earningsDate,
}: {
  symbol: string;
  name: string;
  year: number;
  quarter: number;
  earningsDate?: Date;
}) {
  const result = await fetchAlphaVantageEarningsTranscript({
    symbol,
    year,
    quarter,
  });

  const publicationDate = earningsDate ?? getEarningsDate(year, quarter);

  const title = `${name} - Q${quarter} ${year} Earnings Call Transcript`;

  const articleText = result
    .map((entry) => `${entry.speaker} (${entry.title}): "${entry.content}"`)
    .join("\n");

  // Check if transcript already exists
  const existingDocumentId = await transcriptExists({
    source: "Public Earnings Transcripts",
    title,
  });

  if (existingDocumentId) {
    console.log(`Transcript already exists for ${symbol}`);
    return existingDocumentId;
  }

  // Generate summary for the transcript
  const description = await getDocumentSummary(articleText, title);

  const document = {
    source: "Public Earnings Transcripts",
    title,
    description,
    publicationDate,
    link: "",
    articleText,
  };

  return await saveContent(document);
}
