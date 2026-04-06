import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { scrapeUrlSF } from "~/server/scrape-url";

export const Route = createFileRoute("/dev/scrape")({
  component: ScrapeUrlPage,
});

type ScrapeResult =
  | {
      success: true;
      documentId: string;
      title: string;
      summary: string;
      isSubstantive: boolean;
      imageCount: number;
      textLength: number;
    }
  | { success: false; error: string };

function ScrapeUrlPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scrapeUrl = useServerFn(scrapeUrlSF);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await scrapeUrl({ data: { url: trimmed } });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-3 py-6 sm:px-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6">
        <h1 className="text-lg font-semibold text-gray-900">Scrape URL</h1>
        <p className="mt-1 text-sm text-gray-500">
          Enter any article URL to scrape, extract images, and generate
          takeaways.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex gap-3">
          <input
            type="url"
            placeholder="https://example.com/article"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
            }}
            disabled={loading}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="cursor-pointer rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Scraping..." : "Scrape"}
          </button>
        </form>

        {loading ? (
          <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
            <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
            <p className="text-sm text-gray-600">
              Scraping page, processing images, and generating summary...
            </p>
            <p className="mt-1 text-xs text-gray-400">This may take 15-30s</p>
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        ) : null}

        {result ? (
          <div className="mt-6 space-y-4">
            {result.success ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <h3 className="font-medium text-green-800">
                  Scraped successfully
                </h3>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex gap-2">
                    <dt className="font-medium text-gray-600">Title:</dt>
                    <dd className="text-gray-900">{result.title}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium text-gray-600">Summary:</dt>
                    <dd className="text-gray-900">{result.summary}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium text-gray-600">Text:</dt>
                    <dd className="text-gray-900">
                      {result.textLength.toLocaleString()} chars
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium text-gray-600">Images:</dt>
                    <dd className="text-gray-900">{result.imageCount} saved</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium text-gray-600">Substantive:</dt>
                    <dd className="text-gray-900">
                      {result.isSubstantive ? "Yes" : "No"}
                    </dd>
                  </div>
                  {result.isSubstantive ? (
                    <div className="flex gap-2">
                      <dt className="font-medium text-gray-600">Takeaways:</dt>
                      <dd className="text-gray-900">
                        Generation triggered (check Inngest dashboard)
                      </dd>
                    </div>
                  ) : null}
                </dl>
                <div className="mt-4">
                  <Link
                    to="/feeds/news/$documentid"
                    params={{ documentid: result.documentId }}
                    className="text-sm font-medium text-green-700 hover:text-green-900 hover:underline"
                  >
                    View document in feed &rarr;
                  </Link>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-700">{result.error}</p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
