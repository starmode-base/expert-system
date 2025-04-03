import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { InsightSelect } from "~/postgres/schema";
import { sendEventGenerateInsightSF } from "~/server/inggest";
import { Takeaway } from "~/server/queries";

interface InsightProps {
  insight: InsightSelect;
  insightTakeaways: Takeaway[];
}

export function Insight({ insight, insightTakeaways }: InsightProps) {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("o1");
  const sendEventGenerateInsight = useServerFn(sendEventGenerateInsightSF);

  return (
    <div className="mx-auto min-h-screen rounded-lg bg-white p-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-800">
        Insight Generator
      </h1>

      {/* Selected Takeaways */}
      <div className="mb-6">
        <h2 className="text-lg font-medium text-gray-600">
          Selected Takeaways
        </h2>
        {insightTakeaways.length > 0 ? (
          insightTakeaways.map((takeaway, index) => (
            <div
              key={index}
              className="mt-2 rounded border border-gray-300 p-3"
            >
              <p className="text-sm">
                <span className="font-medium text-gray-500">Title:</span>{" "}
                {takeaway.title}
              </p>
            </div>
          ))
        ) : (
          <p className="mt-2 text-sm text-gray-500">No takeaways selected.</p>
        )}
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
      </div>

      {/* Model Selector */}
      <div className="mb-6">
        <h2 className="text-lg font-medium text-gray-600">Select Model</h2>
        <select
          value={model}
          onChange={(e) => {
            setModel(e.target.value);
          }}
          className="mt-2 w-full rounded border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-gray-400 focus:outline-none"
        >
          <option value="o3-mini">o3-mini ($4.40)</option>
          <option value="gpt-4o">gpt-4o ($10)</option>
          <option value="gpt-4o-mini">gpt-4o-mini ($0.60)</option>
          <option value="gpt-4.5-preview">gpt-4.5-preview ($150)</option>
          <option value="o1">o1 ($60)</option>
          <option value="o1-pro">o1-pro[WARNING] ($600)</option>
        </select>
      </div>

      {/* Generate Insight Button */}
      <div className="mb-6">
        <button
          className="w-full rounded bg-gray-900 px-4 py-2 text-white transition hover:bg-gray-800"
          onClick={async () => {
            await sendEventGenerateInsight({
              data: { insightId: insight.id, insightPrompt: prompt },
            });
          }}
        >
          Generate Insight
        </button>
      </div>

      {/* Display Generated Insight */}
      <div className="mt-4 rounded border border-gray-300 p-4">
        <h2 className="mb-2 text-lg font-medium text-gray-600">Insight</h2>
        {insight.insight ? (
          <p className="text-base text-gray-700">{insight.insight}</p>
        ) : (
          <p className="text-sm text-gray-500">
            No insight has been generated yet.
          </p>
        )}
      </div>
    </div>
  );
}
