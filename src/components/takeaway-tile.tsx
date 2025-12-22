import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createInsightWithTakeawaySF } from "~/server/insights-studio-SFs";
import { Takeaway } from "~/server/queries";

export function TakeawayTile(props: {
  takeaway: Takeaway;
  highlighted?: boolean;
}) {
  const { takeaway, highlighted = false } = props;
  const [takeawayExpanded, setTakeawayExpanded] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(true);
  const [isCreatingInsight, setIsCreatingInsight] = useState(false);
  const [conceptExpanded, setConceptExpanded] = useState(false);
  const [referencesExpanded, setReferencesExpanded] = useState(false);
  const createInsightWithTakeaway = useServerFn(createInsightWithTakeawaySF);

  const documentSource =
    takeaway.documentSource ?? (takeaway as { source?: string }).source;
  const documentMeta = [takeaway.documentTitle, documentSource]
    .filter(Boolean)
    .join(" · ");
  const secondaryMeta = [
    takeaway.category,
    takeaway.publicationDate.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
  ]
    .filter(Boolean)
    .join(" · ");

  const handleCreateInsight = () => {
    if (isCreatingInsight) return;
    setIsCreatingInsight(true);
    try {
      void createInsightWithTakeaway({
        data: { takeawayId: takeaway.id },
      });
    } finally {
      setIsCreatingInsight(false);
    }
  };

  return (
    <div
      key={takeaway.id}
      className={
        `relative mb-4 rounded-xl border bg-white p-4 shadow-md ` +
        (highlighted ? "border-2 border-gray-400" : "border-gray-200")
      }
    >
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {takeaway.title}
          </h2>
          {documentMeta ? (
            <p className="mt-1 truncate text-sm text-gray-500">
              {documentMeta}
            </p>
          ) : null}
          <p className="mt-0.5 text-xs text-gray-500">{secondaryMeta}</p>
        </div>
        <button
          onClick={handleCreateInsight}
          disabled={isCreatingInsight}
          className="text-sm font-medium text-gray-700 underline decoration-gray-300 underline-offset-2 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Create Insight
        </button>
      </div>

      <div className="mt-4 flex flex-col space-y-1 text-sm text-gray-700">
        <button
          onClick={() => {
            setSummaryExpanded((prev) => !prev);
          }}
          className="flex w-full cursor-pointer items-center gap-1 text-left font-medium text-gray-600"
        >
          <span
            className={`inline-block transition-transform ${summaryExpanded ? "rotate-90" : ""}`}
          >
            ▶
          </span>
          Summary
        </button>
        {summaryExpanded ? <p className="pl-4">{takeaway.summary}</p> : null}

        <hr className="my-3 border-gray-200" />

        <button
          onClick={() => {
            setTakeawayExpanded((prev) => !prev);
          }}
          className="flex w-full cursor-pointer items-center gap-1 text-left font-medium text-gray-600"
        >
          <span
            className={`inline-block transition-transform ${takeawayExpanded ? "rotate-90" : ""}`}
          >
            ▶
          </span>
          Takeaway
        </button>
        {takeawayExpanded ? <p className="pl-4">{takeaway.takeaway}</p> : null}

        <hr className="my-3 border-gray-200" />

        <button
          onClick={() => {
            setConceptExpanded((prev) => !prev);
          }}
          className="flex w-full cursor-pointer items-center gap-1 text-left font-medium text-gray-600"
        >
          <span
            className={`inline-block transition-transform ${conceptExpanded ? "rotate-90" : ""}`}
          >
            ▶
          </span>
          Concept
        </button>
        {conceptExpanded ? <p className="pl-4">{takeaway.concept}</p> : null}

        <hr className="my-3 border-gray-200" />

        <button
          onClick={() => {
            setReferencesExpanded((prev) => !prev);
          }}
          className="flex w-full cursor-pointer items-center gap-1 text-left font-medium text-gray-600"
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
