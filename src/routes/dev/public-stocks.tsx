import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { useInfiniteScroll } from "~/lib/use-infinite-scroll";
import {
  activateEarningsCatalogStocksSF,
  deactivateTrackedStockSF,
  getEarningsCatalogStatusSF,
  listTrackedStocksSF,
  queryEarningsCatalogSF,
  requestEarningsCatalogSyncSF,
  requestEarningsSyncSF,
  type EarningsCatalogCompanyView,
} from "~/server/earnings";

export const Route = createFileRoute("/dev/public-stocks")({
  validateSearch: (search: Record<string, unknown> | undefined) => ({
    catalogSearch:
      typeof search?.catalogSearch === "string"
        ? search.catalogSearch
        : undefined,
  }),
  loaderDeps: ({ search: { catalogSearch } }) => ({ catalogSearch }),
  loader: async ({ deps: { catalogSearch } }) => {
    const [stocks, catalog, catalogStatus] = await Promise.all([
      listTrackedStocksSF(),
      queryEarningsCatalogSF({
        data: { search: catalogSearch, cursor: null, limit: 50 },
      }),
      getEarningsCatalogStatusSF(),
    ]);
    return { stocks, catalog, catalogStatus, catalogSearch };
  },
  component: EarningsManagementPage,
});

