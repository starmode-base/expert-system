import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useConnectionStateListener } from "ably/react";
import { useMemo, useState, useEffect } from "react";
import { PubSubProvider, useNotifyUI } from "~/lib/ably";
import { updateStockDataSF } from "~/server/data-loads";
import { sendEventEarningsCallscraperSF } from "~/server/inggest";
import { listOrganizationsSF } from "~/server/organizations";
import { queryStocksSF } from "~/server/query-stocks";
import {
  listTrackedCompaniesSF,
  toggleTrackedCompanySF,
} from "~/server/tracked-companies";

interface TrackedCompany {
  id: string;
  stockSymbolId: string;
  symbol: string;
  name: string;
  nextEarningsDate: Date | null;
}

export const Route = createFileRoute("/importer")({
  loader: async () => {
    const { viewerId } = await listOrganizationsSF();
    const stockTickers = await queryStocksSF();
    const trackedCompanies =
      (await listTrackedCompaniesSF()) as TrackedCompany[];

    return { viewerId, stockTickers, trackedCompanies };
  },
  component: RouteComponentProvider,
});

/**
 * Route component
 */
function RouteComponentProvider() {
  const { viewerId } = Route.useLoaderData();

  return (
    <PubSubProvider viewerId={viewerId}>
      <RouteComponent />
    </PubSubProvider>
  );
}

