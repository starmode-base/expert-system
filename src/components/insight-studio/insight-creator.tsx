import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { TakeawayTile } from "~/components/takeaway-tile";
import {
  MODEL_OPTIONS,
  ModelSelector,
  type ModelValue,
} from "~/components/model-selector";
import { sendEventGenerateInsightSF } from "~/server/inggest";
import { type TakeawaySearchResult } from "~/server/searchSFs";

export interface InsightCreatorProps {
  similarTakeaways: TakeawaySearchResult[];
  similarConcepts: TakeawaySearchResult[];
}

type SimilarItemsTab = "takeaways" | "concepts";

export function InsightCreator(props: InsightCreatorProps) {
  const { similarTakeaways, similarConcepts } = props;
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [seedText, setSeedText] = useState("");
  const [model, setModel] = useState<ModelValue>(MODEL_OPTIONS[0].value);
  const [error, setError] = useState<string | null>(null);
  const [similarItemsTab, setSimilarItemsTab] =
    useState<SimilarItemsTab>("takeaways");
  const sendEventGenerateInsight = useServerFn(sendEventGenerateInsightSF);

  return (
    <div className="flex h-[calc(100dvh-64px)] w-full overflow-hidden bg-white">
      <div className="flex h-full w-1/3 flex-col overflow-y-auto border-r border-gray-200 p-4">
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
          {error ? <p className="mt-1 text-sm text-red-500">{error}</p> : null}
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
                setError("Please enter a prompt before generating an insight.");
                return;
              }
              setError(null);
              await sendEventGenerateInsight({
                data: {
                  seedText,
                  insightPrompt: prompt,
                },
              });
              setLoading(true);
            }}
          >
            Generate Insight
          </button>
        </div>
      </div>

      <div className="flex h-full min-w-0 flex-1 flex-col">
        <div
          className="border-b border-gray-200"
          role="tablist"
          aria-label="Similar items"
        >
          <nav className="flex space-x-4 px-4">
            <button
              type="button"
              role="tab"
              id="similar-items-tab-takeaways"
              aria-selected={similarItemsTab === "takeaways"}
              aria-controls="similar-items-panel-takeaways"
              onClick={() => {
                setSimilarItemsTab("takeaways");
              }}
              className={`border-b-2 px-3 py-3 text-sm font-medium ${
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
              className={`border-b-2 px-3 py-3 text-sm font-medium ${
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
          className="min-h-0 flex-1"
        >
          <div className="flex h-full flex-col overflow-y-auto p-4">
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
          className="min-h-0 flex-1"
        >
          <div className="flex h-full flex-col overflow-y-auto p-4">
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
  );
}
