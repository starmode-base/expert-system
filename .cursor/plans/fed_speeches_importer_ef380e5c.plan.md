---
name: Fed speeches importer
overview: Add a new scheduled Inngest importer that reads the Federal Reserve speeches/testimony RSS feed, scrapes each linked page’s text, inserts new items into `documents`, and triggers takeaway generation.
todos:
  - id: add-fed-importer
    content: Create `src/inngest/functions/importers/scheduled/fed-speeches.ts` to ingest the Fed RSS feed, scrape each linked page’s text, insert into `documents`, and enqueue takeaway generation.
    status: completed
  - id: wire-inngest-index
    content: Import and register the new scheduled function in `src/inngest/functions/index.ts` (`inngestFunctions` array).
    status: completed
    dependencies:
      - add-fed-importer
  - id: verify-schema-compat
    content: Confirm inserted fields match the `documents` schema and reuse existing DB patterns for dedupe/insert.
    status: completed
    dependencies:
      - add-fed-importer
---

# Add Federal Reserve speeches RSS importer

## Goal

Create a new scheduled importer `fed-speeches.ts` that ingests items from the Federal Reserve “Speeches and Testimony” RSS feed ([feed](https://www.federalreserve.gov/feeds/speeches_and_testimony.xml)), scrapes the linked HTML page’s text, and stores each item as a `documents` row.

## Implementation

- **Add scheduled function** in [`/Users/spencersm/Documents/projects/expert-system/src/inngest/functions/importers/scheduled/fed-speeches.ts`](/Users/spencersm/Documents/projects/expert-system/src/inngest/functions/importers/scheduled/fed-speeches.ts)
- Fetch RSS XML from `https://www.federalreserve.gov/feeds/speeches_and_testimony.xml`.
- Parse with `xml2js` using an “always arrays + CDATA-safe” extraction helper (copy the robust approach from [`/Users/spencersm/Documents/projects/expert-system/src/inngest/functions/importers/scheduled/stratechery.ts`](/Users/spencersm/Documents/projects/expert-system/src/inngest/functions/importers/scheduled/stratechery.ts)).
- For each `<item>` extract:
    - `title`, `link`, `description`, `category`, `pubDate` (and/or `guid`)
    - Normalize `link` (strip hash, etc.) and use `link` as the dedupe key.
- Apply a **6-month cutoff** (only ingest items where `pubDate >= now - 180 days`).
- Deduplicate against existing rows by querying `documents.link` (batch `inArray` query, like Stratechery).
- For each new item, fetch its HTML page and extract readable text with `cheerio`:
    - Remove obvious chrome (`script/style/nav/header/footer`, etc.).
    - Prefer common “main content” containers if found (e.g. `main`, `#article`, `#content`), otherwise fall back to cleaned `body` text.
    - Normalize whitespace to a clean plain-text block.
- Insert into `documents` (same columns as other importers: `source`, `title`, `description`, `publicationDate`, `link`, `articleText`).
- After insert, **enqueue `app/generate-takeaways`** via `step.sendEvent` for each inserted document (same pattern as Stratechery), using a Fed-oriented takeaway prompt.
- **Register the function** in [`/Users/spencersm/Documents/projects/expert-system/src/inngest/functions/index.ts`](/Users/spencersm/Documents/projects/expert-system/src/inngest/functions/index.ts)
- Add an import for the new `fedSpeechesScraper` and include it in the exported `inngestFunctions` array.

## Notes / defaults

- **Schedule**: Use a daily cron similar to the other scheduled importers (can be adjusted later).
- **Source string**: Use a consistent `source` value like `Federal Reserve (Speeches & Testimony)`.

## Implementation todos

- `add-fed-importer`: Create `fed-speeches.ts` scheduled Inngest function (RSS parse → cutoff/dedupe → scrape text → insert documents → enqueue takeaways)