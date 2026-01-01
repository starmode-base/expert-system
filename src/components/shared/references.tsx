import { useState } from "react";

export interface ReferenceItem {
  referenceId: string;
  referenceNumber: number;
  reference: string;
  documentTitle?: string;
  documentSource?: string;
}

interface InsightReferencesProps {
  references: ReferenceItem[];
}

export function InsightReferences(props: InsightReferencesProps) {
  const [referencesExpanded, setReferencesExpanded] = useState(false);

  const sortedReferences = props.references
    .slice()
    .sort((a, b) => a.referenceNumber - b.referenceNumber);

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
        <span className="text-gray-400">({props.references.length})</span>
      </button>

      {referencesExpanded ? (
        props.references.length > 0 ? (
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-gray-800">
            {sortedReferences.map((ref) => (
              <li key={ref.referenceId}>
                <span className="text-gray-800">{ref.reference}</span>
                {ref.documentTitle || ref.documentSource ? (
                  <div className="mt-0.5 text-xs text-gray-500">
                    {[ref.documentTitle, ref.documentSource]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                ) : null}
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
