import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useConnectionStateListener } from "ably/react";
import { useState } from "react";
import { Insight } from "~/components/insight-studio/insight";
import { InsightList } from "~/components/insight-studio/insights-list";
import { PubSubProvider, useNotifyUI } from "~/lib/ably";
import { getInsightsSF } from "~/server/insights-studio-SFs";
import { listOrganizationsSF } from "~/server/organizations";
import { queryInsightReferences } from "~/server/queries";

export const Route = createFileRoute("/insight-studio/$insightId")({
  loader: async ({ params: { insightId } }) => {
    const { viewerId } = await listOrganizationsSF();
    const insights = await getInsightsSF();
    const selectedInsight =
      insights.find((insight) => insight.id === insightId) ?? null;

    const insightReferences = await queryInsightReferences({ data: insightId });

    return {
      viewerId,
      selectedInsight,
      insights,
      insightReferences,
    };
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
// RouteComponent.tsx

export function RouteComponent() {
  const { viewerId, insights, selectedInsight, insightReferences } =
    Route.useLoaderData();
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  useConnectionStateListener("connected", ({ current }) => {
    console.log("Ably connection state:", current);
  });

  useNotifyUI(viewerId, (msg) => {
    console.log("message", msg);
    if (msg.data === "loading") {
      setLoading(true);
    } else {
      setLoading(false);
      void router.invalidate();
    }
  });

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-white">
      {/* Left Pane */}
      <InsightList insights={insights} />

      {/* Right Pane */}
      {!selectedInsight ? (
        <div className="flex w-2/3 items-center justify-center">
          <p className="text-gray-500">Select an insight to view details</p>
        </div>
      ) : (
        <div className="flex h-full w-4/5 flex-col">
          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <Insight
              insight={selectedInsight}
              insightReferences={insightReferences}
              loading={loading}
              onRefresh={async () => {
                await router.invalidate();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
