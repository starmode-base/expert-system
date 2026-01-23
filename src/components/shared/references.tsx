import { useState } from "react";
import { Link } from "@tanstack/react-router";

export interface ReferenceItem {
  referenceId: string;
  referenceNumber: number;
  reference: string;
  documentId?: string;
  documentTitle?: string;
  documentSource?: string;
  documentLink?: string;
  publicationDate?: Date;
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
            {sortedReferences.map((ref) => {
              const publishedLabel = (() => {
                if (!ref.publicationDate) return null;
                const publishedDate = new Date(ref.publicationDate);
                if (Number.isNaN(publishedDate.getTime())) {
                  return null;
                }
                return `Published ${publishedDate.toLocaleDateString(
                  undefined,
                  {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  },
                )}`;
              })();

              const documentTitleNode = ref.documentTitle ? (
                ref.documentLink ? (
                  <a
                    href={ref.documentLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-500 underline decoration-blue-300 underline-offset-2 hover:text-blue-800"
                  >
                    {ref.documentTitle}
                  </a>
                ) : ref.documentId ? (
                  <Link
                    to="/news-feed/$documentid"
                    params={{ documentid: ref.documentId }}
                    className="text-blue-500 underline decoration-blue-300 underline-offset-2 hover:text-blue-800"
                  >
                    {ref.documentTitle}
                  </Link>
                ) : (
                  <span>{ref.documentTitle}</span>
                )
              ) : null;

              const documentSourceNode = ref.documentSource ? (
                <span>{ref.documentSource}</span>
              ) : null;

              const metadataParts = [
                documentTitleNode,
                documentSourceNode,
                publishedLabel ? <span>{publishedLabel}</span> : null,
              ].filter(Boolean);

              return (
                <li key={ref.referenceId} className="space-y-1">
                  <div className="text-gray-800">{ref.reference}</div>
                  {metadataParts.length > 0 ? (
                    <div className="text-xs text-gray-500">
                      {metadataParts.map((part, index) => (
                        <span key={index}>
                          {index > 0 ? (
                            <span className="px-1 text-gray-400">·</span>
                          ) : null}
                          {part}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-gray-500">No references yet.</p>
        )
      ) : null}
    </div>
  );
}
