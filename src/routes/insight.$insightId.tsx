import { createFileRoute, Link } from "@tanstack/react-router";
import { InsightCard } from "~/components/insight-feed/insight-card";
import { queryPublicInsightById } from "~/server/queries";

export const Route = createFileRoute("/insight/$insightId")({
  loader: async ({ params: { insightId } }) => {
    return await queryPublicInsightById({ data: insightId });
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
              insight={item.insight}
              insightReferences={item.insightReferences}
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
