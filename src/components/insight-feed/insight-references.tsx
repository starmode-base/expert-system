import { useState } from "react";
import { InsightReferenceItem } from "~/server/queries";

interface InsightReferencesProps {
  insightReferences: InsightReferenceItem[];
}

export function InsightReferences(props: InsightReferencesProps) {
  const [referencesExpanded, setReferencesExpanded] = useState(false);

  const sortedReferences = props.insightReferences
    .slice()
    .sort((a, b) => a.insightReferenceNumber - b.insightReferenceNumber);

  return (
    <div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
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
        <span className="text-gray-400">
          ({props.insightReferences.length})
        </span>
      </button>

      {referencesExpanded ? (
        props.insightReferences.length > 0 ? (
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-gray-800">
            {sortedReferences.map((ref) => (
              <li key={ref.referenceId}>
                <span className="text-gray-800">{ref.reference}</span>
                <div className="mt-0.5 text-xs text-gray-500">
                  {ref.documentTitle} · {ref.documentSource}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-gray-500">No references yet.</p>
        )
      ) : null}
    </div>
  );
}
