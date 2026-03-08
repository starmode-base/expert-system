import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/account/api-docs")({
  component: ApiDocsPage,
});

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-10 mb-3 text-lg font-semibold text-gray-900 first:mt-0">
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-gray-500 uppercase">
      {children}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-sm leading-relaxed text-gray-600">{children}</p>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-800">
      {children}
    </code>
  );
}

function Pre({ children }: { children: string }) {
  return (
    <pre className="mb-4 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-4 font-mono text-xs leading-relaxed text-gray-800">
      {children}
    </pre>
  );
}

function ParamRow({
  name,
  type,
  required,
  description,
}: {
  name: string;
  type: string;
  required?: boolean;
  description: string;
}) {
  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="py-2 pr-4 align-top font-mono text-xs text-gray-800">
        {name}
      </td>
      <td className="py-2 pr-4 align-top font-mono text-xs text-blue-600">
        {type}
      </td>
      <td className="py-2 pr-4 align-top text-xs text-gray-500">
        {required ? (
          <span className="font-medium text-gray-700">required</span>
        ) : (
          "optional"
        )}
      </td>
      <td className="py-2 align-top text-xs text-gray-600">{description}</td>
    </tr>
  );
}

function FieldRow({
  name,
  type,
  description,
}: {
  name: string;
  type: string;
  description: string;
}) {
  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="py-2 pr-4 align-top font-mono text-xs text-gray-800">
        {name}
      </td>
      <td className="py-2 pr-4 align-top font-mono text-xs text-blue-600">
        {type}
      </td>
      <td className="py-2 align-top text-xs text-gray-600">{description}</td>
    </tr>
  );
}

function ParamTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
            <th className="px-4 py-2">Parameter</th>
            <th className="px-4 py-2">Type</th>
            <th className="px-4 py-2">Required</th>
            <th className="px-4 py-2">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 px-4">{children}</tbody>
      </table>
    </div>
  );
}

function FieldTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
            <th className="px-4 py-2">Field</th>
            <th className="px-4 py-2">Type</th>
            <th className="px-4 py-2">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">{children}</tbody>
      </table>
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <section className="mb-2 rounded-lg border border-gray-200 bg-white p-6">
      {children}
    </section>
  );
}

