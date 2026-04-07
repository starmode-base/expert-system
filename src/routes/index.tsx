import { useEffect, useRef, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CopyPre } from "~/lib/copy-pre";
import { vectorTakeawaySearchTimeWeighted } from "~/server/vector-queries";

const demoSearchFn = createServerFn({ method: "GET" })
  .validator(z.object({ query: z.string().min(1).max(200) }))
  .handler(async ({ data: { query } }) => {
    const results = await vectorTakeawaySearchTimeWeighted(query, {
      limit: 10,
    });
    return {
      items: results.map((r) => ({
        id: r.id,
        documentId: r.documentId,
        title: r.title,
        summary: r.summary,
        source: r.source,
        documentTitle: r.documentTitle,
        documentLink: r.documentLink,
        publicationDate: r.publicationDate,
      })),
    };
  });

export const Route = createFileRoute("/")({
  component: LandingPage,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function FadeIn({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={ref}
      style={{
        opacity: 0,
        transform: "translateY(1.5rem)",
        transition: "opacity 0.7s ease-out, transform 0.7s ease-out",
      }}
    >
      {children}
    </div>
  );
}

function StepCard({
  step,
  title,
  description,
  example,
}: {
  step: string;
  title: string;
  description: React.ReactNode;
  example: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-lg font-bold text-white">
          {step}
        </span>
        <h3 className="text-lg font-medium text-slate-900">{title}</h3>
      </div>
      <p className="text-sm leading-relaxed text-slate-600">{description}</p>
      <pre className="overflow-x-auto rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-700">
        {example}
      </pre>
    </div>
  );
}

function ApiPlayground() {
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("enterprise AI adoption barriers");

  const requestUrl = query.trim()
    ? `GET /api/v1/takeaways/search?query=${encodeURIComponent(query.trim())}&limit=10&recent=true`
    : "GET /api/v1/takeaways/search?query=…&recent=true";

  async function handleSearch() {
    const trimmed = query.trim();
    if (!trimmed) return;
    setLoading(true);
    setResponse(null);
    try {
      const result = await demoSearchFn({ data: { query: trimmed } });
      setResponse(JSON.stringify(result, null, 2));
    } catch {
      setResponse(JSON.stringify({ error: "Something went wrong" }, null, 2));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleSearch();
          }}
          placeholder="enterprise AI adoption barriers"
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none"
        />
        <button
          onClick={() => void handleSearch()}
          disabled={loading || !query.trim()}
          className="shrink-0 rounded-lg bg-slate-900 px-5 py-2.5 font-mono text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-40"
        >
          {loading ? "…" : "Run"}
        </button>
      </div>

      {/* Request preview */}
      <pre className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-900 p-3 font-mono text-xs leading-relaxed text-emerald-400">
        {requestUrl}
      </pre>

      {/* Response */}
      {(response ?? loading) ? (
        <pre className="max-h-96 overflow-auto rounded-lg border border-slate-700 bg-slate-900 p-3 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-slate-200">
          {loading ? "Searching…" : response}
        </pre>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function LandingPage() {
  const openingStatementClassName =
    "text-center text-2xl leading-relaxed text-slate-600 sm:text-3xl";

  return (
    <div className="min-h-[calc(100dvh-64px)]">
      {/* Hero */}
      <div className="flex min-h-[calc(100dvh-64px)] flex-col items-center justify-center px-4 sm:px-6">
        <div className="flex w-full max-w-4xl flex-col items-center gap-6 rounded-lg bg-white p-6 sm:p-10">
          <div className="flex items-center gap-2 opacity-60">
            <img
              src="/starmode-logo.svg"
              alt="STΛR MODΞ logo"
              className="h-5 w-auto"
            />
          </div>
          <h1 className="text-center text-3xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            ΞXPERT-SYSTΞM
          </h1>
          <p className={openingStatementClassName}>
            <span className="font-medium text-amber-600">
              The knowledge layer for your agent.
            </span>{" "}
            Every earnings call, blog, and podcast, indexed by insight.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/account/api-keys"
              className="rounded-full bg-amber-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-700"
            >
              Get an API key
            </Link>
            <a
              href="#how-it-works"
              className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              How it works
            </a>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto flex max-w-4xl flex-col gap-16 px-4 pb-16 sm:gap-32 sm:px-6 sm:pb-32">
        {/* What's inside */}
        <FadeIn>
          <div>
            <h2 className={`mb-4 ${openingStatementClassName}`}>
            The most effective research system available for AI agents
            </h2>
            <img
              src="/expert-system-explainer.svg"
              alt="Sources like earnings transcripts, tech blogs, podcasts, and expert commentary flow into Expert System and become searchable atomic insights"
              className="w-full rounded-lg   bg-white"
            />
            <p className="mx-auto mt-24  text-2xl text-center leading-relaxed text-slate-500">
              AI, markets, and technology are moving faster than any person can
              track.{" "}
              <span className="font-medium text-amber-600">
                Don&apos;t burn your agent&apos;s context window searching the
                open web.
              </span>{" "} <br/> <br />
              ΞXPERT-SYSTΞM continuously reads, distills, and indexes hundreds
              of earnings calls, technical blogs, podcasts, and expert
              commentary, so your agent finds{" "}
              <span className="font-medium text-amber-600">
                the right insight in one query, not ten pages.
              </span>
            </p>
          </div>
        </FadeIn>

        {/* How it works */}
        <FadeIn>
          <div id="how-it-works" className="scroll-mt-20">

            <div className="grid gap-4 sm:grid-cols-2 mb-4">
              <StepCard
                step="1"
                title="Search insights"
                description={
                  <>
                    Semantic search across{" "}
                    <span className="font-medium text-amber-600">
                      thousands of pre-extracted insights
                    </span>
                    . Each result is 2-3 sentences, enough to decide if it's
                    relevant without burning context.
                  </>
                }
                example={`GET /api/v1/takeaways/search?query=AI+infrastructure+spending

→ 3 results, ~200 tokens total`}
              />
              <StepCard
                step="2"
                title="Drill into sources"
                description="Found something relevant? Pull the full earnings transcript, blog post, or research note with metadata and provenance."
                example={`GET /api/v1/documents?ids=doc_xyz789

→ Full article text + source link`}
              />

            </div>

            <StepCard
                step="3"
                title="Query structured data"
                description={
                  <>
                    Ask natural language questions about macroeconomic
                    indicators or company financials. Get clean JSON back,{" "}
                    <span className="font-medium text-amber-600">
                      no scraping, no parsing.
                    </span>
                  </>
                }
                example={`POST /api/v1/query/macro
  {"query": "Current GDP growth"}

→ Structured FRED data`}
              />

          </div>
        </FadeIn>

        {/* Try it */}
        <FadeIn>
          <div>

            <ApiPlayground />
          </div>
        </FadeIn>

        {/* Install */}
        <FadeIn>
          <div>
            <h2 className={`mb-5 ${openingStatementClassName}`}>
            Get started in 30 seconds
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Step 1 */}
              <div className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                    1
                  </span>
                  <h3 className="text-sm font-medium text-slate-900">
                    Get an API key
                  </h3>
                </div>
                <p className="mb-4 text-sm leading-relaxed text-slate-600">
                  Create a free account and generate your key.
                </p>
                <Link
                  to="/account/api-keys"
                  className="inline-block rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                >
                  Get API key
                </Link>
              </div>

              {/* Step 2 */}
              <div className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                    2
                  </span>
                  <h3 className="text-sm font-medium text-slate-900">
                    Install the skill
                  </h3>
                </div>
                <p className="mb-3 text-xs font-medium tracking-wide text-slate-500 uppercase">
                  Claude Code
                </p>
                <div className="mb-3">
                  <CopyPre>
                    {`/plugin install github://starmode-base/expert-system-plugin`}
                  </CopyPre>
                </div>
                <p className="mb-3 text-xs font-medium tracking-wide text-slate-500 uppercase">
                  Any agent (Cursor, Copilot, Cline, Codex)
                </p>
                <CopyPre>
                  {`npx skills add starmode-base/expert-system-plugin`}
                </CopyPre>
              </div>
            </div>

            <p className="mt-4 text-center text-xs text-slate-500">
              Works with any agent that supports the{" "}
              <a
                href="https://agentskills.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-800"
              >
                Agent Skills
              </a>{" "}
              standard. Or use the{" "}
              <Link
                to="/account/api-docs"
                className="text-blue-600 underline hover:text-blue-800"
              >
                API directly
              </Link>
              .
            </p>
          </div>
        </FadeIn>

        {/* Footer links */}
        <div className="flex justify-center gap-3 py-8">
          <Link
            to="/account/api-docs"
            className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            API reference
          </Link>
          <a
            href="https://github.com/starmode-base/expert-system-plugin"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
