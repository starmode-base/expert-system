# Expert System Spec

## Purpose

Expert System continuously ingests broad, high-signal information sources and synthesizes them into unique, decision-relevant insights that can ultimately inform trading.

## End Output

- A curated stream of concise insights that highlight second-order implications and decision-relevant signals.
- Each insight is grounded in recent source material and translated into clear market or strategic implications.

## Conceptual Flow

1. Collect new source materials from multiple domains (macro policy, tech strategy, venture, and corporate fundamentals).
2. Convert each source into a clean, readable document with a short summary.
3. Extract multiple takeaways from each document that generalize beyond the raw content.
4. Enrich each takeaway with a summary, retrieval summary, and category for retrieval and reasoning.
5. Aggregate recent takeaways into daily research objectives.
6. Produce daily insights aligned to those objectives.

## Data Objects and How They Are Generated

### Source Document

A normalized representation of a single source item (article, transcript, or speech).

- **Generated from:**
  - Policy communications: central bank speeches and testimony.
  - Strategy and technology analysis: premium industry commentary.
  - Venture and innovation coverage: venture news posts.
  - Macro and markets: long-form macro podcast transcripts.
  - Deep interviews: long-form expert podcast transcripts.
  - Corporate fundamentals: earnings call transcripts generated from upcoming earnings schedules.
- **How it is formed:** Source content is collected, cleaned into readable text, and paired with metadata (title, link, publication date, and a short summary).

### Takeaway

A concise, decision-relevant statement that generalizes beyond a single source.

- **Generated from:** Each source document.
- **How it is formed:** The system reads the document text and produces multiple high-signal takeaways, emphasizing implications for markets, business strategy, and macro conditions rather than simple recaps.

### Takeaway References

Supporting evidence linked to each takeaway.

- **Generated from:** The document text sections that justify the takeaway.
- **How it is formed:** For every takeaway, the system records references that point back to specific supporting passages or claims.

### Takeaway Summary

A short summary that clarifies the takeaway in plain language.

- **Generated from:** Each takeaway.
- **How it is formed:** The system rewrites the takeaway into a clear, succinct summary.

### Retrieval Summary

A compact summary optimized for retrieval and similarity search.

- **Generated from:** Each takeaway.
- **How it is formed:** The system produces a shorter, retrieval-focused version of the takeaway summary.

### Category

A high-level theme label to organize takeaways.

- **Generated from:** Each takeaway.
- **How it is formed:** The system classifies the takeaway into a thematic category such as macro, technology, market structure, or competitive dynamics.

### Research Objective

A prompt that frames what new insight should be produced.

- **Generated from:** Recent takeaways and recent insights.
- **How it is formed:** The system combines the latest takeaways with prior insights to propose new research objectives that avoid redundancy and push toward novel conclusions.

### Insight

A synthesized, novel conclusion that can inform trading decisions.

- **Generated from:** Research objectives.
- **How it is formed:** The system follows a multi-stage reasoning flow to ensure novelty and grounding:
  - It compiles a short list of the most recent insights to avoid repetition.
  - It gathers a focused set of relevant takeaways to ground the analysis.
  - This context is run through an agentic reasoning loop with access to macroeconomic data and the research corpus.
  - It produces a draft insight that integrates those signals into a coherent market narrative.
