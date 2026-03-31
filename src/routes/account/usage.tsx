import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { SignInButton } from "@clerk/tanstack-start";

// ---------------------------------------------------------------------------
// Endpoint display config
// ---------------------------------------------------------------------------

const ENDPOINT_META: Record<string, { label: string; color: string }> = {
  "takeaways.recent": { label: "Recent", color: "#6366f1" }, // indigo
  "takeaways.search": { label: "Search", color: "#8b5cf6" }, // violet
  takeaways: { label: "By ID", color: "#a78bfa" }, // violet-light
  documents: { label: "Docs", color: "#3b82f6" }, // blue
  research: { label: "Research", color: "#06b6d4" }, // cyan
  "query.macro": { label: "Macro", color: "#10b981" }, // emerald
  "query.financial": { label: "Financial", color: "#f59e0b" }, // amber
};

const FREE_TIER_LIMIT = 100;

// ---------------------------------------------------------------------------
// Server function
// ---------------------------------------------------------------------------

interface UsageRow {
  month: string;
  endpoint: string;
  requestCount: number;
}

const loadUsage = createServerFn({ method: "GET" }).handler(async () => {
  const { getWebRequest } = await import("vinxi/http");
  const { getClerkUserId } = await import("~/server/auth");
  const { db } = await import("~/postgres/db");
  const { users, apiUsage } = await import("~/postgres/schema");
  const { eq, and, gte } = await import("drizzle-orm");

  const clerkUserId = await getClerkUserId(getWebRequest());
  if (!clerkUserId) {
    return { authenticated: false as const, rows: [], planTier: "free" };
  }

  const user = await db.query.users.findFirst({
    where: eq(users.clerkUserId, clerkUserId),
    columns: { id: true, planTier: true },
  });

  if (!user) {
    return { authenticated: false as const, rows: [], planTier: "free" };
  }

  // Fetch last 6 months of usage
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  const sinceMonth = sixMonthsAgo.toISOString().slice(0, 7);

  const rows = await db
    .select({
      month: apiUsage.month,
      endpoint: apiUsage.endpoint,
      requestCount: apiUsage.requestCount,
    })
    .from(apiUsage)
    .where(and(eq(apiUsage.userId, user.id), gte(apiUsage.month, sinceMonth)));

  return {
    authenticated: true as const,
    rows: rows as UsageRow[],
    planTier: user.planTier,
  };
});

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/account/usage")({
  loader: () => loadUsage(),
  component: UsagePage,
});

// ---------------------------------------------------------------------------
// Chart helpers
// ---------------------------------------------------------------------------

interface MonthData {
  month: string;
  segments: { endpoint: string; count: number }[];
  total: number;
}

function buildMonthData(rows: UsageRow[]): MonthData[] {
  // Generate last 6 months
  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toISOString().slice(0, 7));
  }

  // Group rows by month
  const byMonth = new Map<string, Map<string, number>>();
  for (const row of rows) {
    if (!byMonth.has(row.month)) byMonth.set(row.month, new Map());
    const monthMap = byMonth.get(row.month);
    if (monthMap) monthMap.set(row.endpoint, row.requestCount);
  }

  // Stable endpoint order
  const endpointOrder = Object.keys(ENDPOINT_META);

  return months.map((month) => {
    const endpointMap = byMonth.get(month);
    const segments: { endpoint: string; count: number }[] = [];
    let total = 0;
    for (const ep of endpointOrder) {
      const count = endpointMap?.get(ep) ?? 0;
      if (count > 0) {
        segments.push({ endpoint: ep, count });
        total += count;
      }
    }
    return { month, segments, total };
  });
}

function formatMonth(month: string): string {
  const parts = month.split("-");
  const year = parts[0] ?? "00";
  const m = parts[1] ?? "01";
  const names = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const monthName = names[parseInt(m, 10) - 1] ?? "Jan";
  return `${monthName} '${year.slice(2)}`;
}

// ---------------------------------------------------------------------------
// Stacked bar chart (SVG)
// ---------------------------------------------------------------------------