function EndpointSection({
  title,
  method,
  path,
  description,
  children,
}: {
  title: string;
  method: string;
  path: string;
  description: string;
  children: React.ReactNode;
}) {
  const methodColor =
    method === "POST"
      ? "bg-blue-100 text-blue-700"
      : "bg-emerald-100 text-emerald-700";

  return (
    <details className="group mb-2 rounded-lg border border-gray-200 bg-white">
      <summary className="flex cursor-pointer list-none items-start gap-4 p-5 [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <span
              className={`shrink-0 rounded px-2 py-0.5 font-mono text-xs font-bold ${methodColor}`}
            >
              {method}
            </span>
            <code className="font-mono text-sm text-gray-800">{path}</code>
          </div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <p className="text-xs leading-relaxed text-gray-500">{description}</p>
        </div>
        <svg
          className="mt-1 h-4 w-4 shrink-0 text-gray-400 transition-transform group-open:rotate-180"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </summary>
      <div className="border-t border-gray-100 px-6 pt-4 pb-6">{children}</div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function ApiDocsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold text-gray-900">
        API Reference
      </h1>
      <p className="mb-8 text-sm text-gray-500">
        REST API for programmatic access to takeaways, research, and documents.
      </p>

      {/* Getting Started */}
      <Section>
        <H2>Getting Started</H2>

        <P>
          All API requests require an API key. Generate one on the{" "}
          <a
            href="/account/api-keys"
            className="text-blue-600 underline hover:text-blue-800"
          >
            API Keys
          </a>{" "}
          page, then include it in every request:
        </P>
        <Pre>{`Authorization: Bearer esak_<your-key>`}</Pre>

        <H3>Example</H3>
        <Pre>{`curl -H "Authorization: Bearer esak_<your-key>" \\
     https://expert-system.starmode.dev/api/v1/takeaways/recent`}</Pre>

        <P>
          A missing or invalid key returns <Code>401 Unauthorized</Code>.
          Revoked keys are rejected immediately.
        </P>

        <H3>Machine-readable docs</H3>
        <P>
          A plain-text Markdown version of this documentation is available for
          AI agents — no authentication required. Point your agent at this URL
          to ingest the full API reference:
        </P>
        <Pre>{`curl https://expert-system.starmode.dev/api/v1/docs`}</Pre>
      </Section>

      <h2 className="mt-8 mb-3 text-lg font-semibold text-gray-900">
        Endpoints
      </h2>

      {/* GET /api/v1/takeaways/recent */}
      <EndpointSection
        title="Recent Takeaways"
        method="GET"
        path="/api/v1/takeaways/recent"
        description="Returns the most recent takeaways ordered by publication date (newest first)."
      >
        <H3>Query parameters</H3>
        <ParamTable>
          <ParamRow
            name="limit"
            type="number"
            description="Number of takeaways to return. Default: 10. Max: 100."
          />
        </ParamTable>

        <H3>Response</H3>
        <Pre>{`{
  "items": [ TakeawayObject, ... ]
}`}</Pre>

        <H3>Takeaway object</H3>
        <FieldTable>
          <FieldRow
            name="id"
            type="string"
            description="Takeaway unique identifier."
          />
          <FieldRow
            name="documentId"
            type="string"
            description="ID of the source document."
          />
          <FieldRow
            name="title"
            type="string"
            description="Short headline summarising the takeaway."
          />
          <FieldRow
            name="summary"
            type="string"
            description="Brief summary of the takeaway."
          />
        </FieldTable>

        <H3>Example request</H3>
        <Pre>{`curl -H "Authorization: Bearer esak_<your-key>" \\
     "https://expert-system.starmode.dev/api/v1/takeaways/recent?limit=5"`}</Pre>

        <H3>Example response</H3>
        <Pre>{`{
  "items": [
    {
      "id": "tak_abc123",
      "documentId": "doc_xyz789",
      "title": "Fed signals pause through Q2",
      "summary": "The Federal Reserve indicated it will hold rates..."
    }
  ]
}`}</Pre>
      </EndpointSection>

      {/* GET /api/v1/takeaways */}
      <EndpointSection
        title="Takeaways by ID"
        method="GET"
        path="/api/v1/takeaways"
        description="Fetch up to 50 takeaways by ID with full details, document metadata, and inline references."
      >
        <H3>Query parameters</H3>
        <ParamTable>
          <ParamRow
            name="ids"
            type="string"
            required
            description="Comma-separated list of takeaway IDs. Maximum 50 IDs per request."
          />
        </ParamTable>

        <H3>Response</H3>
        <Pre>{`{
  "items": [ TakeawayObject, ... ]
}`}</Pre>

        <H3>Takeaway object</H3>
        <FieldTable>
          <FieldRow name="id" type="string" description="Unique identifier." />
          <FieldRow
            name="title"
            type="string"
            description="Short headline summarising the takeaway."
          />
          <FieldRow
            name="takeaway"
            type="string"
            description="Full takeaway text — the actionable or notable finding."
          />
          <FieldRow
            name="document"
            type="object"
            description="Source document metadata: id, title, source, link, publicationDate."
          />
          <FieldRow
            name="takeawayReferences"
            type="array"
            description="Ordered list of inline references. Each entry has referenceNumber (integer) and reference (string)."
          />
        </FieldTable>

        <H3>Example request</H3>
        <Pre>{`curl -H "Authorization: Bearer esak_<your-key>" \\
     "https://expert-system.starmode.dev/api/v1/takeaways?ids=tak_abc123,tak_def456"`}</Pre>

        <H3>Example response</H3>
        <Pre>{`{
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
      },
      "takeawayReferences": [
        { "referenceNumber": 1, "reference": "Federal Reserve Press Release, Jan 2026" }
      ]
    }
  ]
}`}</Pre>
      </EndpointSection>

      {/* GET /api/v1/takeaways/search */}
      <EndpointSection
        title="Takeaway Search"
        method="GET"
        path="/api/v1/takeaways/search"
        description="Semantic search across all takeaways using vector similarity, with optional time-weighted reranking."
      >
        <H3>Query parameters</H3>
        <ParamTable>
          <ParamRow
            name="query"
            type="string"
            required
            description="Natural-language search query."
          />
          <ParamRow
            name="limit"
            type="number"
            description="Number of results to return. Default: 10. Max: 100."
          />
          <ParamRow
            name="recent"
            type="string"
            description='Set to "true" to apply time-weighted reranking that favours newer content.'
          />
        </ParamTable>

        <H3>Response</H3>
        <Pre>{`{
  "items": [ SearchResultObject, ... ]
}`}</Pre>

        <H3>Search result object</H3>
        <FieldTable>
          <FieldRow
            name="id"
            type="string"
            description="Takeaway unique identifier."
          />
          <FieldRow
            name="documentId"
            type="string"
            description="ID of the source document."
          />
          <FieldRow
            name="title"
            type="string"
            description="Short headline summarising the takeaway."
          />
          <FieldRow
            name="summary"
            type="string"
            description="Brief summary of the takeaway."
          />
        </FieldTable>

        <H3>Example request</H3>
        <Pre>{`curl -H "Authorization: Bearer esak_<your-key>" \\
     "https://expert-system.starmode.dev/api/v1/takeaways/search?query=inflation+expectations&limit=5"`}</Pre>

        <H3>Example request — time-weighted</H3>
        <Pre>{`curl -H "Authorization: Bearer esak_<your-key>" \\
     "https://expert-system.starmode.dev/api/v1/takeaways/search?query=inflation+expectations&recent=true"`}</Pre>

        <H3>Example response</H3>
        <Pre>{`{
  "items": [
    {
      "id": "tak_abc123",
      "documentId": "doc_xyz789",
      "title": "Inflation expectations remain anchored",
      "summary": "Long-term inflation expectations hold steady near 2%..."
    }
  ]
}`}</Pre>
      </EndpointSection>

      {/* GET /api/v1/documents */}
      <EndpointSection
        title="Documents by ID"
        method="GET"
        path="/api/v1/documents"
        description="Fetch up to 50 source documents by ID, including full article text and metadata."
      >
        <H3>Query parameters</H3>
        <ParamTable>
          <ParamRow
            name="ids"
            type="string"
            required
            description="Comma-separated list of document IDs. Maximum 50 IDs per request."
          />
        </ParamTable>

        <H3>Response</H3>
        <Pre>{`{
  "items": [ DocumentObject, ... ]
}`}</Pre>

        <H3>Document object</H3>
        <FieldTable>
          <FieldRow name="id" type="string" description="Unique identifier." />
          <FieldRow
            name="source"
            type="string"
            description='Origin of the document, e.g. "a16z", "Fed Speeches", "MacroVoices".'
          />
          <FieldRow name="title" type="string" description="Document title." />
          <FieldRow
            name="description"
            type="string"
            description="Short description or abstract of the document."
          />
          <FieldRow
            name="publicationDate"
            type="string (ISO 8601)"
            description="When the document was originally published."
          />
          <FieldRow
            name="link"
            type="string"
            description="URL to the original source."
          />
          <FieldRow
            name="articleText"
            type="string"
            description="Full plain-text body of the document."
          />
          <FieldRow
            name="isSubstantive"
            type="boolean"
            description="Whether the document contains enough content to be worth processing."
          />
          <FieldRow
            name="createdAt"
            type="string (ISO 8601)"
            description="When the document was ingested."
          />
          <FieldRow
            name="updatedAt"
            type="string (ISO 8601)"
            description="When the document record was last updated."
          />
        </FieldTable>

        <H3>Example request</H3>
        <Pre>{`curl -H "Authorization: Bearer esak_<your-key>" \\
     "https://expert-system.starmode.dev/api/v1/documents?ids=doc_xyz789,doc_abc123"`}</Pre>

        <H3>Example response</H3>
        <Pre>{`{
  "items": [
    {
      "id": "doc_xyz789",
      "source": "Fed Speeches",
      "title": "Remarks on the Economic Outlook",
      "description": "Governor Powell discusses the path of inflation...",
      "publicationDate": "2026-03-01T00:00:00.000Z",
      "link": "https://www.federalreserve.gov/...",
      "articleText": "Thank you for the opportunity to speak...",
      "isSubstantive": true,
      "createdAt": "2026-03-01T08:15:00.000Z",
      "updatedAt": "2026-03-01T08:15:00.000Z"
    }
  ]
}`}</Pre>
      </EndpointSection>

      {/* GET /api/v1/research */}
      <EndpointSection
        title="Research"
        method="GET"
        path="/api/v1/research"
        description="AI-generated research insights scoped to the API key owner. Supports cursor pagination and date filtering."
      >
        <H3>Query parameters</H3>
        <ParamTable>
          <ParamRow
            name="cursor"
            type="string"
            description="Opaque pagination cursor from the previous response's nextCursor field. Omit to start from the beginning."
          />
          <ParamRow
            name="limit"
            type="number"
            description="Items per page. Default: 4. Max: 100."
          />
          <ParamRow
            name="date"
            type="string"
            description="Filter to a single day in YYYY-MM-DD format (UTC). Returns only research created on that date."
          />
        </ParamTable>

        <H3>Response</H3>
        <Pre>{`{
  "items": [ ResearchObject, ... ],
  "nextCursor": "<string> | null"
}`}</Pre>

        <H3>Research object</H3>
        <FieldTable>
          <FieldRow name="id" type="string" description="Unique identifier." />
          <FieldRow
            name="title"
            type="string"
            description="Title of the research insight."
          />
          <FieldRow
            name="summary"
            type="string | null"
            description="Short summary of the insight's main finding."
          />
          <FieldRow
            name="insight"
            type="string | null"
            description="Full insight text. Only insights with a non-null value are returned."
          />
          <FieldRow
            name="research"
            type="string | null"
            description="Background research notes used to generate the insight."
          />
          <FieldRow
            name="takeaways"
            type="array"
            description="Takeaways linked to this insight. Each entry has id and title."
          />
          <FieldRow
            name="createdAt"
            type="string (ISO 8601)"
            description="When the insight was created."
          />
          <FieldRow
            name="updatedAt"
            type="string (ISO 8601)"
            description="When the insight was last updated."
          />
        </FieldTable>

        <H3>Cursor pagination</H3>
        <P>
          Pass the opaque <Code>nextCursor</Code> value from a response as the{" "}
          <Code>cursor</Code> parameter on the next request. When{" "}
          <Code>nextCursor</Code> is <Code>null</Code>, you have reached the
          last page. Do not parse or construct cursor values — treat them as
          opaque strings.
        </P>

        <H3>Example request</H3>
        <Pre>{`curl -H "Authorization: Bearer esak_<your-key>" \\
     "https://expert-system.starmode.dev/api/v1/research?limit=10"`}</Pre>

        <H3>Example request — filter by date</H3>
        <Pre>{`curl -H "Authorization: Bearer esak_<your-key>" \\
     "https://expert-system.starmode.dev/api/v1/research?date=2026-03-05"`}</Pre>

        <H3>Example response</H3>
        <Pre>{`{
  "items": [
    {
      "id": "ins_def456",
      "title": "Rate cycle and tech valuations",
      "summary": "Rising rates historically compress growth multiples...",
      "insight": "Analysis shows a strong inverse correlation between...",
      "research": null,
      "takeaways": [
        { "id": "tak_abc123", "title": "Fed signals pause through Q2" }
      ],
      "createdAt": "2026-03-05T14:30:00.000Z",
      "updatedAt": "2026-03-05T14:30:00.000Z"
    }
  ],
  "nextCursor": null
}`}</Pre>
      </EndpointSection>

      {/* POST /api/v1/query/macro */}
      <EndpointSection
        title="Query Macro Data"
        method="POST"
        path="/api/v1/query/macro"
        description="Natural language interface for macroeconomic data. An AI agent translates your question into FRED API calls."
      >
        <H3>Request body (JSON)</H3>
        <ParamTable>
          <ParamRow
            name="query"
            type="string"
            required
            description='Natural-language macro question (e.g. "What is the current unemployment rate?").'
          />
        </ParamTable>

        <H3>Response</H3>
        <Pre>{`{
  "analysis": "...",
  "supportingData": "..."
}`}</Pre>

        <H3>Response fields</H3>
        <FieldTable>
          <FieldRow
            name="analysis"
            type="string"
            description="Concise analysis answering the question, grounded in data."
          />
          <FieldRow
            name="supportingData"
            type="string"
            description="Raw data points with series IDs and periods."
          />
        </FieldTable>

        <H3>Example request</H3>
        <Pre>{`curl -X POST -H "Authorization: Bearer esak_<your-key>" \\
     -H "Content-Type: application/json" \\
     -d '{"query": "What is the current unemployment rate?"}' \\
     "https://expert-system.starmode.dev/api/v1/query/macro"`}</Pre>

        <H3>Example response</H3>
        <Pre>{`{
  "analysis": "The unemployment rate stands at 4.1% as of January 2026...",
  "supportingData": "UNRATE: 4.1% (2026-01), 4.2% (2025-12), 4.1% (2025-11)"
}`}</Pre>
      </EndpointSection>

      {/* POST /api/v1/query/financial */}
      <EndpointSection
        title="Query Financial Data"
        method="POST"
        path="/api/v1/query/financial"
        description="Natural language interface for company financial data. An AI agent translates your question into Alpha Vantage API calls."
      >
        <H3>Request body (JSON)</H3>
        <ParamTable>
          <ParamRow
            name="query"
            type="string"
            required
            description='Natural-language financial question (e.g. "What is Apple&#39;s revenue trend?").'
          />
        </ParamTable>

        <H3>Response</H3>
        <Pre>{`{
  "analysis": "...",
  "supportingData": "..."
}`}</Pre>

        <H3>Response fields</H3>
        <FieldTable>
          <FieldRow
            name="analysis"
            type="string"
            description="Concise analysis answering the question, grounded in data."
          />
          <FieldRow
            name="supportingData"
            type="string"
            description="Raw data points with tickers and periods."
          />
        </FieldTable>

        <H3>Example request</H3>
        <Pre>{`curl -X POST -H "Authorization: Bearer esak_<your-key>" \\
     -H "Content-Type: application/json" \\
     -d '{"query": "What is Apple'\\''s latest quarterly revenue?"}' \\
     "https://expert-system.starmode.dev/api/v1/query/financial"`}</Pre>

        <H3>Example response</H3>
        <Pre>{`{
  "analysis": "Apple reported $124.3B in revenue for Q1 FY2026...",
  "supportingData": "AAPL totalRevenue: $124.3B (2025-12-28), $94.9B (2025-09-28)"
}`}</Pre>
      </EndpointSection>

      {/* Error reference */}
      <Section>
        <H2>Error responses</H2>
        <P>
          Errors return a JSON body with an <Code>error</Code> field and the
          corresponding HTTP status code.
        </P>
        <FieldTable>
          <FieldRow
            name="400 Bad Request"
            type=""
            description="Missing or invalid parameter (e.g. missing ids, invalid limit, malformed cursor or date)."
          />
          <FieldRow
            name="401 Unauthorized"
            type=""
            description="Missing, invalid, or revoked API key."
          />
          <FieldRow
            name="200 OK"
            type=""
            description="Successful response. Always returns an items array."
          />
        </FieldTable>
        <H3>Example error body</H3>
        <Pre>{`{ "error": "Missing required parameter: ids" }`}</Pre>
      </Section>
    </div>
  );
}
