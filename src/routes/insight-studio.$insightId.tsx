import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useConnectionStateListener } from "ably/react";
import { useState } from "react";
import { Insight } from "~/components/insight-studio/insight";
import { InsightList } from "~/components/insight-studio/insights-list";
import { InsightTakeaways } from "~/components/insight-studio/insightTakeaways";
import { PubSubProvider, useNotifyUI } from "~/lib/ably";
import {
  getInsightsSF,
  getInsightTakeawaysSF,
  updateInsightTitleSF,
} from "~/server/insights-studio-SFs";
import { listOrganizationsSF } from "~/server/organizations";
import { queryInsightReferences } from "~/server/queries";

export const Route = createFileRoute("/insight-studio/$insightId")({
  loader: async ({ params: { insightId } }) => {
    const { viewerId } = await listOrganizationsSF();
    const insights = await getInsightsSF();
    const selectedInsight =
      insights.find((insight) => insight.id === insightId) ?? null;
    const insightTakeaways = await getInsightTakeawaysSF({
      data: { insightId },
    });
    const insightReferences = await queryInsightReferences({ data: insightId });

    return {
      viewerId,
      selectedInsight,
      insights,
      insightTakeaways,
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
  const {
    viewerId,
    insights,
    selectedInsight,
    insightTakeaways,
    insightReferences,
  } = Route.useLoaderData();
  const router = useRouter();
  const updateInsightTitle = useServerFn(updateInsightTitleSF);
  const [activeTab, setActiveTab] = useState<"insight" | "takeaways">(
    "insight",
  );

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
          <input
            type="text"
            defaultValue={selectedInsight.title}
            onChange={async (e) => {
              await updateInsightTitle({
                data: { id: selectedInsight.id, title: e.target.value },
              });
              await router.invalidate();
            }}
            className="w-full px-2 py-1 text-lg font-semibold outline-none focus:border focus:border-zinc-500"
          />

          {/* Tab Headers */}
          <div className="mb-2 border-b border-gray-200 px-4">
            <nav className="flex space-x-4">
              <button
                onClick={() => {
                  setActiveTab("insight");
                }}
                className={`border-b-2 px-3 py-2 text-sm font-medium ${
                  activeTab === "insight"
                    ? "border-black-500 text-black-600"
                    : "hover:text-black-600 border-transparent text-gray-500"
                }`}
              >
                Insight
              </button>
              <button
                onClick={() => {
                  setActiveTab("takeaways");
                }}
                className={`border-b-2 px-3 py-2 text-sm font-medium ${
                  activeTab === "takeaways"
                    ? "border-black-500 text-black-600"
                    : "hover:text-black-600 border-transparent text-gray-500"
                }`}
              >
                Takeaways
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {activeTab === "insight" ? (
              <Insight
                insight={selectedInsight}
                insightTakeaways={insightTakeaways}
                insightReferences={insightReferences}
                loading={loading}
                onRefresh={async () => {
                  await router.invalidate();
                }}
              />
            ) : (
              <InsightTakeaways insightTakeaways={insightTakeaways} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
