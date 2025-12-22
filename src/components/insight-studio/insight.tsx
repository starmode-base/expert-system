import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { InsightSelect } from "~/postgres/schema";
import { updateInsightTitleSF } from "~/server/insights-studio-SFs";
import { sendEventGenerateInsightSF } from "~/server/inggest";
import { type InsightReferenceItem } from "~/server/queries";
import { MODEL_OPTIONS, ModelSelector, ModelValue } from "../model-selector";
import { InsightCard } from "../insight-feed/insight-card";

interface InsightProps {
  insight: InsightSelect;
  insightReferences: InsightReferenceItem[];
  loading: boolean;
  onRefresh?: () => Promise<void> | void;
}

export function Insight(props: InsightProps) {
  const { insight, insightReferences, loading, onRefresh } = props;
  const [title, setTitle] = useState(insight.title);
  const [prompt, setPrompt] = useState(insight.insightPrompt ?? "");
  const [seedText, setSeedText] = useState(insight.seedText ?? "");
  const [model, setModel] = useState<ModelValue>(MODEL_OPTIONS[0].value);
  const [error, setError] = useState<string | null>(null);
  const sendEventGenerateInsight = useServerFn(sendEventGenerateInsightSF);
  const updateInsightTitle = useServerFn(updateInsightTitleSF);

  useEffect(() => {
    setTitle(insight.title);
    setPrompt(insight.insightPrompt ?? "");
    setSeedText(insight.seedText ?? "");
  }, [insight.id, insight.insightPrompt, insight.seedText, insight.title]);

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
              data: { id: insight.id, title: nextTitle },
            });
            await onRefresh?.();
          })();
        }}
        className="mb-4 w-full px-2 py-1 text-2xl font-bold text-gray-800 outline-none focus:border focus:border-zinc-500"
      />

      <div className="flex">
        <div className="w-full p-4">
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
      </div>

      {/* Display Generated Insight */}
      <div className="border-t border-gray-200">
        <InsightCard
          insight={insight}
          insightReferences={insightReferences}
          loading={loading}
        />
      </div>
    </div>
  );
}
