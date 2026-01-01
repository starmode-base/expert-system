import { createFileRoute, Link } from "@tanstack/react-router";
import { InsightCard } from "~/components/insight-feed/insight-card";
import { queryPublicInsightById, type InsightsItem } from "~/server/queries";

const SITE_ORIGIN = "https://expert-system.starmode.dev";
const DEFAULT_IMAGE_URL = `${SITE_ORIGIN}/logo.png`;
const TWITTER_SITE_HANDLE = "@starmode";

function buildTitle(insightItem: InsightsItem | null) {
  return insightItem?.insight.title ?? "Expert System insight";
}

function buildDescription(insightItem: InsightsItem | null) {
  const sourceText =
    insightItem?.insight.summary ??
    insightItem?.insight.insight ??
    "ΞXPERT-SYSTΞM insight";

  const normalized = sourceText.replace(/\s+/g, " ").trim();
  const maxLength = 240;

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

export const Route = createFileRoute("/insight/$insightId")({
  loader: async ({ params: { insightId } }) => {
    return await queryPublicInsightById({ data: insightId });
  },
  head: ({ loaderData, params }) => {
    const title = buildTitle(loaderData);
    const description = buildDescription(loaderData);
    const pageUrl = `${SITE_ORIGIN}/insight/${params.insightId}`;
    const imageUrl = DEFAULT_IMAGE_URL;

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "og:title", content: title },
        { name: "og:description", content: description },
        { name: "og:image", content: imageUrl },
        { name: "og:url", content: pageUrl },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: imageUrl },
        { name: "twitter:site", content: TWITTER_SITE_HANDLE },
      ],
      links: [{ rel: "canonical", href: pageUrl }],
    };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const item = Route.useLoaderData();

  console.log("######## LOADER DATA ########");

  return (
    <div className="min-h-dvh bg-slate-100 px-2 sm:px-8">
      <div className="mx-auto w-full max-w-4xl py-4">
        <Link
          to="/guest/feed"
          className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm font-medium text-slate-700 hover:bg-slate-200/60 hover:text-slate-900"
        >
          <span aria-hidden>←</span>
          Feed
        </Link>

        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {item ? (
            <InsightCard
              insightFeedItem={item}
              loading={false}
              expanded={true}
            />
          ) : (
            <div className="p-4">
              <p className="text-sm text-slate-700">Insight not found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
