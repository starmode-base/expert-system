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

  const handleCreateInsight = async () => {
    if (isCreatingInsight) return;
    setIsCreatingInsight(true);
    try {
      void createInsightWithTakeaway({
        data: { takeawayId: takeaway.id },
      });
      //sleep for 3 seconds
      await new Promise((resolve) => setTimeout(resolve, 10000));
    } finally {
      setIsCreatingInsight(false);
    }
  };

  return (
    <div
      className={
        "relative bg-white p-4 transition-colors hover:bg-gray-50 sm:p-6" +
        (highlighted ? " ring-2 ring-gray-300" : "") +
        " border-b border-gray-200"
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className="text-base leading-tight font-semibold break-words text-gray-900 sm:text-lg">
            {takeaway.title}
          </h2>
          {documentMeta ? (
            <p className="text-sm break-words text-gray-500 sm:truncate">
              {documentMeta}
            </p>
          ) : null}
          <p className="text-xs text-gray-500">{secondaryMeta}</p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto sm:justify-end">
          <button
            onClick={handleCreateInsight}
            disabled={isCreatingInsight}
            className="inline-flex w-full cursor-pointer items-center justify-center rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-3 sm:py-1.5 sm:text-xs"
          >
            {isCreatingInsight ? (
              <span className="animate-spin">⚪</span>
            ) : (
              "Create Insight"
            )}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-col space-y-1 text-sm text-gray-700">
        <button
          onClick={() => {
            setSummaryExpanded((prev) => !prev);
          }}
          className="flex w-full cursor-pointer items-center gap-1 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase"
        >
          <span
            className={`inline-block text-[10px] transition-transform ${summaryExpanded ? "rotate-90" : ""}`}
          >
            ▶
          </span>
          Summary
        </button>
        {summaryExpanded ? (
          <p className="pl-4 text-sm leading-relaxed break-words text-gray-700">
            {takeaway.summary}
          </p>
        ) : null}

        <hr className="my-3 border-gray-200" />

        <button
          onClick={() => {
            setTakeawayExpanded((prev) => !prev);
          }}
          className="flex w-full cursor-pointer items-center gap-1 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase"
        >
          <span
            className={`inline-block text-[10px] transition-transform ${takeawayExpanded ? "rotate-90" : ""}`}
          >
            ▶
          </span>
          Takeaway
        </button>
        {takeawayExpanded ? (
          <p className="pl-4 text-sm leading-relaxed break-words text-gray-700">
            {takeaway.takeaway}
          </p>
        ) : null}

        <hr className="my-3 border-gray-200" />

        <button
          onClick={() => {
            setConceptExpanded((prev) => !prev);
          }}
          className="flex w-full cursor-pointer items-center gap-1 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase"
        >
          <span
            className={`inline-block text-[10px] transition-transform ${conceptExpanded ? "rotate-90" : ""}`}
          >
            ▶
          </span>
          Concept
        </button>
        {conceptExpanded ? (
          <p className="pl-4 text-sm leading-relaxed break-words text-gray-700">
            {takeaway.concept}
          </p>
        ) : null}

        <hr className="my-3 border-gray-200" />

        <button
          onClick={() => {
            setReferencesExpanded((prev) => !prev);
          }}
          className="flex w-full cursor-pointer items-center gap-1 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase"
        >
          <span
            className={`inline-block text-[10px] transition-transform ${referencesExpanded ? "rotate-90" : ""}`}
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
            <ol className="space-y-1 pl-6 text-sm leading-relaxed text-gray-700 sm:pl-8">
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
