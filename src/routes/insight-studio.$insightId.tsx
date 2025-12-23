import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { InsightList } from "~/components/insight-studio/insights-list";
import { PubSubProvider } from "~/lib/ably";
import { getInsightsSF, listInsightsSF } from "~/server/insights-studio-SFs";
import { listOrganizationsSF } from "~/server/organizations";
import { getinsightTakeawaysSF, type InsightsItem } from "~/server/queries";
import { InsightCard } from "../components/insight-feed/insight-card";
import { TakeawaySearchResult } from "~/server/searchSFs";
import { TakeawayTile } from "~/components/takeaway-tile";

export const Route = createFileRoute("/insight-studio/$insightId")({
  loader: async ({ params: { insightId } }) => {
    const { viewerId } = await listOrganizationsSF();
    const insights = await listInsightsSF();
    const selectedInsightItem = await getInsightsSF({ data: insightId });

    const { takeawaysSummary, takeawaysConcepts } = await getinsightTakeawaysSF(
      { data: insightId },
    );

    return {
      viewerId,
      selectedInsightItem,
      insights,
      takeawaysSummary,
      takeawaysConcepts,
    };
  },
  component: RouteComponentProvider,
});

interface InsightProps {
  insight: InsightsItem;
  takeawaysSummary: TakeawaySearchResult[];
  takeawaysConcepts: TakeawaySearchResult[];
  loading: boolean;
}

type SimilarItemsTab = "takeaways" | "concepts";

function InsightDetails(props: InsightProps) {
  const { insight, takeawaysSummary, takeawaysConcepts, loading } = props;
  const [similarItemsTab, setSimilarItemsTab] =
    useState<SimilarItemsTab>("takeaways");

  return (
    <div className="mx-auto bg-white">
      <div className="border-b border-gray-200 px-4 py-4">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          {insight.insight.title}
        </h1>
        {loading ? (
          <p className="mt-1 text-sm text-gray-500">Generating…</p>
        ) : null}
      </div>

      <div className="flex">
        <div className="w-1/3 border-r border-gray-200 p-4">
          <div className="mb-6">
            <h2 className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
              Seed text
            </h2>
            <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">
              <p className="break-words whitespace-pre-wrap">
                {insight.insight.seedText?.trim()
                  ? insight.insight.seedText
                  : "—"}
              </p>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
              Prompt
            </h2>
            <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">
              <p className="break-words whitespace-pre-wrap">
                {insight.insight.insightPrompt?.trim()
                  ? insight.insight.insightPrompt
                  : "—"}
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
              Summary
            </h2>
            <div className="mt-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800">
              <p className="break-words whitespace-pre-wrap">
                {insight.insight.summary?.trim()
                  ? insight.insight.summary
                  : "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="w-2/3">
          <div
            className="border-b border-gray-200"
            role="tablist"
            aria-label="Similar items"
          >
            <nav className="flex space-x-4">
              <button
                type="button"
                role="tab"
                id="similar-items-tab-takeaways"
                aria-selected={similarItemsTab === "takeaways"}
                aria-controls="similar-items-panel-takeaways"
                onClick={() => {
                  setSimilarItemsTab("takeaways");
                }}
                className={`border-b-2 px-3 py-2 text-sm font-medium ${
                  similarItemsTab === "takeaways"
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-900"
                }`}
              >
                Takeaways
              </button>
              <button
                type="button"
                role="tab"
                id="similar-items-tab-concepts"
                aria-selected={similarItemsTab === "concepts"}
                aria-controls="similar-items-panel-concepts"
                onClick={() => {
                  setSimilarItemsTab("concepts");
                }}
                className={`border-b-2 px-3 py-2 text-sm font-medium ${
                  similarItemsTab === "concepts"
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-900"
                }`}
              >
                Concepts
              </button>
            </nav>
          </div>

          <div
            role="tabpanel"
            id="similar-items-panel-takeaways"
            aria-labelledby="similar-items-tab-takeaways"
            hidden={similarItemsTab !== "takeaways"}
          >
            <div className="flex max-h-[50vh] flex-col overflow-y-auto p-4">
              {takeawaysSummary.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No similar takeaways found.
                </p>
              ) : (
                <div className="border-t border-gray-200">
                  {takeawaysSummary.map((takeaway) => {
                    return (
                      <div
                        key={takeaway.id}
                        className="border-b border-gray-200"
                      >
                        <TakeawayTile takeaway={takeaway} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div
            role="tabpanel"
            id="similar-items-panel-concepts"
            aria-labelledby="similar-items-tab-concepts"
            hidden={similarItemsTab !== "concepts"}
          >
            <div className="flex max-h-[50vh] flex-col overflow-y-auto p-4">
              {takeawaysConcepts.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No similar concepts found.
                </p>
              ) : (
                <div className="border-t border-gray-200">
                  {takeawaysConcepts.map((takeaway) => {
                    return (
                      <div
                        key={takeaway.id}
                        className="border-b border-gray-200"
                      >
                        <TakeawayTile takeaway={takeaway} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const { insights, selectedInsightItem, takeawaysSummary, takeawaysConcepts } =
    Route.useLoaderData();

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-white">
      {/* Left Pane */}
      <InsightList insights={insights} />

      {/* Right Pane */}
      {!selectedInsightItem ? (
        <div className="flex w-2/3 items-center justify-center">
          <p className="text-gray-500">Select an insight to view details</p>
        </div>
      ) : (
        <div className="flex h-full w-4/5 flex-col">
          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto px-4">
            <InsightDetails
              insight={selectedInsightItem}
              takeawaysSummary={takeawaysSummary}
              takeawaysConcepts={takeawaysConcepts}
              loading={false}
            />
            {/* Display Generated Insight */}
            <div className="border-t border-gray-200">
              <InsightCard
                insightFeedItem={selectedInsightItem}
                loading={false}
                expanded={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
