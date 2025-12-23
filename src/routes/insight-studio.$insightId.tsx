import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useConnectionStateListener } from "ably/react";
import { useEffect, useState } from "react";
import { InsightList } from "~/components/insight-studio/insights-list";
import { PubSubProvider, useNotifyUI } from "~/lib/ably";
import { sendEventGenerateInsightSF } from "~/server/inggest";
import {
  getInsightsSF,
  listInsightsSF,
  updateInsightTitleSF,
} from "~/server/insights-studio-SFs";
import { listOrganizationsSF } from "~/server/organizations";
import {
  type InsightsItem,
  vectorConceptSearchTimeWeightedSF,
  vectorTakeawaySearchTimeWeightedSF,
} from "~/server/queries";
import { InsightCard } from "../components/insight-feed/insight-card";
import {
  MODEL_OPTIONS,
  ModelSelector,
  ModelValue,
} from "../components/model-selector";
import { TakeawaySearchResult } from "~/server/searchSFs";
import { TakeawayTile } from "~/components/takeaway-tile";

export const Route = createFileRoute("/insight-studio/$insightId")({
  loader: async ({ params: { insightId } }) => {
    const { viewerId } = await listOrganizationsSF();
    const insights = await listInsightsSF();
    const selectedInsightItem = await getInsightsSF({ data: insightId });

    const similarTakeaways = selectedInsightItem?.insight.seedText
      ? await vectorTakeawaySearchTimeWeightedSF({
          data: { query: selectedInsightItem.insight.seedText },
        })
      : [];
    const similarConcepts = selectedInsightItem?.insight.seedText
      ? await vectorConceptSearchTimeWeightedSF({
          data: { query: selectedInsightItem.insight.seedText },
        })
      : [];

    return {
      viewerId,
      selectedInsightItem,
      insights,
      similarTakeaways,
      similarConcepts,
    };
  },
  component: RouteComponentProvider,
});

interface InsightProps {
  insight: InsightsItem;
  similarTakeaways: TakeawaySearchResult[];
  similarConcepts: TakeawaySearchResult[];
  loading: boolean;
  onRefresh?: () => Promise<void> | void;
}

type SimilarItemsTab = "takeaways" | "concepts";

