import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  deactivateTrackedStockSF,
  listTrackedStocksSF,
  requestEarningsSyncSF,
  trackStockSF,
} from "~/server/earnings";

export const Route = createFileRoute("/dev/public-stocks")({
  loader: async () => ({ stocks: await listTrackedStocksSF() }),
  component: EarningsManagementPage,
});

function formatDate(value: string): string {
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

function EarningsManagementPage() {
  const { stocks } = Route.useLoaderData();
  const router = useRouter();
  const trackStock = useServerFn(trackStockSF);
  const deactivateStock = useServerFn(deactivateTrackedStockSF);
  const requestSync = useServerFn(requestEarningsSyncSF);

  const [symbol, setSymbol] = useState("");
  const [search, setSearch] = useState("");
  const [busyStockId, setBusyStockId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredStocks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return stocks;
    return stocks.filter((stock) =>
      `${stock.symbol} ${stock.companyName} ${stock.exchange} ${stock.mic}`
        .toLowerCase()
        .includes(query),
    );
  }, [search, stocks]);

  const refresh = async () => {
    await router.invalidate();
  };

  const handleTrack = async (stockSymbol: string) => {
    setAdding(true);
    setError(null);
    setMessage(null);
    try {
      const result = await trackStock({ data: { symbol: stockSymbol } });
      setSymbol("");
      setMessage(
        `${result.symbol} is active. Its latest call has been queued for processing.`,
      );
      await refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Failed to track stock",
      );
    } finally {
      setAdding(false);
      setBusyStockId(null);
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
      setMessage("Earnings sync requested.");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Failed to request sync",
      );
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-[calc(100dvh-64px-49px)]">
      <main className="mx-auto flex max-w-4xl flex-col gap-4 px-3 py-5 sm:px-6">
        <section className="border border-gray-200 bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                Earnings ingestion
              </h1>
              <p className="mt-1 max-w-xl text-sm text-gray-500">
                This is the global source list. Active stocks are checked every
                15 minutes and each new transcript is processed once for the
                whole system.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleSync()}
              disabled={syncing}
              className="cursor-pointer rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {syncing ? "Requesting…" : "Sync now"}
            </button>
          </div>

          <form
            className="mt-4 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (symbol.trim()) void handleTrack(symbol);
            }}
          >
            <input
              value={symbol}
              onChange={(event) => {
                setSymbol(event.target.value.toUpperCase());
                setError(null);
              }}
              placeholder="US ticker, e.g. NVDA"
              maxLength={16}
              className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2 text-sm uppercase outline-none focus:border-gray-500"
            />
            <button
              type="submit"
              disabled={adding || !symbol.trim()}
              className="cursor-pointer rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {adding ? "Adding…" : "Add stock"}
            </button>
          </form>

          {message ? (
            <p className="mt-3 text-sm text-emerald-700">{message}</p>
          ) : null}
          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
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
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
              }}
              placeholder="Filter stocks…"
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
                      <button
                        type="button"
                        onClick={() => {
                          setBusyStockId(stock.id);
                          void handleTrack(stock.symbol);
                        }}
                        disabled={busyStockId === stock.id || adding}
                        className="cursor-pointer rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-white disabled:opacity-50"
                      >
                        {busyStockId === stock.id
                          ? "Reactivating…"
                          : "Reactivate"}
                      </button>
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
