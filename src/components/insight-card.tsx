import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";
import { InsightSelect } from "~/postgres/schema";
import { InsightReferenceItem } from "~/server/queries";

interface InsightCardProps {
  insight: InsightSelect;
  insightReferences: InsightReferenceItem[];
  loading: boolean;
  className?: string;
}

export function InsightCard(props: InsightCardProps) {
  const className = props.className
    ? `rounded border border-gray-300 p-4 ${props.className}`
    : "rounded border border-gray-300 p-4";

  const [insightExpanded, setInsightExpanded] = useState(false);
  const [referencesExpanded, setReferencesExpanded] = useState(false);

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-end gap-4">
        <div className="shrink-0 text-xs text-gray-500">
          {props.insight.createdAt.toLocaleString()}
        </div>
      </div>

      {/* Summary */}

      {/* not bold */}
      <span className="font-normal">{props.insight.summary}</span>
      <hr className="my-3 border-gray-200" />
      {props.loading ? (
        <div className="flex items-center justify-center py-8">
          <div
            className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900"
            aria-label="Loading"
            role="status"
          />
        </div>
      ) : (
        <>
          <button
            onClick={() => {
              setInsightExpanded((prev) => !prev);
            }}
            className="flex w-full cursor-pointer items-center gap-1 text-left font-medium text-gray-500"
          >
            <span
              className={`inline-block transition-transform ${insightExpanded ? "rotate-90" : ""}`}
            >
              ▶
            </span>
            Insight
          </button>

          {insightExpanded ? (
            props.insight.insight ? (
              <div className="mt-2 text-base text-gray-700">
                <div className="prose max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
                    {props.insight.insight}
                  </ReactMarkdown>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-gray-500">
                No insight has been generated yet.
              </p>
            )
          ) : null}

          <hr className="my-3 border-gray-200" />

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
            <span className="text-gray-400">
              ({props.insightReferences.length})
            </span>
          </button>

          {referencesExpanded ? (
            props.insightReferences.length > 0 ? (
              <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-gray-800">
                {props.insightReferences
                  .slice()
                  .sort(
                    (a, b) =>
                      a.insightReferenceNumber - b.insightReferenceNumber,
                  )
                  .map((ref) => (
                    <li key={ref.referenceId} className="list-disc">
                      <span className="text-gray-800">
                        {ref.insightReferenceNumber}.{" "}
                      </span>
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
        </>
      )}
    </div>
  );
}
