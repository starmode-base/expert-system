import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  listBlogFeedsSF,
  fetchFeedArticlesSF,
  type BlogFeed,
} from "~/server/blog-feeds";

export const Route = createFileRoute("/settings/blog-feeds")({
  loader: async () => {
    const feeds = await listBlogFeedsSF();
    return { feeds };
  },
  component: BlogFeedsRoute,
});

interface FeedArticle {
  title: string;
  link: string;
  pubDate: string | null;
}

function BlogFeedsRoute() {
  const { feeds } = Route.useLoaderData();
  const [selectedFeed, setSelectedFeed] = useState<BlogFeed | null>(null);
  const [articles, setArticles] = useState<FeedArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchArticles = useServerFn(fetchFeedArticlesSF);

  const handleSelectFeed = async (feed: BlogFeed) => {
    setSelectedFeed(feed);
    setArticles([]);
    setError(null);
    setLoading(true);

    try {
      const result = await fetchArticles({ data: { xmlUrl: feed.xmlUrl } });
      setArticles(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load articles");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return null;
    }
  };

  return (
    <div className="h-[calc(100dvh-64px-49px)] overflow-hidden">
      <div className="mx-auto flex h-full max-w-4xl flex-col px-2 py-4 sm:px-4">
        <div className="flex min-h-0 flex-1 gap-4">
          {/* Feed list */}
          <div className="flex w-72 shrink-0 flex-col border border-gray-200 bg-white">
            <div className="shrink-0 border-b border-gray-200 p-4">
              <h2 className="text-base font-semibold text-gray-900">
                Blog Feeds
              </h2>
              <p className="mt-1 text-sm text-gray-500">{feeds.length} feeds</p>
            </div>
            <div className="min-h-0 flex-1 divide-y divide-gray-100 overflow-y-auto">
              {feeds.map((feed) => (
                <button
                  key={feed.xmlUrl}
                  type="button"
                  onClick={() => handleSelectFeed(feed)}
                  className={`w-full cursor-pointer px-4 py-3 text-left transition-colors ${
                    selectedFeed?.xmlUrl === feed.xmlUrl
                      ? "bg-slate-50"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div
                    className={`text-sm font-medium ${
                      selectedFeed?.xmlUrl === feed.xmlUrl
                        ? "text-slate-900"
                        : "text-gray-700"
                    }`}
                  >
                    {feed.title}
                  </div>
                  {feed.htmlUrl ? (
                    <div className="mt-0.5 truncate text-xs text-gray-400">
                      {feed.htmlUrl.replace(/^https?:\/\//, "")}
                    </div>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          {/* Article list */}
          <div className="flex min-w-0 flex-1 flex-col border border-gray-200 bg-white">
            {selectedFeed ? (
              <>
                <div className="shrink-0 border-b border-gray-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold text-gray-900">
                        {selectedFeed.title}
                      </h2>
                      {selectedFeed.htmlUrl ? (
                        <a
                          href={selectedFeed.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 block truncate text-sm text-blue-600 hover:underline"
                        >
                          {selectedFeed.htmlUrl.replace(/^https?:\/\//, "")}
                        </a>
                      ) : null}
                    </div>
                    {!loading && articles.length > 0 ? (
                      <span className="shrink-0 rounded-full border border-gray-200 px-2 py-1 text-xs text-gray-500">
                        {articles.length} articles
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {loading ? (
                    <div className="flex items-center justify-center p-6">
                      <div className="text-sm text-gray-400">
                        Loading articles...
                      </div>
                    </div>
                  ) : error ? (
                    <div className="p-4">
                      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        {error}
                      </div>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {articles.map((article, i) => (
                        <a
                          key={`${article.link}-${i}`}
                          href={article.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block px-4 py-3 transition-colors hover:bg-gray-50"
                        >
                          <div className="text-sm font-medium text-gray-900">
                            {article.title}
                          </div>
                          {formatDate(article.pubDate) ? (
                            <div className="mt-1 text-xs text-gray-400">
                              {formatDate(article.pubDate)}
                            </div>
                          ) : null}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-sm text-gray-400">
                  Select a feed to view its articles
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
