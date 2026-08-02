import { createFileRoute } from "@tanstack/react-router";
import { CopyPre } from "~/lib/copy-pre";
import { CopyIcon, CheckIcon } from "lucide-react";
import { useState } from "react";

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
// LLM docs label
// ---------------------------------------------------------------------------

function LlmDocsLabel() {
  const [copied, setCopied] = useState(false);
  const curlCommand = "curl https://expert-system.starmode.dev/api/v1/docs";

  const handleCopy = () => {
    void navigator.clipboard.writeText(curlCommand).then(() => {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    });
  };

  return (
    <div className="flex items-center gap-2 text-xs text-gray-400">
      <code className="font-mono text-gray-500">{curlCommand}</code>
      <button
        type="button"
        onClick={handleCopy}
        className="rounded p-0.5 text-gray-400 transition-colors hover:text-gray-600"
        aria-label="Copy curl command"
      >
        {copied ? (
          <CheckIcon className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <CopyIcon className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function ApiDocsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">API Reference</h1>
        <LlmDocsLabel />
      </div>

      {/* Quick start */}
      <div className="mb-2 grid gap-4 sm:grid-cols-2">
        {/* Step 1 */}
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">
              1
            </span>
            <h3 className="text-sm font-medium text-gray-900">
              Get an API key
            </h3>
          </div>
          <p className="mb-4 text-sm leading-relaxed text-gray-600">
            Create a free account and generate your key.
          </p>
          <a
            href="/account/api-keys"
            className="inline-block rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            Get API key
          </a>
        </div>

        {/* Step 2 */}
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">
              2
            </span>
            <h3 className="text-sm font-medium text-gray-900">
              Install the skill
            </h3>
          </div>
          <p className="mb-3 text-xs font-medium tracking-wide text-gray-500 uppercase">
            Claude Code
          </p>
          <div className="mb-3">
            <CopyPre>
              {`/plugin install github://starmode-base/expert-system-plugin`}
            </CopyPre>
          </div>
          <p className="mb-3 text-xs font-medium tracking-wide text-gray-500 uppercase">
            Any agent (Cursor, Copilot, Cline, Codex)
          </p>
          <CopyPre>
            {`npx skills add starmode-base/expert-system-plugin`}
          </CopyPre>
        </div>
      </div>
      <p className="mb-6 text-center text-xs text-gray-500">
        The plugin ships three focused skills that trigger automatically based
        on context. See the{" "}
        <a
          href="https://github.com/starmode-base/expert-system-plugin"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline hover:text-blue-800"
        >
          plugin repository
        </a>{" "}
        for details.
      </p>

      {/* Getting Started */}
      <Section>
        <H2>Direct API access</H2>

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
          <FieldRow
            name="publicationDate"
            type="string (ISO 8601)"
            description="Publication date of the source document."
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
      "summary": "The Federal Reserve indicated it will hold rates...",
      "publicationDate": "2026-03-01T00:00:00.000Z"
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
            name="url"
            type="string"
            description="Link to the takeaway on expert-system."
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
      "url": "https://expert-system.starmode.dev/takeaway/tak_abc123",
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
          <FieldRow
            name="publicationDate"
            type="string"
            description="ISO 8601 publication date of the source document."
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
      "summary": "Long-term inflation expectations hold steady near 2%...",
      "publicationDate": "2026-03-01T00:00:00.000Z"
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

      {/* POST /api/v1/query/macro */}
      <EndpointSection
        title="Query Macro Data"
        method="POST"
        path="/api/v1/query/macro"
        description="Natural language interface for macroeconomic data. An AI agent translates your question into FRED API calls and returns structured data."
      >
        <H3>Available data</H3>
        <P>
          Ask about any of the series below using plain English — the agent
          resolves series IDs automatically.
        </P>
        <div className="mb-4 space-y-2 text-xs leading-relaxed text-gray-600">
          <p>
            <span className="font-semibold text-gray-700">
              Growth / Real Economy:
            </span>{" "}
            Real GDP, Industrial Production, Capacity Utilization, Real Personal
            Consumption, Real Business Fixed Investment.
          </p>
          <p>
            <span className="font-semibold text-gray-700">Labor Market:</span>{" "}
            Unemployment Rate, Labor Force Participation, Employment-Population
            Ratio, Nonfarm Payrolls, Initial Jobless Claims, Continuing Jobless
            Claims, Job Openings Rate, Quits Rate.
          </p>
          <p>
            <span className="font-semibold text-gray-700">
              Inflation / Prices:
            </span>{" "}
            CPI All Items, Core CPI, PCE Price Index, Core PCE, Trimmed Mean
            PCE, Median CPI.
          </p>
          <p>
            <span className="font-semibold text-gray-700">Wages / Income:</span>{" "}
            Average Hourly Earnings, Employment Cost Index, Real Disposable
            Personal Income.
          </p>
          <p>
            <span className="font-semibold text-gray-700">
              Monetary Policy / Liquidity:
            </span>{" "}
            Fed Funds Rate, Effective Fed Funds Rate, Interest on Reserve
            Balances, Fed Total Assets, Reserve Balances, Overnight Reverse
            Repo, M2 Money Supply.
          </p>
          <p>
            <span className="font-semibold text-gray-700">
              Rates / Yield Curve:
            </span>{" "}
            2-Year Treasury, 10-Year Treasury, 10Y-2Y Spread, 10-Year Term
            Premium, 10-Year Breakeven Inflation.
          </p>
          <p>
            <span className="font-semibold text-gray-700">
              Credit / Financial Stress:
            </span>{" "}
            Baa Corporate Spread, High Yield OAS, Senior Loan Officer Survey,
            Financial Conditions Index, Bank Credit.
          </p>
          <p>
            <span className="font-semibold text-gray-700">Housing:</span>{" "}
            Housing Starts, Building Permits, Existing Home Sales, Case-Shiller
            Home Price Index, 30-Year Mortgage Rate.
          </p>
          <p>
            <span className="font-semibold text-gray-700">Sentiment:</span>{" "}
            Consumer Sentiment.
          </p>
        </div>

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
  "data": [ { ... }, ... ],
  "seriesQueried": [ "UNRATE", ... ]
}`}</Pre>

        <H3>Response fields</H3>
        <FieldTable>
          <FieldRow
            name="data"
            type="array"
            description="Array of result objects from tool calls, preserving original structure (e.g. seriesId, observations, metadata)."
          />
          <FieldRow
            name="seriesQueried"
            type="string[]"
            description="List of FRED series IDs that were queried."
          />
        </FieldTable>

        <H3>Example request</H3>
        <Pre>{`curl -X POST -H "Authorization: Bearer esak_<your-key>" \\
     -H "Content-Type: application/json" \\
     -d '{"query": "What is the current unemployment rate?"}' \\
     "https://expert-system.starmode.dev/api/v1/query/macro"`}</Pre>

        <H3>Example response</H3>
        <Pre>{`{
  "data": [
    {
      "seriesId": "UNRATE",
      "observations": [
        { "date": "2026-02-01", "value": "4.4" },
        { "date": "2026-01-01", "value": "4.0" }
      ]
    }
  ],
  "seriesQueried": ["UNRATE"]
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