function Insight(props: InsightProps) {
  const { insight, similarTakeaways, similarConcepts, loading, onRefresh } =
    props;
  const [title, setTitle] = useState(insight.insight.title);
  const [prompt, setPrompt] = useState(insight.insight.insightPrompt ?? "");
  const [seedText, setSeedText] = useState(insight.insight.seedText ?? "");
  const [model, setModel] = useState<ModelValue>(MODEL_OPTIONS[0].value);
  const [error, setError] = useState<string | null>(null);
  const [similarItemsTab, setSimilarItemsTab] = useState<SimilarItemsTab>(
    () => {
      if (similarTakeaways.length === 0 && similarConcepts.length > 0) {
        return "concepts";
      }
      return "takeaways";
    },
  );
  const sendEventGenerateInsight = useServerFn(sendEventGenerateInsightSF);
  const updateInsightTitle = useServerFn(updateInsightTitleSF);

  useEffect(() => {
    setTitle(insight.insight.title);
    setPrompt(insight.insight.insightPrompt ?? "");
    setSeedText(insight.insight.seedText ?? "");
  }, [
    insight.insight.id,
    insight.insight.insightPrompt,
    insight.insight.seedText,
    insight.insight.title,
  ]);

  useEffect(() => {
    if (similarItemsTab === "takeaways") {
      if (similarTakeaways.length > 0) return;
      if (similarConcepts.length > 0) {
        setSimilarItemsTab("concepts");
      }
      return;
    }

    if (similarConcepts.length > 0) return;
    if (similarTakeaways.length > 0) {
      setSimilarItemsTab("takeaways");
    }
  }, [
    similarConcepts.length,
    similarItemsTab,
    similarTakeaways.length,
    setSimilarItemsTab,
  ]);

  return (
    <div className="mx-auto h-full rounded-lg bg-white p-6">
      <input
        type="text"
        value={title}
        onChange={(e) => {
          const nextTitle = e.target.value;
          setTitle(nextTitle);
          void (async () => {
            await updateInsightTitle({
              data: { id: insight.insight.id, title: nextTitle },
            });
            await onRefresh?.();
          })();
        }}
        className="mb-4 w-full px-2 py-1 text-2xl font-bold text-gray-800 outline-none focus:border focus:border-zinc-500"
      />

      <div className="flex">
        <div className="w-1/3 border-r border-gray-200 p-4">
          {/* Seed text input */}
          <div className="mb-6">
            <h2 className="text-lg font-medium text-gray-600">Seed text</h2>
            <textarea
              placeholder="Enter seed text..."
              className="mt-2 min-h-32 w-full resize-y rounded border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-gray-400 focus:outline-none"
              value={seedText}
              onChange={(e) => {
                setSeedText(e.target.value);
              }}
            />
          </div>

          {/* Prompt Input */}
          <div className="mb-6">
            <h2 className="text-lg font-medium text-gray-600">Enter Prompt</h2>
            <input
              type="text"
              placeholder="Enter your insight prompt..."
              className="mt-2 w-full rounded border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-gray-400 focus:outline-none"
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
              }}
            />
            {error ? (
              <p className="mt-1 text-sm text-red-500">{error}</p>
            ) : null}
          </div>

          {/* Model Selector */}
          <div className="mb-6">
            <h2 className="text-lg font-medium text-gray-600">Select Model</h2>
            <ModelSelector
              value={model}
              onChange={setModel}
              className="mb-6" // keeps existing margin‑bottom
            />
          </div>

          {/* Generate Insight Button */}
          <div className="mb-6">
            <button
              disabled={!prompt.trim() || loading}
              className={`w-full rounded px-4 py-2 transition ${
                prompt.trim() && !loading
                  ? "cursor-pointer bg-gray-900 text-white hover:bg-gray-800"
                  : "cursor-not-allowed bg-gray-300 text-gray-500"
              }`}
              onClick={async () => {
                if (!prompt.trim()) {
                  setError(
                    "Please enter a prompt before generating an insight.",
                  );
                  return;
                }
                setError(null);
                await sendEventGenerateInsight({
                  data: {
                    seedText,
                    insightPrompt: prompt,
                  },
                });
                await onRefresh?.();
              }}
            >
              Generate Insight
            </button>
          </div>
        </div>

        <div className="w-2/3 p-4">
          <div
            className="mb-2 border-b border-gray-200"
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
                    ? "border-black-500 text-black-600"
                    : "hover:text-black-600 border-transparent text-gray-500"
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
                    ? "border-black-500 text-black-600"
                    : "hover:text-black-600 border-transparent text-gray-500"
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
              {similarTakeaways.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No similar takeaways found.
                </p>
              ) : (
                similarTakeaways.map((takeaway) => (
                  <TakeawayTile key={takeaway.id} takeaway={takeaway} />
                ))
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
              {similarConcepts.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No similar concepts found.
                </p>
              ) : (
                similarConcepts.map((takeaway) => (
                  <TakeawayTile key={takeaway.id} takeaway={takeaway} />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Display Generated Insight */}
      <div className="border-t border-gray-200">
        <InsightCard insightFeedItem={insight} loading={loading} />
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
  const {
    viewerId,
    insights,
    selectedInsightItem,
    similarTakeaways,
    similarConcepts,
  } = Route.useLoaderData();
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
      {!selectedInsightItem ? (
        <div className="flex w-2/3 items-center justify-center">
          <p className="text-gray-500">Select an insight to view details</p>
        </div>
      ) : (
        <div className="flex h-full w-4/5 flex-col">
          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <Insight
              insight={selectedInsightItem}
              similarTakeaways={similarTakeaways}
              similarConcepts={similarConcepts}
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
