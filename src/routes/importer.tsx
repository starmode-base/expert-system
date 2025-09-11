import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useConnectionStateListener } from "ably/react";
import { useMemo, useState, useEffect } from "react";
import { PubSubProvider, useNotifyUI } from "~/lib/ably";
import { uploadStockDataSF } from "~/server/data-loads";
import { sendEventEarningsCallscraperSF } from "~/server/inggest";
import { listOrganizationsSF } from "~/server/organizations";
import { queryStocksSF } from "~/server/query-stocks";

export const Route = createFileRoute("/importer")({
  loader: async () => {
    const { viewerId } = await listOrganizationsSF();

    const stockTickers = await queryStocksSF();

    return { viewerId, stockTickers };
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
  const { viewerId, stockTickers } = Route.useLoaderData();

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

  useNotifyUI(viewerId, (message) => {
    console.log("message", message);
    if (message.data === "Complete") {
      setMessage("Scrape Complete");
      setLoading(false);
    } else if (
      typeof message.data === "string" &&
      message.data.toLowerCase().includes("error")
    ) {
      setMessage("An error occurred during scraping");
      setLoading(false);
    } else {
      setMessage(message.data as string);
    }
  });
  const uploadStockData = useServerFn(uploadStockDataSF);

  const sendEventEarningsCallscraper = useServerFn(
    sendEventEarningsCallscraperSF,
  );

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

  return (
    <div className="flex h-[calc(100vh-64px)] justify-center bg-gray-100 p-6">
      <button
        onClick={async () => {
          await uploadStockData();
        }}
        className="cursor-pointer rounded-md border border-zinc-900 bg-zinc-900 px-3 py-1 text-white"
      >
        Upload Stocks
      </button>{" "}
      {/* Sidebar: Search + Ticker List */}
      <aside className="flex w-1/2 flex-col rounded-lg bg-white p-4 shadow">
        <div className="mb-4 flex gap-4">
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
            return (
              <label
                key={ticker.id}
                className="flex cursor-pointer items-center space-x-2 rounded p-2 hover:bg-gray-50"
              >
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
            );
          })}
        </div>
        {/* ADD MESSAGE POP UP HERE */}
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
          className="cursor-pointer rounded-md border border-zinc-900 bg-zinc-900 px-4 py-2 text-white"
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
