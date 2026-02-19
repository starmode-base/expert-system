import { createFileRoute, Link } from "@tanstack/react-router";
import { TakeawayTile } from "~/components/takeaway-tile";
import { queryPublicTakeawayById, type Takeaway } from "~/server/queries";

const SITE_ORIGIN = "https://expert-system.starmode.dev";
const DEFAULT_IMAGE_URL = `${SITE_ORIGIN}/logo-x.jpg`;

function buildTitle(takeaway: Takeaway | null) {
  return takeaway?.title ?? "Expert System takeaway";
}

function buildDescription(takeaway: Takeaway | null) {
  const sourceText =
    takeaway?.summary ?? takeaway?.takeaway ?? "ΞXPERT-SYSTΞM takeaway";

  const normalized = sourceText.replace(/\s+/g, " ").trim();
  const maxLength = 240;

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function buildHeadData(
  takeaway: Takeaway | null,
  takeawayId: string | number,
) {
  const title = buildTitle(takeaway);
  const description = buildDescription(takeaway);
  const pageUrl = `${SITE_ORIGIN}/takeaway/${takeawayId}`;
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
    ],
    links: [{ rel: "canonical", href: pageUrl }],
  };
}

export const Route = createFileRoute("/takeaway/$takeawayId")({
  loader: async ({ params: { takeawayId } }) => {
    return await queryPublicTakeawayById({ data: takeawayId });
  },
  head: ({ loaderData, params }) => {
    return buildHeadData(loaderData, params.takeawayId);
  },
  component: RouteComponent,
});

function RouteComponent() {
  const item = Route.useLoaderData();

  return (
    <div className="min-h-dvh bg-slate-100 px-2 sm:px-8">
      <div className="mx-auto w-full max-w-4xl py-4">
        <Link
          to="/takeaway-feed"
          search={{
            searchInput: undefined,
            filters: undefined,
          }}
          className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm font-medium text-slate-700 hover:bg-slate-200/60 hover:text-slate-900"
        >
          <span aria-hidden>←</span>
          Feed
        </Link>

        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {item ? (
            <TakeawayTile takeaway={item} />
          ) : (
            <div className="p-4">
              <p className="text-sm text-slate-700">Takeaway not found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
