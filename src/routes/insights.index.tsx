import { createFileRoute } from "@tanstack/react-router";
import { InsightCard } from "~/components/insight-card";
import { queryInsightsFeed } from "~/server/queries";

export const Route = createFileRoute("/insights/")({
  loader: async () => {
    const items = await queryInsightsFeed();
    return { items };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { items } = Route.useLoaderData();

  return (
    <div className="h-[calc(100vh-64px)] overflow-hidden">
      <div className="mx-auto flex h-full max-w-4xl flex-col px-4 py-6">
        <h1 className="border-b border-gray-200 pb-4 text-2xl font-semibold">
          Insights
        </h1>

        <div className="mt-4 flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-sm text-gray-500">No insights yet.</p>
          ) : (
            <div className="space-y-6">
              {items.map((item) => (
                <div key={item.insight.id}>
                  <InsightCard
                    insight={item.insight}
                    insightReferences={item.insightReferences}
                    loading={false}
                    className="bg-white"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
