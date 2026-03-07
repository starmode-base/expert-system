import { createAPIFileRoute } from "@tanstack/react-start/api";

const DOCS = `# API Reference

REST API for programmatic access to takeaways, research, and documents.

## Authentication

All API requests must include an API key in the Authorization header using the Bearer scheme.

    Authorization: Bearer esak_<your-key>

A missing or invalid key returns 401 Unauthorized. Revoked keys are rejected immediately.

---

## GET /api/v1/takeaways/recent

Returns the most recent takeaways ordered by source document publication date (newest first).

### Query parameters

| Parameter | Type   | Required | Description                                      |
|-----------|--------|----------|--------------------------------------------------|
| limit     | number | no       | Number of takeaways to return. Default: 10. Max: 100. |

### Response

    { "items": [ TakeawayObject, ... ] }

### Takeaway object

| Field    | Type   | Description                                                        |
|----------|--------|--------------------------------------------------------------------|
| id       | string | Unique identifier.                                                 |
| title    | string | Short headline summarising the takeaway.                           |
| takeaway | string | Full takeaway text — the actionable or notable finding.            |
| document | object | Source document metadata: id, title, source, link, publicationDate.|

### Example request

    curl -H "Authorization: Bearer esak_<your-key>" \\
         "https://your-domain.com/api/v1/takeaways/recent?limit=5"

### Example response

    {
      "items": [
        {
          "id": "tak_abc123",
          "title": "Fed signals pause through Q2",
          "takeaway": "The Federal Reserve indicated it will hold rates...",
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
| takeaway           | string | Full takeaway text — the actionable or notable finding.                                  |
| document           | object | Source document metadata: id, title, source, link, publicationDate.                      |
| takeawayReferences | array  | Ordered list of inline references. Each entry has referenceNumber (integer) and reference (string). |

### Example request

    curl -H "Authorization: Bearer esak_<your-key>" \\
         "https://your-domain.com/api/v1/takeaways?ids=tak_abc123,tak_def456"

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
         "https://your-domain.com/api/v1/documents?ids=doc_xyz789,doc_abc123"

---

## GET /api/v1/research

AI-generated research insights. Scoped to the user who owns the API key — each key only returns research belonging to that user. Sorted by creation date (newest first).

### Query parameters

| Parameter | Type   | Required | Description                                                                                 |
|-----------|--------|----------|---------------------------------------------------------------------------------------------|
| cursor    | string | no       | Opaque pagination cursor from the previous response's nextCursor field.                     |
| limit     | number | no       | Items per page. Default: 4. Max: 100.                                                       |
| date      | string | no       | Filter to a single day in YYYY-MM-DD format (UTC). Returns only research created on that date. |

### Response

    {
      "items": [ ResearchObject, ... ],
      "nextCursor": "<string> | null"
    }

### Research object

| Field     | Type             | Description                                                   |
|-----------|------------------|---------------------------------------------------------------|
| id        | string           | Unique identifier.                                            |
| title     | string           | Title of the research insight.                                |
| summary   | string or null   | Short summary of the insight's main finding.                  |
| insight   | string or null   | Full insight text. Only insights with a non-null value are returned. |
| research  | string or null   | Background research notes used to generate the insight.       |
| takeaways | array            | Takeaways linked to this insight. Each entry has id and title.|
| createdAt | string (ISO 8601)| When the insight was created.                                 |
| updatedAt | string (ISO 8601)| When the insight was last updated.                            |

### Cursor pagination

Pass the opaque nextCursor value from a response as the cursor parameter on the next request. When nextCursor is null, you have reached the last page. Do not parse or construct cursor values — treat them as opaque strings.

### Example request

    curl -H "Authorization: Bearer esak_<your-key>" \\
         "https://your-domain.com/api/v1/research?limit=10"

### Example request — filter by date

    curl -H "Authorization: Bearer esak_<your-key>" \\
         "https://your-domain.com/api/v1/research?date=2026-03-05"

---

## Error responses

Errors return a JSON body with an error field and the corresponding HTTP status code.

| Status            | Description                                                                              |
|-------------------|------------------------------------------------------------------------------------------|
| 400 Bad Request   | Missing or invalid parameter (e.g. missing ids, invalid limit, malformed cursor or date).|
| 401 Unauthorized  | Missing, invalid, or revoked API key.                                                    |
| 200 OK            | Successful response. Always returns an items array.                                      |

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
