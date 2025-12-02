import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useConnectionStateListener } from "ably/react";
import { useMemo, useState, useEffect } from "react";
import { PubSubProvider, useNotifyUI } from "~/lib/ably";
import { uploadStockDataSF } from "~/server/data-loads";
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
      stockTickers.filter(
        (t) =>
          t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.symbol.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
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

  const uploadStockData = useServerFn(uploadStockDataSF);
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
          setTrackedCompanies((prev) => [
            ...prev,
            {
              id: stockSymbolId,
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
    <div className="flex h-[calc(100vh-64px)] gap-6 bg-gray-100 p-6">
      {/* Left Panel: Tracked Companies */}
      <aside className="flex w-1/3 flex-col rounded-lg bg-white p-4 shadow">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Tracked Companies</h2>
          <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800">
            {trackedCompanies.length} tracked
          </span>
        </div>
        <p className="mb-4 text-sm text-gray-500">
          Transcripts for tracked companies are automatically fetched the day
          after their earnings report.
        </p>
        <div className="flex-1 overflow-y-auto">
          {trackedCompanies.length === 0 ? (
            <div className="flex h-full items-center justify-center text-gray-400">
              No companies tracked yet
            </div>
          ) : (
            trackedCompanies.map((company) => (
              <div
                key={company.id}
                className="flex items-center justify-between border-b border-gray-100 py-3"
              >
                <div>
                  <div className="font-medium text-gray-900">
                    {company.symbol}
                  </div>
                  <div className="text-sm text-gray-500">{company.name}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs text-gray-400">Next Earnings</div>
                    <div className="text-sm font-medium text-gray-700">
                      {formatDate(company.nextEarningsDate)}
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleTracking(company.stockSymbolId)}
                    disabled={trackingInProgress.has(company.stockSymbolId)}
                    className="cursor-pointer rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Right Panel: Manual Import + Stock Selection */}
      <aside className="flex w-2/3 flex-col rounded-lg bg-white p-4 shadow">
        <div className="mb-4 flex gap-4">
          <div className="flex w-full items-end justify-between">
            <div className="flex gap-4">
              {/* Year picker */}
              <div className="flex flex-col">
                <label
                  htmlFor="year"
                  className="mb-1 text-sm font-medium text-gray-700"
                >
                  Year
                </label>
                <select
                  id="year"
                  value={selectedYear}
                  onChange={(e) => {
                    setSelectedYear(Number(e.target.value));
                  }}
                  className="rounded border border-gray-300 px-2 py-1"
                >
                  {availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              {/* Quarter picker */}
              <div className="flex flex-col">
                <label
                  htmlFor="quarter"
                  className="mb-1 text-sm font-medium text-gray-700"
                >
                  Quarter
                </label>
                <select
                  id="quarter"
                  value={selectedQuarter}
                  onChange={(e) => {
                    setSelectedQuarter(Number(e.target.value));
                  }}
                  className="rounded border border-gray-300 px-2 py-1"
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
                await uploadStockData();
              }}
              className="cursor-pointer rounded-md border border-zinc-900 bg-zinc-900 px-3 py-1 text-white"
            >
              Update Stocks
            </button>
          </div>
        </div>
        <h2 className="mb-4 text-lg font-semibold">Select Tickers</h2>

        <input
          type="text"
          placeholder="Search tickers..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
          }}
          className="mb-4 rounded border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />

        <div className="flex-1 overflow-y-auto">
          {filteredTickers.map((ticker) => {
            const isSelected = selectedTickers.some(
              (t) => t.symbol === ticker.symbol,
            );
            const isTracked = trackedStockSymbolIds.has(ticker.id);
            const isToggling = trackingInProgress.has(ticker.id);

            return (
              <div
                key={ticker.id}
                className="flex items-center justify-between rounded p-2 hover:bg-gray-50"
              >
                <label className="flex flex-1 cursor-pointer items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {
                      toggleTicker(ticker.symbol);
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                  />
                  <span className="text-gray-700">
                    {ticker.name} ({ticker.symbol})
                  </span>
                </label>
                <button
                  onClick={() => handleToggleTracking(ticker.id)}
                  disabled={isToggling}
                  className={`cursor-pointer rounded px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                    isTracked
                      ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                      : "text-gray-500 hover:bg-gray-100"
                  }`}
                  title={isTracked ? "Stop tracking" : "Start tracking"}
                >
                  {isToggling ? "..." : isTracked ? "Tracking" : "Track"}
                </button>
              </div>
            );
          })}
        </div>
        {message ? (
          <div
            className={`mb-4 rounded px-4 py-2 text-sm ${
              message === "Scrape Complete"
                ? "bg-green-100 text-green-800"
                : message.includes("Error")
                  ? "bg-red-100 text-red-800"
                  : "bg-gray-200 text-black"
            } shadow`}
          >
            {message}
          </div>
        ) : null}
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
          className="cursor-pointer rounded-md border border-zinc-900 bg-zinc-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "Scraping…" : "Scrape Earnings Calls"}
        </button>
      </aside>
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
