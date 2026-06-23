import { createFileRoute } from "@tanstack/react-router";
import { getStockProfileSF } from "~/server/stock-profile";
import type {
  CompanyOverview,
  GlobalQuote,
} from "~/server/financial-data-api/alpha-vantage-api";

export const Route = createFileRoute("/stocks/$symbol")({
  loader: async ({ params: { symbol } }) => {
    return await getStockProfileSF({ data: { symbol } });
  },
  component: StockProfilePage,
});

function formatLargeNumber(value: string | null | undefined): string {
  if (!value || value === "None" || value === "0") return "-";
  const num = Number(value);
  if (isNaN(num)) return value;
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  return `$${num.toLocaleString()}`;
}

function formatPercent(value: string | null | undefined): string {
  if (!value || value === "None") return "-";
  const num = Number(value);
  if (isNaN(num)) return value;
  return `${(num * 100).toFixed(2)}%`;
}

function formatRatio(value: string | null | undefined): string {
  if (!value || value === "None") return "-";
  const num = Number(value);
  if (isNaN(num)) return value;
  return num.toFixed(2);
}

function formatDollar(value: string | null | undefined): string {
  if (!value || value === "None") return "-";
  const num = Number(value);
  if (isNaN(num)) return value;
  return `$${num.toFixed(2)}`;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded border border-gray-100 bg-gray-50 px-3 py-2">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

function AnalystBar({ overview }: { overview: CompanyOverview }) {
  const values = [
    {
      label: "Strong Buy",
      count: Number(overview.AnalystRatingStrongBuy ?? 0),
      color: "bg-emerald-600",
    },
    {
      label: "Buy",
      count: Number(overview.AnalystRatingBuy ?? 0),
      color: "bg-emerald-400",
    },
    {
      label: "Hold",
      count: Number(overview.AnalystRatingHold ?? 0),
      color: "bg-yellow-400",
    },
    {
      label: "Sell",
      count: Number(overview.AnalystRatingSell ?? 0),
      color: "bg-red-400",
    },
    {
      label: "Strong Sell",
      count: Number(overview.AnalystRatingStrongSell ?? 0),
      color: "bg-red-600",
    },
  ];

  const total = values.reduce((sum, v) => sum + v.count, 0);
  if (total === 0)
    return (
      <p className="text-sm text-gray-500">No analyst ratings available.</p>
    );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-4 overflow-hidden rounded-full">
        {values.map((v) =>
          v.count > 0 ? (
            <div
              key={v.label}
              className={v.color}
              style={{ width: `${(v.count / total) * 100}%` }}
              title={`${v.label}: ${String(v.count)}`}
            />
          ) : null,
        )}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-gray-600">
        {values.map((v) => (
          <span key={v.label} className="flex items-center gap-1">
            <span className={`inline-block h-2 w-2 rounded-full ${v.color}`} />
            {v.label}: {v.count}
          </span>
        ))}
      </div>
    </div>
  );
}

function QuoteHeader({ quote }: { quote: GlobalQuote }) {
  const price = Number(quote["05. price"]);
  const change = Number(quote["09. change"]);
  const changePercent = quote["10. change percent"].replace("%", "");
  const changeNum = Number(changePercent);
  const isPositive = change >= 0;

  return (
    <div className="flex items-baseline gap-3">
      <span className="text-2xl font-bold text-gray-900">
        ${price.toFixed(2)}
      </span>
      <span
        className={`text-sm font-medium ${isPositive ? "text-emerald-600" : "text-red-600"}`}
      >
        {isPositive ? "+" : ""}
        {change.toFixed(2)} ({isPositive ? "+" : ""}
        {changeNum.toFixed(2)}%)
      </span>
      <span className="text-xs text-gray-400">
        {quote["07. latest trading day"]}
      </span>
    </div>
  );
}

