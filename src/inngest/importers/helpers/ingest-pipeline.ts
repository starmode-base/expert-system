import type { GetStepTools } from "inngest";
import { inArray } from "drizzle-orm";
import { db, schema } from "~/postgres/db";
import type { inngest } from "~/inngest/client";
import type { ModelPower } from "~/lib/model-versions";
import type { ProcessedImage } from "../scrapers/process-images";
import { getDocumentSummary } from "./get-document-summary";

export interface IngestCandidate {
  link: string;
  title: string;
  publicationDate: string;
  articleText: string;
  images?: ProcessedImage[];
}

export interface IngestPipelineConfig {
  source: string;
  takeawayPrompt: string;
  takeawayPower?: ModelPower;
  /** Only fan out takeaways for substantive articles (default: false) */
  substantiveOnly?: boolean;
}

type StepTools = GetStepTools<typeof inngest>;

/**
 * Deduplicate candidate links against existing documents in the database.
 * Returns the set of links that already exist.
 */
export async function getExistingLinks(
  step: StepTools,
  links: string[],
): Promise<Set<string>> {
  const uniqueLinks = Array.from(new Set(links));

  const existing = await step.run("get-existing-links", async () => {
    const rows = await db
      .select({ link: schema.documents.link })
      .from(schema.documents)
      .where(inArray(schema.documents.link, uniqueLinks));
    return rows.map((r) => r.link);
  });

  return new Set(existing);
}

/**
 * Shared ingest pipeline: generates summaries, inserts documents with images,
 * and fans out takeaway generation.
 *
 * Each scraper is responsible for fetching, parsing, deduplicating, and
 * extracting text from candidates. This function handles everything after that.
 */
export async function ingestDocuments(
  step: StepTools,
  candidates: IngestCandidate[],
  config: IngestPipelineConfig,
) {
  if (candidates.length === 0) {
    return { inserted: [] as { id: string; isSubstantive: boolean }[] };
  }

  // Generate summaries and assess substantiveness
  const withSummaries = await Promise.all(
    candidates.map(async (doc, index) => {
      const summaryResult = await step.run(
        `generate-summary-${index}`,
        async () => {
          return await getDocumentSummary(doc.articleText, doc.title);
        },
      );
      return { ...doc, summaryResult };
    }),
  );

  // Insert documents and images
  const inserted = await step.run("insert-documents", async () => {
    const results: { id: string; isSubstantive: boolean }[] = [];

    for (const doc of withSummaries) {
      const [row] = await db
        .insert(schema.documents)
        .values({
          source: config.source,
          title: doc.title,
          description: doc.summaryResult.summary,
          isSubstantive: doc.summaryResult.isSubstantive,
          publicationDate: new Date(doc.publicationDate),
          link: doc.link,
          articleText: doc.articleText,
        })
        .returning({
          id: schema.documents.id,
          isSubstantive: schema.documents.isSubstantive,
        });

      if (!row) continue;
      results.push(row);

      if (doc.images && doc.images.length > 0) {
        await db.insert(schema.documentImages).values(
          doc.images.map((img) => ({
            documentId: row.id,
            blobUrl: img.blobUrl,
            altText: img.altText,
            position: img.position,
            widthPx: img.widthPx,
            heightPx: img.heightPx,
            sizeBytes: img.sizeBytes,
          })),
        );
      }
    }

    return results;
  });

  // Fan out takeaway generation
  const toFanOut = config.substantiveOnly
    ? inserted.filter((doc) => doc.isSubstantive)
    : inserted;

  await Promise.all(
    toFanOut.map(async (doc) => {
      await step.sendEvent(`generate-takeaways-${doc.id}`, {
        name: "app/generate-takeaways",
        data: {
          documentId: doc.id,
          takeawayPrompt: config.takeawayPrompt,
          ...(config.takeawayPower && {
            modelPower: config.takeawayPower,
          }),
          user: { id: "", email: "" },
        },
      });
    }),
  );

  return { inserted };
}
