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
          <FieldRow
            name="document"
            type="object"
            description="Source metadata: id, title, source, link, publicationDate."
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
            name="summary"
            type="string"
            description="Brief summary of the takeaway."
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
      "summary": "The Fed expects inflation to cool before changing rates.",
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
          <FieldRow
            name="document"
            type="object"
            description="Source metadata: id, title, source, link, publicationDate."
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

      {/* GET /api/v1/documents/{documentId}/content */}
      <EndpointSection
        title="Document Content"
        method="GET"
        path="/api/v1/documents/{documentId}/content"
        description="Read one source document in bounded character ranges for primary-source verification and deeper context."
      >
        <H3>Query parameters</H3>
        <ParamTable>
          <ParamRow
            name="offset"
            type="integer"
            description="Zero-based character offset. Default: 0."
          />
          <ParamRow
            name="limit"
            type="integer"
            description="Characters to return. Default: 12000. Max: 30000."
          />
        </ParamTable>
        <H3>Response</H3>
        <Pre>{`{
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
}`}</Pre>
      </EndpointSection>

      {/* Deterministic company financials */}
      <Section>
        <H2>Deterministic company financials</H2>
        <P>
          The financials API normalizes publicly filed SEC EDGAR company-facts
          data into stable, versioned metric IDs. It does not use an LLM, infer
          missing values, or combine different SEC concepts into one series.
        </P>
        <P>
          Company endpoints accept either a ticker symbol such as{" "}
          <Code>AAPL</Code> or a numeric SEC CIK such as <Code>CIK320193</Code>.
          Every response includes the normalized 10-digit CIK.
        </P>

        <H3>Canonical metrics — catalog version 1</H3>
        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="mb-2 text-xs font-semibold text-gray-700">
              Income statement
            </p>
            <p className="font-mono text-xs leading-relaxed text-gray-600">
              revenue, costOfRevenue, grossProfit, operatingIncome, netIncome,
              epsBasic, epsDiluted, researchAndDevelopment,
              sellingGeneralAdministrative, incomeTaxExpense
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="mb-2 text-xs font-semibold text-gray-700">
              Balance sheet
            </p>
            <p className="font-mono text-xs leading-relaxed text-gray-600">
              cash, accountsReceivable, inventory, currentAssets, totalAssets,
              accountsPayable, currentLiabilities, totalLiabilities,
              shortTermDebt, longTermDebt, stockholdersEquity
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="mb-2 text-xs font-semibold text-gray-700">
              Cash flow
            </p>
            <p className="font-mono text-xs leading-relaxed text-gray-600">
              operatingCashFlow, capitalExpenditures, investingCashFlow,
              financingCashFlow, dividendsPaid, shareRepurchases
            </p>
          </div>
        </div>

        <H3>Period semantics</H3>
        <div className="grid gap-2 text-xs leading-relaxed text-gray-600 sm:grid-cols-2">
          <p>
            <Code>instant</Code> — a balance-sheet value measured as of the
            observation date.
          </p>
          <p>
            <Code>quarter</Code> — a standalone fiscal-quarter duration.
          </p>
          <p>
            <Code>yearToDate</Code> — a filed multi-quarter cash-flow duration;
            the response includes its start date.
          </p>
          <p>
            <Code>annual</Code> — a complete fiscal-year duration.
          </p>
        </div>
      </Section>

      {/* GET /api/v1/financials/metrics */}
      <EndpointSection
        title="Financial Metric Catalog"
        method="GET"
        path="/api/v1/financials/metrics"
        description="Returns the global versioned catalog of canonical financial metric IDs."
      >
        <H3>Response</H3>
        <Pre>{`{
  "catalogVersion": "1",
  "metrics": [
    {
      "id": "revenue",
      "label": "Revenue",
      "statement": "incomeStatement",
      "unitType": "monetary"
    }
  ]
}`}</Pre>

        <H3>Example request</H3>
        <Pre>{`curl -H "Authorization: Bearer esak_<your-key>" \\
     "https://expert-system.starmode.dev/api/v1/financials/metrics"`}</Pre>
      </EndpointSection>

      {/* GET /api/v1/financials/{symbol}/metrics */}
      <EndpointSection
        title="Company Metric Availability"
        method="GET"
        path="/api/v1/financials/{symbol}/metrics"
        description="Returns only the canonical metrics available for one company and reporting period."
      >
        <H3>Path parameters</H3>
        <ParamTable>
          <ParamRow
            name="symbol"
            type="string"
            required
            description="Ticker symbol or SEC CIK."
          />
        </ParamTable>

        <H3>Query parameters</H3>
        <ParamTable>
          <ParamRow
            name="period"
            type="quarterly | annual"
            description="Reporting period to inspect. Default: quarterly."
          />
        </ParamTable>

        <H3>Response</H3>
        <Pre>{`{
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
}`}</Pre>

        <H3>Example request</H3>
        <Pre>{`curl -H "Authorization: Bearer esak_<your-key>" \\
     "https://expert-system.starmode.dev/api/v1/financials/AAPL/metrics?period=quarterly"`}</Pre>
      </EndpointSection>

      {/* GET /api/v1/financials/{symbol}/{metric} */}
      <EndpointSection
        title="Company Financial Metric"
        method="GET"
        path="/api/v1/financials/{symbol}/{metric}"
        description="Returns one compact, normalized SEC time series with optional filing provenance."
      >
        <H3>Path parameters</H3>
        <ParamTable>
          <ParamRow
            name="symbol"
            type="string"
            required
            description="Ticker symbol or SEC CIK."
          />
          <ParamRow
            name="metric"
            type="string"
            required
            description="Canonical metric ID from the v1 catalog."
          />
        </ParamTable>

        <H3>Query parameters</H3>
        <ParamTable>
          <ParamRow
            name="period"
            type="quarterly | annual"
            description="Reporting period. Default: quarterly."
          />
          <ParamRow
            name="limit"
            type="number"
            description="Observations to return. Default: 8. Minimum: 1. Maximum: 40."
          />
          <ParamRow
            name="include"
            type="provenance"
            description="Adds filing date, form, accession number, original concept, and SEC source URL."
          />
        </ParamTable>

        <H3>Response fields</H3>
        <FieldTable>
          <FieldRow
            name="catalogVersion"
            type="string"
            description="Version of the canonical metric catalog."
          />
          <FieldRow
            name="symbol"
            type="string"
            description="Uppercase ticker when the request used a known ticker."
          />
          <FieldRow
            name="cik"
            type="string"
            description="Normalized 10-digit SEC CIK."
          />
          <FieldRow
            name="company"
            type="string"
            description="SEC entity name."
          />
          <FieldRow
            name="metric"
            type="string"
            description="Canonical metric ID."
          />
          <FieldRow
            name="unit"
            type="string"
            description="SEC unit, such as USD or USD/shares."
          />
          <FieldRow
            name="data"
            type="array"
            description="Newest-first observations with date, value, and periodType."
          />
          <FieldRow
            name="source"
            type="string | object"
            description='"SEC" by default; SEC EDGAR provider and URL in provenance mode.'
          />
        </FieldTable>

        <H3>Example request</H3>
        <Pre>{`curl -H "Authorization: Bearer esak_<your-key>" \\
     "https://expert-system.starmode.dev/api/v1/financials/AAPL/accountsPayable?period=quarterly&limit=4"`}</Pre>

        <H3>Compact response</H3>
        <Pre>{`{
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
}`}</Pre>

        <H3>Provenance observation</H3>
        <Pre>{`{
  "date": "2026-06-27",
  "value": 64525000000,
  "periodType": "instant",
  "filed": "2026-07-31",
  "form": "10-Q",
  "accession": "0000320193-26-000020",
  "concept": "AccountsPayableCurrent"
}`}</Pre>
      </EndpointSection>

      {/* POST /api/v1/financials */}
      <EndpointSection
        title="Batch Company Financials"
        method="POST"
        path="/api/v1/financials"
        description="Retrieves several canonical metrics with one company-facts lookup and explicit per-metric availability errors."
      >
        <H3>Request body (JSON)</H3>
        <ParamTable>
          <ParamRow
            name="symbol"
            type="string"
            required
            description="Ticker symbol or SEC CIK."
          />
          <ParamRow
            name="metrics"
            type="string[]"
            required
            description="Between 1 and 27 unique canonical metric IDs."
          />
          <ParamRow
            name="period"
            type="quarterly | annual"
            description="Reporting period. Default: quarterly."
          />
          <ParamRow
            name="limit"
            type="number"
            description="Observations per metric. Default: 8. Minimum: 1. Maximum: 40."
          />
          <ParamRow
            name="include"
            type="provenance"
            description="Adds filing provenance to returned observations."
          />
        </ParamTable>

        <H3>Example request</H3>
        <Pre>{`curl -X POST -H "Authorization: Bearer esak_<your-key>" \\
     -H "Content-Type: application/json" \\
     -d '{"symbol":"AAPL","metrics":["revenue","netIncome","inventory"],"period":"quarterly","limit":4}' \\
     "https://expert-system.starmode.dev/api/v1/financials"`}</Pre>

        <H3>Partial-success response</H3>
        <Pre>{`{
  "catalogVersion": "1",
  "symbol": "AAPL",
  "cik": "0000320193",
  "company": "Apple Inc.",
  "period": "quarterly",
  "metrics": {
    "revenue": {
      "unit": "USD",
      "data": [
        {
          "date": "2026-06-27",
          "value": 109417000000,
          "periodType": "quarter"
        }
      ]
    }
  },
  "errors": {
    "inventory": {
      "code": "METRIC_UNAVAILABLE",
      "message": "inventory is unavailable for AAPL"
    }
  },
  "source": "SEC"
}`}</Pre>
        <P>
          Valid but unavailable metrics appear in <Code>errors</Code> while
          available metrics are returned normally with status 200. An unknown
          metric ID rejects the whole request with <Code>METRIC_NOT_FOUND</Code>
          {"."}
        </P>
      </EndpointSection>

      {/* GET /api/v1/macro/series */}
      <EndpointSection
        title="Macro Series Catalog"
        method="GET"
        path="/api/v1/macro/series"
        description="List or search the supported FRED series before requesting observations."
      >
        <H3>Query parameters</H3>
        <ParamTable>
          <ParamRow
            name="query"
            type="string"
            description="Optional search across series IDs, descriptions, categories, and keywords."
          />
        </ParamTable>
        <H3>Response</H3>
        <Pre>{`{
  "items": [
    {
      "id": "UNRATE",
      "description": "Civilian Unemployment Rate (%)",
      "category": "Labor Market",
      "nativeFrequency": "monthly",
      "nativeUnits": "Percent",
      "sourceUrl": "https://fred.stlouisfed.org/series/UNRATE"
    }
  ]
}`}</Pre>
      </EndpointSection>

      {/* POST /api/v1/macro/observations */}
      <EndpointSection
        title="Macro Observations"
        method="POST"
        path="/api/v1/macro/observations"
        description="Fetch independently configured observations for one to five supported FRED series."
      >
        <H3>Available data</H3>
        <P>
          Select series directly or search the macro series catalog first. Each
          series keeps its native timeline unless you explicitly request a lower
          frequency.
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
        <Pre>{`{
  "series": [
    { "id": "UNRATE", "lastN": 12, "units": "lin" },
    {
      "id": "ICSA",
      "lastN": 12,
      "frequency": "m",
      "aggregationMethod": "avg"
    }
  ]
}`}</Pre>
        <P>
          Send one to five unique series. Each accepts either <Code>lastN</Code>{" "}
          or a complete <Code>startDate</Code>/<Code>endDate</Code> range.
          Transformations are <Code>lin</Code>, <Code>chg</Code>,{" "}
          <Code>ch1</Code>, <Code>pch</Code>, <Code>pc1</Code>, <Code>pca</Code>
          , <Code>cch</Code>, and <Code>cca</Code>. Frequency aggregation
          supports <Code>avg</Code>, <Code>sum</Code>, and <Code>eop</Code>;
          upsampling is rejected.
        </P>
        <P>
          <Code>lin</Code> returns levels; <Code>chg</Code> and <Code>ch1</Code>{" "}
          return period and year-ago changes; <Code>pch</Code> and{" "}
          <Code>pc1</Code> return period and year-ago percent changes;{" "}
          <Code>pca</Code> is compounded annualized percent change; and{" "}
          <Code>cch</Code>/<Code>cca</Code> are continuously compounded period
          and annualized changes.
        </P>
        <P>
          Use one series for simple questions and batches for comparisons. Keep
          native frequency by default; request an explicit lower frequency and
          aggregation method only when comparable periods are required.
        </P>

        <H3>Response</H3>
        <Pre>{`{
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
      "observations": [{ "date": "2026-07-01", "value": 4.2 }]
    }
  ],
  "errors": []
}`}</Pre>

        <H3>Response fields</H3>
        <FieldTable>
          <FieldRow
            name="items"
            type="array"
            description="Successful series with independent frequency, transformation, source, and observations."
          />
          <FieldRow
            name="errors"
            type="array"
            description="Per-series provider errors; successful series remain available."
          />
        </FieldTable>

        <H3>Example request</H3>
        <Pre>{`curl -X POST -H "Authorization: Bearer esak_<your-key>" \\
     -H "Content-Type: application/json" \\
     -d '{"series":[{"id":"UNRATE","lastN":12}]}' \\
     "https://expert-system.starmode.dev/api/v1/macro/observations"`}</Pre>
      </EndpointSection>

      {/* Error reference */}
      <Section>
        <H2>Error responses</H2>
        <P>
          Errors return a JSON body with an <Code>error</Code> field and the
          corresponding HTTP status code. Financial endpoints use a nested,
          machine-readable code and message.
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
            name="404 Not Found"
            type=""
            description="Company, metric, or company-specific metric data was not found."
          />
          <FieldRow
            name="429 Too Many Requests"
            type=""
            description="Monthly API quota or upstream SEC rate limit was reached."
          />
          <FieldRow
            name="502 Bad Gateway"
            type=""
            description="SEC EDGAR was unavailable or returned an invalid payload."
          />
        </FieldTable>
        <H3>Legacy endpoint error</H3>
        <Pre>{`{ "error": "Missing required parameter: ids" }`}</Pre>
        <H3>Financial endpoint error</H3>
        <Pre>{`{
  "error": {
    "code": "METRIC_UNAVAILABLE",
    "message": "inventory is unavailable for JPM"
  }
}`}</Pre>
        <P>
          Financial error codes include <Code>UNAUTHORIZED</Code>,{" "}
          <Code>INVALID_REQUEST</Code>, <Code>COMPANY_NOT_FOUND</Code>,{" "}
          <Code>METRIC_NOT_FOUND</Code>, <Code>METRIC_UNAVAILABLE</Code>,{" "}
          <Code>SEC_UNAVAILABLE</Code>, <Code>RATE_LIMITED</Code>, and{" "}
          <Code>INTERNAL_ERROR</Code>.
        </P>
      </Section>
    </div>
  );
}
