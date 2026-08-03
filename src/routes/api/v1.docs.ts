import { createAPIFileRoute } from "@tanstack/react-start/api";

const DOCS = `# API Reference

REST API for programmatic access to takeaways, documents, macroeconomic data, and normalized SEC company financials.

## Authentication

All API requests must include an API key in the Authorization header using the Bearer scheme.

    Authorization: Bearer esak_<your-key>

A missing or invalid key returns 401 Unauthorized. Revoked keys are rejected immediately.

---

## GET /api/v1/takeaways/recent

Returns the most recent takeaways ordered by source document publication date (newest first). Returns lightweight results — use the returned IDs with /api/v1/takeaways to fetch full details.

### Query parameters

| Parameter | Type   | Required | Description                                      |
|-----------|--------|----------|--------------------------------------------------|
| limit     | number | no       | Number of takeaways to return. Default: 10. Max: 100. |

### Response

    { "items": [ TakeawayObject, ... ] }

### Takeaway object

| Field      | Type   | Description                              |
|------------|--------|------------------------------------------|
| id         | string | Takeaway unique identifier.              |
| documentId | string | ID of the source document.               |
| title      | string | Short headline summarising the takeaway. |
| summary    | string | Brief summary of the takeaway.           |
| publicationDate | string (ISO 8601) | Publication date of the source document. |
| document   | object | Source metadata: id, title, source, link, publicationDate. |

### Example request

    curl -H "Authorization: Bearer esak_<your-key>" \\
         "https://expert-system.starmode.dev/api/v1/takeaways/recent?limit=5"

### Example response

    {
      "items": [
        {
          "id": "tak_abc123",
          "documentId": "doc_xyz789",
          "title": "Fed signals pause through Q2",
          "summary": "The Federal Reserve indicated it will hold rates...",
          "publicationDate": "2026-03-01T00:00:00.000Z",
          "document": {
            "id": "doc_xyz789",
            "title": "Remarks on the Economic Outlook",
            "source": "Fed Speeches",
            "link": "https://www.federalreserve.gov/...",
            "publicationDate": "2026-03-01T00:00:00.000Z"
          }
        }
      ]
    }

---

## GET /api/v1/takeaways

Fetch up to 50 takeaways by their IDs in a single request. Results are returned in the same order as the IDs provided. Each takeaway includes its source document metadata and any inline references.

### Query parameters

| Parameter | Type   | Required | Description                                              |
|-----------|--------|----------|----------------------------------------------------------|
| ids       | string | yes      | Comma-separated list of takeaway IDs. Maximum 50 per request. |

### Response

    { "items": [ TakeawayObject, ... ] }

### Takeaway object

| Field              | Type   | Description                                                                              |
|--------------------|--------|------------------------------------------------------------------------------------------|
| id                 | string | Unique identifier.                                                                       |
| title              | string | Short headline summarising the takeaway.                                                 |
| summary            | string | Brief summary of the takeaway.                                                           |
| takeaway           | string | Full takeaway text — the actionable or notable finding.                                  |
| url                | string | Link to the takeaway on expert-system.                                                   |
| document           | object | Source document metadata: id, title, source, link, publicationDate.                      |
| takeawayReferences | array  | Ordered list of inline references. Each entry has referenceNumber (integer) and reference (string). |

### Example request

    curl -H "Authorization: Bearer esak_<your-key>" \\
         "https://expert-system.starmode.dev/api/v1/takeaways?ids=tak_abc123,tak_def456"

---

## GET /api/v1/takeaways/search

Semantic search across all takeaways using vector similarity. Returns lightweight results ranked by relevance. Use the returned IDs with /api/v1/takeaways to fetch full takeaway details. Optionally applies a time-weighted reranking to favour more recent content.

### Query parameters

| Parameter | Type   | Required | Description                                                                 |
|-----------|--------|----------|-----------------------------------------------------------------------------|
| query     | string | yes      | Natural-language search query.                                              |
| limit     | number | no       | Number of results to return. Default: 10. Max: 100.                         |
| recent    | string | no       | Set to "true" to apply time-weighted reranking that favours newer content.  |

### Response

    { "items": [ SearchResultObject, ... ] }

### Search result object

| Field           | Type              | Description                              |
|-----------------|-------------------|------------------------------------------|
| id              | string            | Takeaway unique identifier.              |
| documentId      | string            | ID of the source document.               |
| title           | string            | Short headline summarising the takeaway. |
| summary         | string            | Brief summary of the takeaway.           |
| publicationDate | string (ISO 8601) | Publication date of the source document. |
| document        | object            | Source metadata: id, title, source, link, publicationDate. |

### Example request

    curl -H "Authorization: Bearer esak_<your-key>" \\
         "https://expert-system.starmode.dev/api/v1/takeaways/search?query=inflation+expectations&limit=5"

### Example request — time-weighted

    curl -H "Authorization: Bearer esak_<your-key>" \\
         "https://expert-system.starmode.dev/api/v1/takeaways/search?query=inflation+expectations&recent=true"

---

## GET /api/v1/documents

Fetch up to 50 source documents by their IDs in a single request. Document IDs are available on takeaway objects returned by the takeaway endpoints.

### Query parameters

| Parameter | Type   | Required | Description                                              |
|-----------|--------|----------|----------------------------------------------------------|
| ids       | string | yes      | Comma-separated list of document IDs. Maximum 50 per request. |

### Response

    { "items": [ DocumentObject, ... ] }

### Document object

| Field           | Type             | Description                                                  |
|-----------------|------------------|--------------------------------------------------------------|
| id              | string           | Unique identifier.                                           |
| source          | string           | Origin of the document, e.g. "a16z", "Fed Speeches".         |
| title           | string           | Document title.                                              |
| description     | string           | Short description or abstract of the document.               |
| publicationDate | string (ISO 8601)| When the document was originally published.                  |
| link            | string           | URL to the original source.                                  |
| articleText     | string           | Full plain-text body of the document.                        |
| isSubstantive   | boolean          | Whether the document contains enough content to be worth processing. |
| createdAt       | string (ISO 8601)| When the document was ingested.                              |
| updatedAt       | string (ISO 8601)| When the document record was last updated.                   |

### Example request

    curl -H "Authorization: Bearer esak_<your-key>" \\
         "https://expert-system.starmode.dev/api/v1/documents?ids=doc_xyz789,doc_abc123"

---

## GET /api/v1/documents/{documentId}/content

Read one source document in bounded character ranges. Use this after takeaway retrieval when an agent needs more primary-source context without loading an entire document.

| Parameter | Type    | Default | Description                           |
|-----------|---------|---------|---------------------------------------|
| offset    | integer | 0       | Zero-based character offset.          |
| limit     | integer | 12000   | Characters to return. Maximum: 30000. |

The response wraps document metadata and the bounded text range in an item object:

    {
      "item": {
        "id": "doc_xyz789",
        "title": "Remarks on the Economic Outlook",
        "source": "Fed Speeches",
        "link": "https://www.federalreserve.gov/...",
        "publicationDate": "2026-03-01T00:00:00.000Z",
        "content": {
          "text": "Thank you for the opportunity to speak...",
          "offset": 0,
          "nextOffset": 12000,
          "totalCharacters": 48320,
          "truncated": true
        }
      }
    }

---

## GET /api/v1/macro/series

List the supported FRED series, or search the catalog with an optional query parameter. Results include description, category, native frequency, native units, and the FRED source URL.

    curl -H "Authorization: Bearer esak_<your-key>" \\
         "https://expert-system.starmode.dev/api/v1/macro/series?query=unemployment"

---

## POST /api/v1/macro/observations

Fetch observations for one to five supported FRED series. Each series can use its own time window and transformation. The API never interpolates, forward-fills, or implicitly aligns series.

Each series accepts either lastN (default 12, max 120) or startDate and endDate. Set the units field to one of the supported value transformations: lin, chg, ch1, pch, pc1, pca, cch, or cca. Lower-frequency aggregation supports avg, sum, and eop.

Transformation semantics: lin returns levels; chg and ch1 return the period and year-ago changes; pch and pc1 return the period and year-ago percent changes; pca is compounded annualized percent change; cch and cca are continuously compounded period and annualized changes.

Use one series for simple questions and batches for comparisons. Keep native frequency by default; request an explicit lower frequency and aggregation method only when comparable periods are required.

### Example request

    curl -X POST -H "Authorization: Bearer esak_<your-key>" \\
         -H "Content-Type: application/json" \\
         -d '{"series":[{"id":"UNRATE","lastN":12},{"id":"ICSA","lastN":12,"frequency":"m","aggregationMethod":"avg"}]}' \\
         "https://expert-system.starmode.dev/api/v1/macro/observations"

### Example response

    {
      "asOf": "2026-08-02T00:00:00.000Z",
      "items": [
        {
          "seriesId": "UNRATE",
          "description": "Civilian Unemployment Rate (%)",
          "sourceUrl": "https://fred.stlouisfed.org/series/UNRATE",
          "nativeFrequency": "monthly",
          "returnedFrequency": "monthly",
          "nativeUnits": "Percent",
          "transformation": "lin",
          "observations": [
            { "date": "2026-07-01", "value": 4.2 }
          ]
        }
      ],
      "errors": []
    }

---

## Deterministic company financials

The financials API normalizes publicly filed SEC EDGAR company-facts data into a versioned catalog of stable metric IDs. It does not use an LLM, infer missing values, combine different concepts into one series, or present year-to-date cash flow as a standalone quarter.

Ticker symbols are resolved through the Expert System stock catalog. All company endpoints also accept a numeric SEC CIK, with or without a CIK prefix or leading zeroes.

### GET /api/v1/financials/metrics

Returns the global v1 catalog. Each metric includes its canonical ID, label, financial statement, and unit type.

    curl -H "Authorization: Bearer esak_<your-key>" \
         "https://expert-system.starmode.dev/api/v1/financials/metrics"

    {
      "catalogVersion": "1",
      "metrics": [
        {
          "id": "revenue",
          "label": "Revenue",
          "statement": "incomeStatement",
          "unitType": "monetary"
        }
      ]
    }

### GET /api/v1/financials/{symbol}/metrics

Returns only catalog metrics available for the requested company and period.

| Parameter | Values              | Default   |
|-----------|---------------------|-----------|
| period    | quarterly or annual | quarterly |

    curl -H "Authorization: Bearer esak_<your-key>" \
         "https://expert-system.starmode.dev/api/v1/financials/AAPL/metrics?period=quarterly"

    {
      "catalogVersion": "1",
      "symbol": "AAPL",
      "cik": "0000320193",
      "company": "Apple Inc.",
      "period": "quarterly",
      "metrics": [
        {
          "id": "revenue",
          "label": "Revenue",
          "statement": "incomeStatement",
          "unit": "USD"
        }
      ],
      "source": "SEC"
    }

### GET /api/v1/financials/{symbol}/{metric}

Returns one compact normalized time series.

| Parameter | Values              | Default   |
|-----------|---------------------|-----------|
| period    | quarterly or annual | quarterly |
| limit     | integer from 1–40   | 8         |
| include   | provenance          | omitted   |

    curl -H "Authorization: Bearer esak_<your-key>" \
         "https://expert-system.starmode.dev/api/v1/financials/AAPL/accountsPayable?period=quarterly&limit=4"

    {
      "catalogVersion": "1",
      "symbol": "AAPL",
      "cik": "0000320193",
      "company": "Apple Inc.",
      "metric": "accountsPayable",
      "period": "quarterly",
      "unit": "USD",
      "data": [
        {
          "date": "2026-06-27",
          "value": 64525000000,
          "periodType": "instant"
        }
      ],
      "source": "SEC"
    }

Request include=provenance to add filed, form, accession, and original SEC concept to each observation. Provenance responses also replace the compact source string with the SEC EDGAR provider and company-facts URL.

### POST /api/v1/financials

Retrieves several related metrics with one company-facts lookup. Metrics must contain 1–27 unique canonical IDs.

| Field   | Type                    | Required | Description                                      |
|---------|-------------------------|----------|--------------------------------------------------|
| symbol  | string                  | yes      | Ticker symbol or SEC CIK.                        |
| metrics | array of strings        | yes      | Between 1 and 27 unique canonical metric IDs.    |
| period  | quarterly or annual     | no       | Reporting period. Default: quarterly.            |
| limit   | integer from 1–40       | no       | Observations per metric. Default: 8.             |
| include | provenance              | no       | Adds filing provenance to returned observations. |

    curl -X POST -H "Authorization: Bearer esak_<your-key>" \
         -H "Content-Type: application/json" \
         -d '{"symbol":"JPM","metrics":["netIncome","inventory"],"period":"quarterly","limit":4}' \
         "https://expert-system.starmode.dev/api/v1/financials"

    {
      "catalogVersion": "1",
      "symbol": "JPM",
      "cik": "0000019617",
      "company": "JPMORGAN CHASE & CO",
      "period": "quarterly",
      "metrics": {
        "netIncome": {
          "unit": "USD",
          "data": [
            {
              "date": "2026-03-31",
              "value": 16494000000,
              "periodType": "quarter"
            }
          ]
        }
      },
      "errors": {
        "inventory": {
          "code": "METRIC_UNAVAILABLE",
          "message": "inventory is unavailable for JPM"
        }
      },
      "source": "SEC"
    }

Valid but unavailable batch metrics appear in the errors object while available metrics are returned normally with status 200. An unknown metric ID rejects the entire request with METRIC_NOT_FOUND.

### Financial period semantics

Every observation has a periodType:

- instant: a balance-sheet value measured as of date.
- quarter: a standalone fiscal-quarter duration.
- yearToDate: a filed multi-quarter cash-flow duration. The start field is included.
- annual: a fiscal-year duration.

Quarterly income statement facts are limited to standalone quarters. Cash-flow Q2 and Q3 disclosures are often year-to-date; these values remain unchanged and are explicitly labeled rather than derived.

### Financial error response

Financial endpoints return short machine-readable errors:

    {
      "error": {
        "code": "METRIC_UNAVAILABLE",
        "message": "inventory is unavailable for JPM"
      }
    }

Codes include UNAUTHORIZED, INVALID_REQUEST, COMPANY_NOT_FOUND, METRIC_NOT_FOUND, METRIC_UNAVAILABLE, SEC_UNAVAILABLE, RATE_LIMITED, and INTERNAL_ERROR.

---

## Error responses

Errors return a JSON body with an error field and the corresponding HTTP status code.

| Status                | Description                                                                              |
|-----------------------|------------------------------------------------------------------------------------------|
| 400 Bad Request       | Missing or invalid parameter (e.g. missing ids, invalid limit, malformed cursor or date).|
| 401 Unauthorized      | Missing, invalid, or revoked API key.                                                    |
| 404 Not Found         | Company, metric, or company-specific metric data was not found.                          |
| 429 Too Many Requests | Monthly API quota or upstream SEC rate limit was reached.                                |
| 502 Bad Gateway       | SEC EDGAR was unavailable or returned an invalid payload.                                |

### Example error body

    { "error": "Missing required parameter: ids" }
`;

export const APIRoute = createAPIFileRoute("/api/v1/docs")({
  GET: () => {
    return new Response(DOCS, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  },
});
