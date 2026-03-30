import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  listBlogFeedsSF,
  fetchFeedArticlesSF,
  toggleBlogEnabledSF,
  addBlogFeedSF,
  deleteBlogFeedSF,
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
  const { feeds: loaderFeeds } = Route.useLoaderData();
  const [feeds, setFeeds] = useState(loaderFeeds);
  const [selectedFeed, setSelectedFeed] = useState<BlogFeed | null>(null);
  const [articles, setArticles] = useState<FeedArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [search, setSearch] = useState("");
  const [addUrl, setAddUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filteredFeeds = useMemo(() => {
    const q = search.toLowerCase().trim();
    const filtered = q
      ? feeds.filter((f) => {
          const haystack =
            `${f.title}\0${f.description ?? ""}\0${f.htmlUrl ?? ""}`.toLowerCase();
          return haystack.includes(q);
        })
      : [...feeds];

    return filtered.sort((a, b) => {
      // Enabled feeds first
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      // Then alphabetically by title
      return a.title.localeCompare(b.title);
    });
  }, [feeds, search]);

  const fetchArticles = useServerFn(fetchFeedArticlesSF);
  const toggleEnabled = useServerFn(toggleBlogEnabledSF);
  const addBlogFeed = useServerFn(addBlogFeedSF);
  const deleteBlogFeed = useServerFn(deleteBlogFeedSF);

  const handleToggleEnabled = async (feed: BlogFeed) => {
    setToggling(true);
    try {
      const result = await toggleEnabled({ data: { blogId: feed.id } });
      const updated = { ...feed, enabled: result.enabled };
      setFeeds((prev) => prev.map((f) => (f.id === feed.id ? updated : f)));
      if (selectedFeed?.id === feed.id) {
        setSelectedFeed(updated);
      }
    } catch {
      // Silently fail — state stays unchanged
    } finally {
      setToggling(false);
    }
  };

  const handleAddFeed = async () => {
    const url = addUrl.trim();
    if (!url) return;
    setAdding(true);
    setAddError(null);
    try {
      const feed = await addBlogFeed({ data: { xmlUrl: url } });
      setFeeds((prev) => [feed, ...prev.filter((f) => f.id !== feed.id)]);
      setAddUrl("");
      void handleSelectFeed(feed);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Failed to add feed");
    } finally {
      setAdding(false);
    }
  };

  const handleSelectFeed = async (feed: BlogFeed) => {
    setSelectedFeed(feed);
    setArticles([]);
    setError(null);
    setLoading(true);

    try {
      const result = await fetchArticles({ data: { xmlUrl: feed.xmlUrl } });
      setArticles(
        [...result.articles].sort((a, b) => {
          if (!a.pubDate) return 1;
          if (!b.pubDate) return -1;
          return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load articles");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFeed = async (feed: BlogFeed) => {
    setDeleting(true);
    try {
      await deleteBlogFeed({ data: { blogId: feed.id } });
      setFeeds((prev) => prev.filter((f) => f.id !== feed.id));
      setSelectedFeed(null);
      setArticles([]);
    } catch {
      // Silently fail — state stays unchanged
    } finally {
      setDeleting(false);
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
        <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
          {/* Feed list */}
          <div
            className={`flex min-h-0 w-full flex-1 flex-col gap-3 md:w-72 md:flex-none md:shrink-0 ${selectedFeed ? "hidden md:flex" : ""}`}
          >
            {/* Add blog feed */}
            <div className="shrink-0 border border-gray-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-gray-900">
                Add Blog Feed
              </h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleAddFeed();
                }}
                className="mt-2 flex gap-1.5"
              >
                <input
                  type="text"
                  placeholder="Paste feed URL..."
                  value={addUrl}
                  onChange={(e) => {
                    setAddUrl(e.target.value);
                    setAddError(null);
                  }}
                  className="min-w-0 flex-1 rounded border border-gray-200 px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-gray-400"
                />
                <button
                  type="submit"
                  disabled={adding || !addUrl.trim()}
                  className="shrink-0 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                >
                  {adding ? "Adding..." : "Add"}
                </button>
              </form>
              {addError ? (
                <p className="mt-1 text-xs text-red-600">{addError}</p>
              ) : null}
            </div>

            {/* Blog feeds list */}
            <div className="flex min-h-0 flex-1 flex-col border border-gray-200 bg-white">
              <div className="shrink-0 border-b border-gray-200 p-4">
                <h2 className="text-base font-semibold text-gray-900">
                  Blog Feeds
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {filteredFeeds.length === feeds.length
                    ? `${feeds.length} feeds`
                    : `${filteredFeeds.length} of ${feeds.length} feeds`}
                </p>
                <input
                  type="text"
                  placeholder="Search feeds..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                  }}
                  className="mt-3 w-full rounded border border-gray-200 px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-gray-400"
                />
              </div>
              <div className="min-h-0 flex-1 divide-y divide-gray-100 overflow-y-auto">
                {filteredFeeds.map((feed) => (
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
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${feed.enabled ? "bg-green-500" : "bg-gray-300"}`}
                      />
                      <span
                        className={`truncate text-sm font-medium ${
                          selectedFeed?.xmlUrl === feed.xmlUrl
                            ? "text-slate-900"
                            : "text-gray-700"
                        }`}
                      >
                        {feed.title}
                      </span>
                    </div>
                    {feed.description ? (
                      <div className="mt-0.5 line-clamp-1 pl-3 text-xs text-gray-400">
                        {feed.description}
                      </div>
                    ) : feed.htmlUrl ? (
                      <div className="mt-0.5 truncate pl-3 text-xs text-gray-400">
                        {feed.htmlUrl.replace(/^https?:\/\//, "")}
                      </div>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Article list */}
          <div
            className={`flex min-h-0 min-w-0 flex-1 flex-col border border-gray-200 bg-white ${selectedFeed ? "" : "hidden md:flex"}`}
          >
            {selectedFeed ? (
              <>
                <div className="shrink-0 border-b border-gray-200 p-4">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFeed(null);
                    }}
                    className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 md:hidden"
                  >
                    <span aria-hidden="true">&larr;</span> All feeds
                  </button>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold text-gray-900">
                        {selectedFeed.title}
                      </h2>
                      {selectedFeed.description ? (
                        <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                          {selectedFeed.description}
                        </p>
                      ) : null}
                      {selectedFeed.htmlUrl ? (
                        <a
                          href={selectedFeed.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 block truncate text-xs text-blue-600 hover:underline"
                        >
                          {selectedFeed.htmlUrl.replace(/^https?:\/\//, "")}
                        </a>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={toggling}
                          onClick={() => handleToggleEnabled(selectedFeed)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors disabled:opacity-50 ${selectedFeed.enabled ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                        >
                          <span
                            className={`inline-block h-1.5 w-1.5 rounded-full ${selectedFeed.enabled ? "bg-green-500" : "bg-gray-400"}`}
                          />
                          {selectedFeed.enabled ? "Enabled" : "Disabled"}
                        </button>
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                          {selectedFeed.contentInFeed
                            ? "Full content in feed"
                            : "Requires scraping"}
                        </span>
                        <a
                          href={selectedFeed.xmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-blue-600 hover:bg-gray-200"
                        >
                          RSS Feed
                        </a>
                        {selectedFeed.lastScrapedAt ? (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                            Last scraped{" "}
                            {formatDate(selectedFeed.lastScrapedAt)}
                          </span>
                        ) : null}
                        <button
                          type="button"
                          disabled={deleting}
                          onClick={() => handleDeleteFeed(selectedFeed)}
                          className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
                        >
                          {deleting ? "Deleting..." : "Delete"}
                        </button>
                      </div>
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
