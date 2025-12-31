---
name: Add MacroVoices scheduled import
overview: Add a scheduled Inngest job that scrapes the MacroVoices transcript listing page, ingests the newest transcripts from the first page, and triggers takeaway generation.
todos:
  - id: setup-job
    content: Add macrovoices scheduled inngest function with cron
    status: completed
  - id: parse-list
    content: Parse first-page headlines/links/dates into candidates
    status: completed
  - id: fetch-transcripts
    content: Fetch transcript pages and extract body text/description
    status: completed
  - id: insert-trigger
    content: Insert new docs and trigger takeaways
    status: completed
---

# Implement MacroVoices transcript importer

- Create a new scheduled function in [`src/inngest/importers/scheduled/macrovoices.ts`](/Users/spencersm/Documents/projects/expert-system/src/inngest/importers/scheduled/macrovoices.ts) modeled on `stratechery.ts` with the same cron (`TZ=America/Phoenix 0 5 * * *`).
- Fetch `https://www.macrovoices.com/podcast-transcripts` (first page only), parse headline blocks (`h2[itemprop="headline"] a`) to collect title, resolved link (prepend site base), nearby published date text (e.g., “Created: 31 December 2025”), and optionally a short description snippet if available.
- For each candidate, skip links already in `schema.documents`; build a small set of new items without any additional pagination.
- Fetch each new transcript page; extract the main transcript body to plain text (using existing HTML-to-text helper or a focused selector) and derive a short description (e.g., first paragraph or truncated snippet). Make sure to maintain the speakers.