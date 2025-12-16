import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { InsightSelect } from "~/postgres/schema";
import { addTakeawayToInsightSF } from "~/server/insights-studio-SFs";
import { Takeaway } from "~/server/queries";

export function TakeawayTile(props: {
  takeaway: Takeaway;
  insights: InsightSelect[];
  highlighted?: boolean;
}) {
  const { takeaway, insights, highlighted = false } = props;
  const [insightSelectionOpen, setInsightSelectionOpen] = useState(false);
  const [takeawayExpanded, setTakeawayExpanded] = useState(true);
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  const [conceptExpanded, setConceptExpanded] = useState(false);
  const [referencesExpanded, setReferencesExpanded] = useState(false);
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
      className={
        `relative mb-4 rounded-xl border p-4 shadow-md ` +
        (highlighted ? "border-gray-400 bg-gray-100" : "border-gray-200")
      }
    >
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">
            {takeaway.title}
          </h2>
          <p className="text-sm text-gray-600">{takeaway.category}</p>
          <p className="text-sm text-gray-600">
            {takeaway.publicationDate.toLocaleString()}
          </p>
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
        <button
          onClick={() => {
            setSummaryExpanded((prev) => !prev);
          }}
          className="flex w-full cursor-pointer items-center gap-1 text-left font-medium text-gray-500"
        >
          <span
            className={`inline-block transition-transform ${summaryExpanded ? "rotate-90" : ""}`}
          >
            ▶
          </span>
          Summary
        </button>
        {summaryExpanded ? <p className="pl-4">{takeaway.summary}</p> : null}

        <hr className="my-3 border-gray-300" />

        <button
          onClick={() => {
            setTakeawayExpanded((prev) => !prev);
          }}
          className="flex w-full cursor-pointer items-center gap-1 text-left font-medium text-gray-500"
        >
          <span
            className={`inline-block transition-transform ${takeawayExpanded ? "rotate-90" : ""}`}
          >
            ▶
          </span>
          Takeaway
        </button>
        {takeawayExpanded ? <p className="pl-4">{takeaway.takeaway}</p> : null}

        <hr className="my-3 border-gray-300" />

        <button
          onClick={() => {
            setConceptExpanded((prev) => !prev);
          }}
          className="flex w-full cursor-pointer items-center gap-1 text-left font-medium text-gray-500"
        >
          <span
            className={`inline-block transition-transform ${conceptExpanded ? "rotate-90" : ""}`}
          >
            ▶
          </span>
          Concept
        </button>
        {conceptExpanded ? <p className="pl-4">{takeaway.concept}</p> : null}

        <hr className="my-3 border-gray-300" />

        <button
          onClick={() => {
            setReferencesExpanded((prev) => !prev);
          }}
          className="flex w-full cursor-pointer items-center gap-1 text-left font-medium text-gray-500"
        >
          <span
            className={`inline-block transition-transform ${referencesExpanded ? "rotate-90" : ""}`}
          >
            ▶
          </span>
          References{" "}
          <span className="text-gray-400">({takeaway.references.length})</span>
        </button>
        {referencesExpanded ? (
          takeaway.references.length === 0 ? (
            <p className="pl-4 text-gray-500">No references</p>
          ) : (
            <ol className="space-y-1 pl-8 text-gray-700">
              {takeaway.references
                .slice()
                .sort((a, b) => a.referenceNumber - b.referenceNumber)
                .map((ref) => (
                  <li key={ref.id} className="list-decimal">
                    <span className="text-gray-700">{ref.reference}</span>
                  </li>
                ))}
            </ol>
          )
        ) : null}
      </div>
    </div>
  );
}
