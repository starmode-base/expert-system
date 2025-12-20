import { createFileRoute } from "@tanstack/react-router";
import { InsightsFeed } from "~/components/insights-feed";
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
    <div className="h-[calc(100dvh-64px)] overflow-hidden">
      <div className="mx-auto flex h-full max-w-4xl flex-col px-2 sm:px-4">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <InsightsFeed items={items} />
        </div>
      </div>
    </div>
  );
}