function formatDate(value: string | null): string {
  if (!value) return "Unknown";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function statusClasses(
  status: "pending" | "processing" | "takeaways_queued" | "failed",
): string {
  switch (status) {
    case "takeaways_queued":
      return "bg-emerald-50 text-emerald-700";
    case "failed":
      return "bg-red-50 text-red-700";
    case "processing":
      return "bg-blue-50 text-blue-700";
    case "pending":
      return "bg-amber-50 text-amber-700";
  }
}

function CatalogRow({
  company,
  selected,
  onToggle,
}: {
  company: EarningsCatalogCompanyView;
  selected: boolean;
  onToggle: () => void;
}) {
  const active = company.trackedActive;
  return (
    <label
      className={`flex gap-3 px-4 py-3 ${
        active ? "cursor-default bg-emerald-50/40" : "cursor-pointer"
      }`}
    >
      <input
        type="checkbox"
        checked={active || selected}
        disabled={active}
        onChange={onToggle}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-slate-900"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-semibold text-gray-900">{company.symbol}</span>
          <span className="text-sm text-gray-700">{company.companyName}</span>
          {active ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
              Active
            </span>
          ) : company.trackedStockId ? (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              Inactive
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-gray-500">
          {[company.exchange, company.sector, company.industry]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="mt-1 text-xs text-gray-400">
          {company.callCount} calls · Latest {formatDate(company.latestCallAt)}{" "}
          · {company.mic}
        </p>
      </div>
    </label>
  );
}

function EarningsManagementPage() {
  const {
    stocks,
    catalog: initialCatalog,
    catalogStatus,
    catalogSearch,
  } = Route.useLoaderData();
  const router = useRouter();
  const activateStocks = useServerFn(activateEarningsCatalogStocksSF);
  const deactivateStock = useServerFn(deactivateTrackedStockSF);
  const requestSync = useServerFn(requestEarningsSyncSF);
  const requestCatalogSync = useServerFn(requestEarningsCatalogSyncSF);

  const activeListingKey = stocks
    .filter((stock) => stock.active)
    .map((stock) => `${stock.symbol}:${stock.mic}`)
    .sort()
    .join(",");
  const catalogResetKey = JSON.stringify({
    catalogSearch,
    activeListingKey,
  });
  const {
    items: catalogCompanies,
    sentinelRef,
    isLoadingMore,
    isExhausted,
  } = useInfiniteScroll({
    initialData: initialCatalog,
    fetchPage: (cursor) =>
      queryEarningsCatalogSF({
        data: { search: catalogSearch, cursor, limit: 50 },
      }),
    resetKey: catalogResetKey,
  });

  const [catalogSearchInput, setCatalogSearchInput] = useState(
    catalogSearch ?? "",
  );
  const [trackedSearch, setTrackedSearch] = useState("");
  const [selectedCatalogIds, setSelectedCatalogIds] = useState<Set<string>>(
    new Set(),
  );
  const [busyStockId, setBusyStockId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [catalogSyncing, setCatalogSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredStocks = useMemo(() => {
    const query = trackedSearch.trim().toLowerCase();
    if (!query) return stocks;
    return stocks.filter((stock) =>
      `${stock.symbol} ${stock.companyName} ${stock.exchange} ${stock.mic}`
        .toLowerCase()
        .includes(query),
    );
  }, [stocks, trackedSearch]);

  const refresh = async () => {
    await router.invalidate();
  };

  const toggleCatalogSelection = (catalogId: string) => {
    setSelectedCatalogIds((current) => {
      const next = new Set(current);
      if (next.has(catalogId)) next.delete(catalogId);
      else next.add(catalogId);
      return next;
    });
  };

  const handleCatalogSearch = () => {
    void router.navigate({
      to: "/dev/public-stocks",
      search: {
        catalogSearch: catalogSearchInput.trim() || undefined,
      },
    });
  };

  const handleActivateSelected = async () => {
    setAdding(true);
    setError(null);
    setMessage(null);
    try {
      const result = await activateStocks({
        data: { catalogIds: [...selectedCatalogIds] },
      });
      setSelectedCatalogIds(new Set());
      setMessage(
        `${String(result.selected)} stocks activated; ${String(result.hydrationQueued)} latest earnings calls queued.`,
      );
      await refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Failed to activate stocks",
      );
    } finally {
      setAdding(false);
    }
  };

  const handleDeactivate = async (stockId: string) => {
    setBusyStockId(stockId);
    setError(null);
    setMessage(null);
    try {
      await deactivateStock({ data: { stockId } });
      setMessage("Stock deactivated. Existing earnings data was retained.");
      await refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Failed to deactivate stock",
      );
    } finally {
      setBusyStockId(null);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    setMessage(null);
    try {
      await requestSync();
      setMessage("Earnings transcript sync requested.");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Failed to request sync",
      );
    } finally {
      setSyncing(false);
    }
  };

  const handleCatalogSync = async () => {
    setCatalogSyncing(true);
    setError(null);
    setMessage(null);
    try {
      await requestCatalogSync();
      setMessage(
        "Company catalog refresh requested. It will update in the background.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Failed to request catalog refresh",
      );
    } finally {
      setCatalogSyncing(false);
    }
  };

  return (
    <div className="min-h-[calc(100dvh-64px-49px)]">
      <main className="mx-auto flex max-w-4xl flex-col gap-4 px-3 py-5 sm:px-6">
        <section className="border border-gray-200 bg-white">
          <div className="border-b border-gray-200 p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  Select earnings stocks
                </h1>
                <p className="mt-1 max-w-xl text-sm text-gray-500">
                  Search the earningscalls.dev company catalog and select the US
                  listings the system should ingest.
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  {catalogStatus.count.toLocaleString()} companies
                  {catalogStatus.lastSyncedAt
                    ? ` · Updated ${formatDate(catalogStatus.lastSyncedAt)}`
                    : " · Catalog not populated"}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleCatalogSync()}
                  disabled={catalogSyncing}
                  className="cursor-pointer rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {catalogSyncing ? "Requesting…" : "Refresh catalog"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSync()}
                  disabled={syncing}
                  className="cursor-pointer rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {syncing ? "Requesting…" : "Sync calls"}
                </button>
              </div>
            </div>

            <form
              className="mt-4 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                handleCatalogSearch();
              }}
            >
              <input
                value={catalogSearchInput}
                onChange={(event) => {
                  setCatalogSearchInput(event.target.value);
                }}
                placeholder="Search ticker, company, sector, industry, or exchange…"
                className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
              />
              <button
                type="submit"
                className="cursor-pointer rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              >
                Search
              </button>
            </form>

            {message ? (
              <p className="mt-3 text-sm text-emerald-700">{message}</p>
            ) : null}
            {error ? (
              <p className="mt-3 text-sm text-red-700">{error}</p>
            ) : null}
          </div>

          <div className="max-h-[30rem] divide-y divide-gray-100 overflow-y-auto">
            {catalogCompanies.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                {catalogStatus.count === 0
                  ? "Refresh the company catalog to populate available stocks."
                  : "No companies match this search."}
              </div>
            ) : (
              catalogCompanies.map((company) => (
                <CatalogRow
                  key={company.id}
                  company={company}
                  selected={selectedCatalogIds.has(company.id)}
                  onToggle={() => {
                    toggleCatalogSelection(company.id);
                  }}
                />
              ))
            )}
            <div
              ref={sentinelRef}
              className="py-3 text-center text-xs text-gray-400"
            >
              {isLoadingMore
                ? "Loading more…"
                : !isExhausted
                  ? "Scroll for more"
                  : null}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-gray-200 p-4">
            <span className="text-sm text-gray-500">
              {selectedCatalogIds.size} selected
            </span>
            <button
              type="button"
              onClick={() => void handleActivateSelected()}
              disabled={adding || selectedCatalogIds.size === 0}
              className="cursor-pointer rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {adding
                ? "Adding…"
                : `Add ${String(selectedCatalogIds.size)} stocks`}
            </button>
          </div>
        </section>

        <section className="border border-gray-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Tracked stocks</h2>
              <p className="text-sm text-gray-500">
                {stocks.filter((stock) => stock.active).length} active,{" "}
                {stocks.length} total
              </p>
            </div>
            <input
              value={trackedSearch}
              onChange={(event) => {
                setTrackedSearch(event.target.value);
              }}
              placeholder="Filter tracked stocks…"
              className="rounded border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-gray-400"
            />
          </div>

          {filteredStocks.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              No tracked stocks found.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredStocks.map((stock) => (
                <article
                  key={stock.id}
                  className={`p-4 ${stock.active ? "" : "bg-gray-50 opacity-70"}`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to="/stocks/$symbol"
                          params={{ symbol: stock.symbol }}
                          className="font-semibold text-gray-900 hover:underline"
                        >
                          {stock.symbol}
                        </Link>
                        <span className="text-sm text-gray-600">
                          {stock.companyName}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            stock.active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-gray-200 text-gray-600"
                          }`}
                        >
                          {stock.active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-400">
                        {stock.exchange} · {stock.mic} · {stock.country}
                      </p>

                      {stock.latestCall ? (
                        <div className="mt-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm text-gray-700">
                              {stock.latestCall.transcriptTitle}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs ${statusClasses(stock.latestCall.status)}`}
                            >
                              {stock.latestCall.status.replaceAll("_", " ")}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-gray-400">
                            {formatDate(stock.latestCall.eventDateTime)}
                          </p>
                          {stock.latestCall.lastError ? (
                            <p className="mt-1 text-xs text-red-600">
                              {stock.latestCall.lastError}
                            </p>
                          ) : null}
                          {stock.latestCall.documentId ? (
                            <Link
                              to="/feeds/news/$documentid"
                              params={{
                                documentid: stock.latestCall.documentId,
                              }}
                              className="mt-1 inline-block text-xs font-medium text-blue-700 hover:underline"
                            >
                              View transcript
                            </Link>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    {stock.active ? (
                      <button
                        type="button"
                        onClick={() => void handleDeactivate(stock.id)}
                        disabled={busyStockId === stock.id}
                        className="cursor-pointer rounded px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        {busyStockId === stock.id
                          ? "Deactivating…"
                          : "Deactivate"}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-500">
                        Select above to reactivate
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