function StockProfilePage() {
  const data = Route.useLoaderData();
  const { dbStock, overview, quote } = data;

  const symbol = overview?.Symbol ?? dbStock?.symbol ?? "";
  const name = overview?.Name ?? dbStock?.name ?? symbol;
  const exchange = overview?.Exchange ?? dbStock?.exchange ?? "";
  const sector = overview?.Sector ?? dbStock?.sector ?? "";
  const industry = overview?.Industry ?? dbStock?.industry ?? "";
  const description = overview?.Description ?? dbStock?.description ?? "";
  const address = overview?.Address ?? dbStock?.address ?? "";
  const officialSite = overview?.OfficialSite ?? dbStock?.officialSite ?? "";
  const fiscalYearEnd = overview?.FiscalYearEnd ?? dbStock?.fiscalYearEnd ?? "";
  const cik = overview?.CIK ?? dbStock?.cik ?? "";

  return (
    <div className="h-[calc(100dvh-64px-49px)] overflow-y-auto">
      <div className="mx-auto max-w-4xl px-2 py-6 sm:px-4">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <section className="border border-gray-200 bg-white p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-xl font-bold text-gray-900">{symbol}</h1>
                  <span className="text-base text-gray-500">{name}</span>
                </div>
                {exchange || sector || industry ? (
                  <div className="flex flex-wrap gap-1.5">
                    {exchange ? (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {exchange}
                      </span>
                    ) : null}
                    {sector ? (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                        {sector}
                      </span>
                    ) : null}
                    {industry ? (
                      <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-700">
                        {industry}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {quote ? <QuoteHeader quote={quote} /> : null}
              </div>
            </div>
          </section>

          {/* Company Overview */}
          {description ? (
            <section className="border border-gray-200 bg-white p-4 sm:p-6">
              <h2 className="mb-3 text-base font-semibold text-gray-900">
                Company Overview
              </h2>
              <p className="mb-4 text-sm leading-relaxed text-gray-700">
                {description}
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
                {address ? (
                  <span>
                    <span className="text-gray-400">Address: </span>
                    {address}
                  </span>
                ) : null}
                {officialSite ? (
                  <span>
                    <span className="text-gray-400">Website: </span>
                    <a
                      href={officialSite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {officialSite}
                    </a>
                  </span>
                ) : null}
                {fiscalYearEnd ? (
                  <span>
                    <span className="text-gray-400">Fiscal Year End: </span>
                    {fiscalYearEnd}
                  </span>
                ) : null}
                {cik ? (
                  <span>
                    <span className="text-gray-400">CIK: </span>
                    {cik}
                  </span>
                ) : null}
              </div>
            </section>
          ) : null}

          {/* Key Metrics */}
          {overview ? (
            <section className="border border-gray-200 bg-white p-4 sm:p-6">
              <h2 className="mb-3 text-base font-semibold text-gray-900">
                Key Metrics
              </h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <MetricCard
                  label="Market Cap"
                  value={formatLargeNumber(overview.MarketCapitalization)}
                />
                <MetricCard
                  label="P/E Ratio (Trailing)"
                  value={formatRatio(overview.TrailingPE)}
                />
                <MetricCard
                  label="P/E Ratio (Forward)"
                  value={formatRatio(overview.ForwardPE)}
                />
                <MetricCard
                  label="EPS (Diluted TTM)"
                  value={formatDollar(overview.DilutedEPSTTM)}
                />
                <MetricCard
                  label="Revenue TTM"
                  value={formatLargeNumber(overview.RevenueTTM)}
                />
                <MetricCard
                  label="Profit Margin"
                  value={formatPercent(overview.ProfitMargin)}
                />
                <MetricCard
                  label="EBITDA"
                  value={formatLargeNumber(overview.EBITDA)}
                />
                <MetricCard label="Beta" value={formatRatio(overview.Beta)} />
                <MetricCard
                  label="52-Week High"
                  value={formatDollar(overview["52WeekHigh"])}
                />
                <MetricCard
                  label="52-Week Low"
                  value={formatDollar(overview["52WeekLow"])}
                />
                <MetricCard
                  label="50-Day MA"
                  value={formatDollar(overview["50DayMovingAverage"])}
                />
                <MetricCard
                  label="200-Day MA"
                  value={formatDollar(overview["200DayMovingAverage"])}
                />
                <MetricCard
                  label="Dividend Yield"
                  value={formatPercent(overview.DividendYield)}
                />
                <MetricCard
                  label="Dividend Per Share"
                  value={formatDollar(overview.DividendPerShare)}
                />
                <MetricCard
                  label="Book Value"
                  value={formatDollar(overview.BookValue)}
                />
                <MetricCard
                  label="Price-to-Book"
                  value={formatRatio(overview.PriceToBookRatio)}
                />
                <MetricCard
                  label="Price-to-Sales"
                  value={formatRatio(overview.PriceToSalesRatioTTM)}
                />
                <MetricCard
                  label="EV/EBITDA"
                  value={formatRatio(overview.EVToEBITDA)}
                />
              </div>
            </section>
          ) : null}

          {/* Analyst Ratings */}
          {overview ? (
            <section className="border border-gray-200 bg-white p-4 sm:p-6">
              <h2 className="mb-1 text-base font-semibold text-gray-900">
                Analyst Ratings
              </h2>
              {overview.AnalystTargetPrice &&
              overview.AnalystTargetPrice !== "None" ? (
                <p className="mb-3 text-sm text-gray-600">
                  Target Price:{" "}
                  <span className="font-medium text-gray-900">
                    ${Number(overview.AnalystTargetPrice).toFixed(2)}
                  </span>
                </p>
              ) : null}
              <AnalystBar overview={overview} />
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
