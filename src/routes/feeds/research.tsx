import { createFileRoute } from "@tanstack/react-router";
import { InsightsFeed } from "~/components/insight-feed/insights-feed";
import { queryInsightsFeedPaginated } from "~/server/queries";

export const Route = createFileRoute("/feeds/research")({
  loader: async () => {
    const page = await queryInsightsFeedPaginated({
      data: { cursor: null, limit: 10 },
    });
    return { page };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { page } = Route.useLoaderData();

  return (
    <div className="h-[calc(100dvh-109px)] overflow-hidden">
      <div className="mx-auto flex h-full max-w-4xl flex-col px-2 sm:px-4">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <InsightsFeed
            initialPage={page}
            fetchPage={(cursor) =>
              queryInsightsFeedPaginated({
                data: { cursor, limit: 10 },
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
