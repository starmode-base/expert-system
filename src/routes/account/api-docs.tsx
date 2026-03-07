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
        REST API for programmatic access to takeaways, research, and documents.
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
     https://your-domain.com/api/v1/takeaways/recent`}</Pre>

        <P>
          A missing or invalid key returns <Code>401 Unauthorized</Code>.
          Revoked keys are rejected immediately.
        </P>
      </Section>

      {/* GET /api/v1/takeaways/recent */}
      <Section>
        <H2>Recent Takeaways</H2>
        <P>
          Returns the most recent takeaways ordered by source document
          publication date (newest first). Use this as a starting point to
          discover current content and retrieve IDs to pass to the{" "}
          <Code>/api/v1/takeaways</Code> endpoint.
        </P>

        <EndpointBadge method="GET" path="/api/v1/takeaways/recent" />

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
        </FieldTable>

        <H3>Example request</H3>
        <Pre>{`curl -H "Authorization: Bearer esak_<your-key>" \\
     "https://your-domain.com/api/v1/takeaways/recent?limit=5"`}</Pre>

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
      }
    }
  ]
}`}</Pre>
      </Section>

      {/* GET /api/v1/takeaways */}
      <Section>
        <H2>Takeaways by ID</H2>
        <P>
          Fetch up to 50 takeaways by their IDs in a single request. Results are
          returned in the same order as the IDs provided. Each takeaway includes
          its source document metadata and any inline references.
        </P>

        <EndpointBadge method="GET" path="/api/v1/takeaways" />

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
     "https://your-domain.com/api/v1/takeaways?ids=tak_abc123,tak_def456"`}</Pre>

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
      </Section>

      {/* GET /api/v1/documents */}
      <Section>
        <H2>Documents by ID</H2>
        <P>
          Fetch up to 50 source documents by their IDs in a single request.
          Document IDs are available on takeaway objects returned by the
          takeaway endpoints. Results are returned in the same order as the IDs
          provided.
        </P>

        <EndpointBadge method="GET" path="/api/v1/documents" />

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
     "https://your-domain.com/api/v1/documents?ids=doc_xyz789,doc_abc123"`}</Pre>

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
      </Section>

      {/* GET /api/v1/research */}
      <Section>
        <H2>Research</H2>
        <P>
          AI-generated research insights. Scoped to the user who owns the API
          key — each key only returns research belonging to that user. Sorted by
          creation date (newest first).
        </P>

        <EndpointBadge method="GET" path="/api/v1/research" />

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
     "https://your-domain.com/api/v1/research?limit=10"`}</Pre>

        <H3>Example request — filter by date</H3>
        <Pre>{`curl -H "Authorization: Bearer esak_<your-key>" \\
     "https://your-domain.com/api/v1/research?date=2026-03-05"`}</Pre>

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
      </Section>

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
