import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { InsightSelect } from "~/postgres/schema";
import { addTakeawayToInsightSF } from "~/server/insights-studio-SFs";
import { Takeaway } from "~/server/queries";

export function TakeawayTile({
  takeaway,
  insights,
}: {
  takeaway: Takeaway;
  insights: InsightSelect[];
}) {
  const [insightSelectionOpen, setInsightSelectionOpen] = useState(false);
  const addTakeawayToInsight = useServerFn(addTakeawayToInsightSF);

  const handleAddToInsight = async (insightId: string, takeawayId: string) => {
    await addTakeawayToInsight({ data: { insightId, takeawayId } });
    setInsightSelectionOpen(false);
  };

  const dropDown = () => {
    if (insights.length === 0) return null;

    return (
      <div className="absolute top-12 right-4 z-20 w-64 rounded-md border border-gray-300 bg-white shadow-lg">
        {insights.map((insight) => (
          <button
            key={insight.id}
            onClick={() => handleAddToInsight(insight.id, takeaway.id)}
            className="w-full cursor-pointer px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
          >
            {insight.title}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div
      key={takeaway.id}
      className="relative mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-md"
    >
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">
            {takeaway.title}
          </h2>
          <p className="text-sm text-gray-600">{takeaway.category}</p>
        </div>
        {insights.length > 0 && (
          <button
            onClick={() => {
              setInsightSelectionOpen((prev) => !prev);
            }}
            className="text-sm font-medium text-blue-600 underline hover:text-blue-800"
          >
            Add to Insight
          </button>
        )}
      </div>

      {insightSelectionOpen ? dropDown() : null}

      <div className="mt-4 flex flex-col space-y-1 text-sm text-gray-700">
        <div className="flex flex-wrap gap-x-4">
          <p>
            <span className="font-medium text-gray-500">Monetization:</span>{" "}
            {takeaway.monetizationScore}
          </p>
          <p>
            <span className="font-medium text-gray-500">Importance:</span>{" "}
            {takeaway.importanceScore}
          </p>
          <p>
            <span className="font-medium text-gray-500">Novelty:</span>{" "}
            {takeaway.noveltyScore}
          </p>
        </div>

        <p className="pt-2">
          <span className="font-medium text-gray-500">Concept:</span>{" "}
          {takeaway.concept}
        </p>

        <hr className="my-3 border-gray-300" />

        <p>
          <span className="font-medium text-gray-500">Takeaway:</span>{" "}
          {takeaway.takeaway}
        </p>
      </div>
    </div>
  );
}
