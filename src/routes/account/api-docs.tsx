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

function EndpointBadge({ method, path }: { method: string; path: string }) {
  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
      <span className="rounded bg-emerald-100 px-2 py-0.5 font-mono text-xs font-bold text-emerald-700">
        {method}
      </span>
      <code className="font-mono text-sm text-gray-800">{path}</code>
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
        REST API for programmatic access to takeaways, insights, and documents.
      </p>

      {/* Authentication */}
      <Section>
        <H2>Authentication</H2>
        <P>
          All API requests must include an API key in the{" "}
          <Code>Authorization</Code> header using the Bearer scheme. Generate a
          key on the{" "}
          <a
            href="/account/api-keys"
            className="text-blue-600 underline hover:text-blue-800"
          >
            API Keys
          </a>{" "}
          page.
        </P>
        <Pre>{`Authorization: Bearer esak_<your-key>`}</Pre>

        <H3>Example — curl</H3>
        <Pre>{`curl -H "Authorization: Bearer esak_<your-key>" \\
     https://your-domain.com/api/v1/takeaways`}</Pre>

        <P>
          A missing or invalid key returns <Code>401 Unauthorized</Code>.
          Revoked keys are rejected immediately.
        </P>
      </Section>

      {/* Pagination */}
      <Section>
        <H2>Cursor Pagination</H2>
        <P>
          All list endpoints use cursor-based pagination. Every response
          includes a <Code>nextCursor</Code> field. When it is <Code>null</Code>
          , you have reached the last page.
        </P>
        <P>
          Pass the opaque cursor string back as the <Code>cursor</Code> query
          parameter on the next request to fetch the following page. Do not
          parse or construct cursor values — treat them as opaque strings.
        </P>

        <H3>Fetch first page</H3>
        <Pre>{`GET /api/v1/takeaways?limit=50`}</Pre>

        <H3>Fetch next page</H3>
        <Pre>{`GET /api/v1/takeaways?limit=50&cursor=<nextCursor from previous response>`}</Pre>

        <H3>Walk all pages</H3>
        <Pre>{`let cursor = null;
const allItems = [];

do {
  const params = new URLSearchParams({ limit: "100" });
  if (cursor) params.set("cursor", cursor);

  const res = await fetch(\`/api/v1/takeaways?\${params}\`, {
    headers: { Authorization: \`Bearer \${apiKey}\` },
  });
  const { items, nextCursor } = await res.json();

  allItems.push(...items);
  cursor = nextCursor;
} while (cursor !== null);`}</Pre>

        <H3>Common parameters</H3>
        <ParamTable>
          <ParamRow
            name="cursor"
            type="string"
            description="Opaque pagination cursor from the previous response's nextCursor field. Omit to start from the beginning."
          />
          <ParamRow
            name="limit"
            type="number"
            description="Number of items per page. Default: 20. Max: 100."
          />
        </ParamTable>
      </Section>

      {/* GET /api/v1/takeaways */}
      <Section>
        <H2>Takeaways</H2>
        <P>
          Key insights extracted from source documents. Sorted by document
          publication date (newest first). Shared across all users — not scoped
          to the API key owner.
        </P>

        <EndpointBadge method="GET" path="/api/v1/takeaways" />

        <H3>Query parameters</H3>
        <ParamTable>
          <ParamRow
            name="cursor"
            type="string"
            description="Pagination cursor from a previous response."
          />
          <ParamRow
            name="limit"
            type="number"
            description="Items per page. Default: 20. Max: 100."
          />
        </ParamTable>

        <H3>Response</H3>
        <Pre>{`{
  "items": [ TakeawayObject, ... ],
  "nextCursor": "<string> | null"
}`}</Pre>

        <H3>Takeaway object</H3>
        <FieldTable>
          <FieldRow name="id" type="string" description="Unique identifier." />
          <FieldRow
            name="documentId"
            type="string"
            description="ID of the source document this takeaway was extracted from."
          />
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
            name="concept"
            type="string"
            description="Broader concept or theme the takeaway belongs to."
          />
          <FieldRow
            name="summary"
            type="string"
            description="Concise summary of the takeaway in 1–2 sentences."
          />
          <FieldRow
            name="categoryId"
            type="string | null"
            description="Category ID if the takeaway has been categorised, otherwise null."
          />
          <FieldRow
            name="retrievalSummary"
            type="string | null"
            description="Optimised text used for semantic search retrieval. May be null."
          />
          <FieldRow
            name="createdAt"
            type="string (ISO 8601)"
            description="When the takeaway was created."
          />
          <FieldRow
            name="updatedAt"
            type="string (ISO 8601)"
            description="When the takeaway was last updated."
          />
        </FieldTable>

        <H3>Example request</H3>
        <Pre>{`curl -H "Authorization: Bearer esak_<your-key>" \\
     "https://your-domain.com/api/v1/takeaways?limit=20"`}</Pre>

        <H3>Example response</H3>
        <Pre>{`{
  "items": [
    {
      "id": "tak_abc123",
      "documentId": "doc_xyz789",
      "title": "Fed signals pause through Q2",
      "takeaway": "The Federal Reserve indicated it will hold rates...",
      "concept": "Monetary policy",
      "summary": "Rate hold expected through mid-year.",
      "categoryId": "cat_macro",
      "retrievalSummary": null,
      "createdAt": "2026-03-01T10:00:00.000Z",
      "updatedAt": "2026-03-01T10:00:00.000Z"
    }
  ],
  "nextCursor": "eyJwdWJsaWNhdGlvbkRhdGUiOiIyMDI2LTAz..."
}`}</Pre>
      </Section>

      {/* GET /api/v1/insights */}
      <Section>
        <H2>Insights</H2>
        <P>
          AI-generated research insights. Scoped to the user who owns the API
          key — each key only returns insights belonging to that user.
        </P>

        <EndpointBadge method="GET" path="/api/v1/insights" />

        <H3>Query parameters</H3>
        <ParamTable>
          <ParamRow
            name="cursor"
            type="string"
            description="Pagination cursor from a previous response."
          />
          <ParamRow
            name="limit"
            type="number"
            description="Items per page. Default: 20. Max: 100."
          />
        </ParamTable>

        <H3>Response</H3>
        <Pre>{`{
  "items": [ InsightObject, ... ],
  "nextCursor": "<string> | null"
}`}</Pre>

        <H3>Insight object</H3>
        <FieldTable>
          <FieldRow name="id" type="string" description="Unique identifier." />
          <FieldRow
            name="userId"
            type="string"
            description="ID of the user who generated this insight."
          />
          <FieldRow
            name="title"
            type="string"
            description="Title of the insight."
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
            name="seedText"
            type="string | null"
            description="The seed prompt or text that initiated insight generation."
          />
          <FieldRow
            name="insightPrompt"
            type="string | null"
            description="The prompt used to generate the insight."
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

        <H3>Example request</H3>
        <Pre>{`curl -H "Authorization: Bearer esak_<your-key>" \\
     "https://your-domain.com/api/v1/insights?limit=10"`}</Pre>

        <H3>Example response</H3>
        <Pre>{`{
  "items": [
    {
      "id": "ins_def456",
      "userId": "usr_abc123",
      "title": "Rate cycle and tech valuations",
      "summary": "Rising rates historically compress growth multiples...",
      "insight": "Analysis shows a strong inverse correlation between...",
      "research": null,
      "seedText": "How do rate cycles affect tech valuations?",
      "insightPrompt": null,
      "createdAt": "2026-03-05T14:30:00.000Z",
      "updatedAt": "2026-03-05T14:30:00.000Z"
    }
  ],
  "nextCursor": null
}`}</Pre>
      </Section>

      {/* GET /api/v1/documents */}
      <Section>
        <H2>Documents</H2>
        <P>
          Source documents (articles, transcripts, reports) that have been
          ingested and processed. Sorted by publication date (newest first).
          Shared across all users — not scoped to the API key owner.
        </P>

        <EndpointBadge method="GET" path="/api/v1/documents" />

        <H3>Query parameters</H3>
        <ParamTable>
          <ParamRow
            name="cursor"
            type="string"
            description="Pagination cursor from a previous response."
          />
          <ParamRow
            name="limit"
            type="number"
            description="Items per page. Default: 20. Max: 100."
          />
        </ParamTable>

        <H3>Response</H3>
        <Pre>{`{
  "items": [ DocumentObject, ... ],
  "nextCursor": "<string> | null"
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
     "https://your-domain.com/api/v1/documents?limit=5"`}</Pre>

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
  ],
  "nextCursor": "eyJwdWJsaWNhdGlvbkRhdGUiOiIyMDI2LTAz..."
}`}</Pre>
      </Section>

      {/* Error reference */}
      <Section>
        <H2>Error responses</H2>
        <FieldTable>
          <FieldRow
            name="401 Unauthorized"
            type=""
            description="Missing, invalid, or revoked API key."
          />
          <FieldRow
            name="200 OK"
            type=""
            description="Successful response. Always returns items array and nextCursor."
          />
        </FieldTable>
        <P>
          All successful responses return HTTP 200 with a JSON body. Errors
          return a plain-text body with the HTTP status code.
        </P>
      </Section>
    </div>
  );
}