function StackedBarChart({
  data,
  showLimit,
}: {
  data: MonthData[];
  showLimit: boolean;
}) {
  const chartWidth = 600;
  const chartHeight = 240;
  const paddingLeft = 40;
  const paddingBottom = 28;
  const paddingTop = 16;
  const paddingRight = 12;

  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = chartHeight - paddingBottom - paddingTop;

  const maxValue = Math.max(
    ...data.map((d) => d.total),
    showLimit ? FREE_TIER_LIMIT : 0,
    10,
  );
  // Round up to a nice number
  const yMax = Math.ceil((maxValue * 1.15) / 10) * 10;

  const barCount = data.length;
  const gap = 12;
  const barWidth = Math.min(60, (plotWidth - gap * (barCount - 1)) / barCount);
  const totalBarsWidth = barWidth * barCount + gap * (barCount - 1);
  const offsetX = paddingLeft + (plotWidth - totalBarsWidth) / 2;

  const yScale = (v: number) =>
    paddingTop + plotHeight - (v / yMax) * plotHeight;

  // Y-axis ticks
  const tickCount = 4;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) =>
    Math.round((yMax / tickCount) * i),
  );

  return (
    <svg
      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      className="w-full"
      role="img"
      aria-label="Monthly API usage stacked bar chart"
    >
      {/* Y-axis grid lines + labels */}
      {ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={paddingLeft}
            x2={chartWidth - paddingRight}
            y1={yScale(tick)}
            y2={yScale(tick)}
            stroke="#e5e7eb"
            strokeWidth={1}
          />
          <text
            x={paddingLeft - 6}
            y={yScale(tick)}
            textAnchor="end"
            dominantBaseline="middle"
            className="fill-gray-400 text-[10px]"
          >
            {tick}
          </text>
        </g>
      ))}

      {/* Limit line (free tier only) */}
      {showLimit ? (
        <>
          <line
            x1={paddingLeft}
            x2={chartWidth - paddingRight}
            y1={yScale(FREE_TIER_LIMIT)}
            y2={yScale(FREE_TIER_LIMIT)}
            stroke="#ef4444"
            strokeWidth={1.5}
            strokeDasharray="6 4"
            opacity={0.6}
          />
          <text
            x={chartWidth - paddingRight}
            y={yScale(FREE_TIER_LIMIT) - 6}
            textAnchor="end"
            className="fill-red-400 text-[10px]"
          >
            {FREE_TIER_LIMIT} limit
          </text>
        </>
      ) : null}

      {/* Bars */}
      {data.map((d, i) => {
        const x = offsetX + i * (barWidth + gap);
        let yOffset = 0;

        return (
          <g key={d.month}>
            {d.segments.map((seg) => {
              const segHeight = (seg.count / yMax) * plotHeight;
              const y = yScale(yOffset + seg.count);
              yOffset += seg.count;
              const meta = ENDPOINT_META[seg.endpoint];

              return (
                <rect
                  key={seg.endpoint}
                  x={x}
                  y={y}
                  width={barWidth}
                  height={segHeight}
                  rx={segHeight > 4 ? 2 : 0}
                  fill={meta?.color ?? "#94a3b8"}
                >
                  <title>
                    {meta?.label ?? seg.endpoint}: {seg.count}
                  </title>
                </rect>
              );
            })}
            {/* Month label */}
            <text
              x={x + barWidth / 2}
              y={chartHeight - 8}
              textAnchor="middle"
              className="fill-gray-500 text-[10px]"
            >
              {formatMonth(d.month)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function UsagePage() {
  const { authenticated, rows, planTier } = Route.useLoaderData();

  if (!authenticated) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-8 text-2xl font-semibold text-gray-900">API Usage</h1>
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <p className="mb-4 text-sm text-gray-600">
            Sign in to view your API usage.
          </p>
          <SignInButton mode="modal">
            <button className="cursor-pointer rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900">
              Sign in
            </button>
          </SignInButton>
        </div>
      </div>
    );
  }

  const data = buildMonthData(rows);
  const currentMonth = data[data.length - 1];
  const isFree = planTier === "free";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">API Usage</h1>
        {isFree && currentMonth ? (
          <span className="text-xs text-gray-400">
            <span className="font-mono font-medium text-gray-600">
              {currentMonth.total}
            </span>{" "}
            / {FREE_TIER_LIMIT} requests this month
          </span>
        ) : null}
      </div>

      {/* Chart */}
      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
        <StackedBarChart data={data} showLimit={isFree} />

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
          {Object.entries(ENDPOINT_META).map(([key, meta]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: meta.color }}
              />
              <span className="text-xs text-gray-500">{meta.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Current month breakdown */}
      {currentMonth && currentMonth.total > 0 ? (
        <section className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-3">
            <h2 className="text-sm font-medium text-gray-700">
              {formatMonth(currentMonth.month)} breakdown
            </h2>
          </div>
          <table className="w-full">
            <tbody>
              {currentMonth.segments.map((seg) => {
                const meta = ENDPOINT_META[seg.endpoint];
                return (
                  <tr
                    key={seg.endpoint}
                    className="border-b border-gray-50 last:border-0"
                  >
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-sm"
                          style={{ backgroundColor: meta?.color ?? "#94a3b8" }}
                        />
                        <span className="text-sm text-gray-700">
                          {meta?.label ?? seg.endpoint}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono text-sm text-gray-600">
                      {seg.count}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