function RouteComponent() {
  const {
    viewerId,
    stockTickers,
    trackedCompanies: initialTrackedCompanies,
  } = Route.useLoaderData();

  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear(),
  );
  const [selectedQuarter, setSelectedQuarter] = useState<number>(1);
  const [selectedTickers, setSelectedTickers] = useState<
    {
      name: string;
      symbol: string;
    }[]
  >([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"tickers" | "tracked" | "update">(
    "tickers",
  );
  const [trackedCompanies, setTrackedCompanies] = useState<TrackedCompany[]>(
    initialTrackedCompanies,
  );
  const [trackingInProgress, setTrackingInProgress] = useState<Set<string>>(
    new Set(),
  );

  // Create a set of tracked stock symbol IDs for quick lookup
  const trackedStockSymbolIds = useMemo(
    () => new Set(trackedCompanies.map((tc) => tc.stockSymbolId)),
    [trackedCompanies],
  );

  const sortedTrackedCompanies = useMemo(() => {
    return trackedCompanies.slice().sort((a, b) => {
      const aTime = a.nextEarningsDate
        ? new Date(a.nextEarningsDate).getTime()
        : null;
      const bTime = b.nextEarningsDate
        ? new Date(b.nextEarningsDate).getTime()
        : null;

      if (aTime === null && bTime === null) {
        return a.symbol.localeCompare(b.symbol, undefined, {
          sensitivity: "base",
        });
      }
      if (aTime === null) return 1;
      if (bTime === null) return -1;

      if (aTime !== bTime) return aTime - bTime;
      return a.symbol.localeCompare(b.symbol, undefined, {
        sensitivity: "base",
      });
    });
  }, [trackedCompanies]);

  // Automatically clear the message after 5 seconds
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      setMessage("");
    }, 5000);
    return () => {
      clearTimeout(timer);
    };
  }, [message]);

  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const filteredTickers = useMemo(
    () =>
      stockTickers
        .filter(
          (t) =>
            t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.symbol.toLowerCase().includes(searchTerm.toLowerCase()),
        )
        .slice()
        .sort((a, b) => {
          const byName = a.name.localeCompare(b.name, undefined, {
            sensitivity: "base",
          });
          if (byName !== 0) return byName;
          return a.symbol.localeCompare(b.symbol, undefined, {
            sensitivity: "base",
          });
        }),
    [searchTerm, stockTickers],
  );

  useConnectionStateListener("connected", ({ current }) => {
    console.log("Ably connection state:", current);
  });

  useNotifyUI(viewerId, (msg) => {
    console.log("message", msg);
    if (msg.data === "Complete") {
      setMessage("Scrape Complete");
      setLoading(false);
    } else if (
      typeof msg.data === "string" &&
      msg.data.toLowerCase().includes("error")
    ) {
      setMessage("An error occurred during scraping");
      setLoading(false);
    } else {
      setMessage(msg.data as string);
    }
  });

  const updateStockData = useServerFn(updateStockDataSF);
  const sendEventEarningsCallscraper = useServerFn(
    sendEventEarningsCallscraperSF,
  );
  const toggleTrackedCompany = useServerFn(toggleTrackedCompanySF);

  const toggleTicker = (symbol: string) => {
    setSelectedTickers((prev) => {
      const isSelected = prev.some((t) => t.symbol === symbol);
      if (isSelected) {
        return prev.filter((t) => t.symbol !== symbol);
      } else {
        const ticker = stockTickers.find((t) => t.symbol === symbol);
        return ticker
          ? [...prev, { name: ticker.name, symbol: ticker.symbol }]
          : prev;
      }
    });
  };

  const handleToggleTracking = async (stockSymbolId: string) => {
    setTrackingInProgress((prev) => new Set(prev).add(stockSymbolId));
    try {
      const result = await toggleTrackedCompany({ data: { stockSymbolId } });
      if (result.isTracked) {
        // Add to tracked companies
        const stock = stockTickers.find((s) => s.id === stockSymbolId);
        if (stock) {
          // Safe assertion: when isTracked is true, id is always a string
          setTrackedCompanies((prev) => [
            ...prev,
            {
              id: result.id,
              stockSymbolId,
              symbol: stock.symbol,
              name: stock.name,
              nextEarningsDate: null,
            },
          ]);
        }
      } else {
        // Remove from tracked companies
        setTrackedCompanies((prev) =>
          prev.filter((tc) => tc.stockSymbolId !== stockSymbolId),
        );
      }
    } finally {
      setTrackingInProgress((prev) => {
        const next = new Set(prev);
        next.delete(stockSymbolId);
        return next;
      });
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="h-[calc(100dvh-96px)] overflow-hidden">
      <div className="mx-auto flex h-full max-w-4xl flex-col gap-4 px-2 py-4 sm:px-4">
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white p-1 text-sm">
            <button
              type="button"
              onClick={() => {
                setActiveTab("tickers");
              }}
              className={`flex-1 cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none ${
                activeTab === "tickers"
                  ? "bg-slate-900 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              Select Tickers
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("tracked");
              }}
              className={`flex-1 cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none ${
                activeTab === "tracked"
                  ? "bg-slate-900 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              Tracked Companies
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("update");
              }}
              className={`flex-1 cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none ${
                activeTab === "update"
                  ? "bg-slate-900 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              Update Data
            </button>
          </div>

          <section className="flex min-h-0 flex-1 flex-col border border-gray-200 bg-white">
            {activeTab === "tickers" ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="shrink-0 border-b border-gray-200 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-base font-semibold text-gray-900">
                        Select Tickers
                      </h2>
                      <p className="mt-1 text-sm text-gray-500">
                        Choose symbols to scrape by year and quarter.
                      </p>
                    </div>
                    <div className="text-xs text-gray-500">
                      {selectedTickers.length} selected
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="Search tickers..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                    }}
                    className="mt-3 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:ring-2 focus:ring-slate-200 focus:outline-none"
                  />
                </div>

                <div className="min-h-0 flex-1 divide-y divide-gray-100 overflow-y-auto">
                  {filteredTickers.map((ticker) => {
                    const isSelected = selectedTickers.some(
                      (t) => t.symbol === ticker.symbol,
                    );
                    const isTracked = trackedStockSymbolIds.has(ticker.id);
                    const isToggling = trackingInProgress.has(ticker.id);

                    return (
                      <div
                        key={ticker.id}
                        className="flex items-start justify-between gap-3 px-4 py-3"
                      >
                        <label className="flex flex-1 cursor-pointer items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              toggleTicker(ticker.symbol);
                            }}
                            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-slate-900"
                          />
                          <span className="text-sm text-gray-700">
                            {ticker.name}{" "}
                            <span className="text-gray-400">
                              ({ticker.symbol})
                            </span>
                          </span>
                        </label>
                        <button
                          onClick={() => handleToggleTracking(ticker.id)}
                          disabled={isToggling}
                          className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                            isTracked
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-gray-200 text-gray-600 hover:bg-gray-100"
                          }`}
                          title={isTracked ? "Stop tracking" : "Start tracking"}
                        >
                          {isToggling
                            ? "..."
                            : isTracked
                              ? "Tracking"
                              : "Track"}
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="shrink-0 border-t border-gray-200 p-4">
                  <div className="flex flex-col gap-3">
                    {message ? (
                      <div
                        className={`rounded px-4 py-2 text-sm ${
                          message === "Scrape Complete"
                            ? "bg-green-100 text-green-800"
                            : message.includes("Error")
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-200 text-black"
                        }`}
                      >
                        {message}
                      </div>
                    ) : null}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div className="flex flex-wrap gap-3">
                        <div className="flex flex-col">
                          <label
                            htmlFor="year"
                            className="mb-1 text-xs font-medium text-gray-600"
                          >
                            Year
                          </label>
                          <select
                            id="year"
                            value={selectedYear}
                            onChange={(e) => {
                              setSelectedYear(Number(e.target.value));
                            }}
                            className="rounded border border-gray-300 px-2 py-1 text-sm"
                          >
                            {availableYears.map((year) => (
                              <option key={year} value={year}>
                                {year}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col">
                          <label
                            htmlFor="quarter"
                            className="mb-1 text-xs font-medium text-gray-600"
                          >
                            Quarter
                          </label>
                          <select
                            id="quarter"
                            value={selectedQuarter}
                            onChange={(e) => {
                              setSelectedQuarter(Number(e.target.value));
                            }}
                            className="rounded border border-gray-300 px-2 py-1 text-sm"
                          >
                            {[1, 2, 3, 4].map((q) => (
                              <option key={q} value={q}>
                                Q{q}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          setLoading(true);
                          await sendEventEarningsCallscraper({
                            data: {
                              symbols: selectedTickers,
                              year: selectedYear,
                              quarter: selectedQuarter,
                            },
                          });
                          setSelectedTickers([]);
                        }}
                        disabled={selectedTickers.length === 0 || loading}
                        className="w-full cursor-pointer rounded-md border border-zinc-900 bg-zinc-900 px-4 py-2 text-white disabled:opacity-50 sm:w-auto"
                      >
                        {loading ? "Scraping…" : "Scrape Earnings Calls"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : activeTab === "tracked" ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="shrink-0 border-b border-gray-200 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-base font-semibold text-gray-900">
                        Tracked Companies
                      </h2>
                      <p className="mt-1 text-sm text-gray-500">
                        Transcripts for tracked companies are automatically
                        fetched the day after their earnings report.
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-gray-200 px-2 py-1 text-xs text-gray-500">
                      {trackedCompanies.length} tracked
                    </span>
                  </div>
                </div>
                <div className="min-h-0 flex-1 divide-y divide-gray-100 overflow-y-auto">
                  {trackedCompanies.length === 0 ? (
                    <div className="flex items-center justify-center p-6 text-sm text-gray-400">
                      No companies tracked yet
                    </div>
                  ) : (
                    sortedTrackedCompanies.map((company) => (
                      <div
                        key={company.id}
                        className="flex items-center justify-between gap-3 px-4 py-3"
                      >
                        <div>
                          <div className="font-medium text-gray-900">
                            {company.symbol}
                          </div>
                          <div className="text-sm text-gray-500">
                            {company.name}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-xs text-gray-400">
                              Next Earnings
                            </div>
                            <div className="text-sm font-medium text-gray-700">
                              {formatDate(company.nextEarningsDate)}
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              handleToggleTracking(company.stockSymbolId)
                            }
                            disabled={trackingInProgress.has(
                              company.stockSymbolId,
                            )}
                            className="cursor-pointer rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center sm:p-10">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">
                      Update Stock Data
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      Refresh the internal stock universe used for searches and
                      tracking.
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      await updateStockData();
                    }}
                    className="w-full cursor-pointer rounded-md border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm text-white sm:w-auto"
                  >
                    Update Stock Data
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

//
// Upload categories and stock tickers data
//
{
  /* One time uploads. Remove or hide buttons once data is uploaded */
}
{
  /* WARNING: This will polute categories data! */
}
{
  // const uploadCategories = useServerFn(uploadCategoriesSF);
  // const uploadStockData = useServerFn(uploadStockDataSF);
  /* <button
    onClick={async () => {
      await uploadCategories();
    }}
    className="cursor-pointer rounded-md border border-zinc-900 bg-zinc-900 px-3 py-1 text-white"
  >
    Upload Categories
  </button>

  <button
    onClick={async () => {
      await uploadStockData();
    }}
    className="cursor-pointer rounded-md border border-zinc-900 bg-zinc-900 px-3 py-1 text-white"
  >
    Upload Stocks
  </button> */
}

//
// Science Daily scraper
//
// const sendEventScienceDailyScraper = useServerFn(
//   sendEventScienceDailyScraperSF,
// );

{
  /* <button
              onClick={async () => {
                await sendEventScienceDailyScraper();
                setLoading(true);
              }}
              className="cursor-pointer rounded-md border border-zinc-900 bg-zinc-900 px-3 py-1 text-white"
            >
              Scrape News
            </button> */
}
