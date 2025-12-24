import { createFileRoute } from "@tanstack/react-router";
import { InsightCreator } from "~/components/insight-studio/insight-creator";
import { InsightList } from "~/components/insight-studio/insights-list";

import { listInsightsSF } from "~/server/insights-studio-SFs";
import { listOrganizationsSF } from "~/server/organizations";

export const Route = createFileRoute("/insight-studio/")({
  component: RouteComponent,
  loader: async () => {
    const { viewerId } = await listOrganizationsSF();
    const insights = await listInsightsSF();

    return { viewerId, insights };
  },
});

function RouteComponent() {
  const { insights } = Route.useLoaderData();

  return (
    <div className="flex h-[calc(100dvh-64px)] w-full overflow-hidden bg-white">
      <InsightList insights={insights} />
      <div className="flex h-full min-w-0 flex-1">
        <InsightCreator />
      </div>
    </div>
  );
}
