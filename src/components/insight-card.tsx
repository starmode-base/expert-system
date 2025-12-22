import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";
import { InsightSelect } from "~/postgres/schema";
import { InsightReferenceItem } from "~/server/queries";
import { InsightReferences } from "~/components/insight-references";

interface InsightCardProps {
  insight: InsightSelect;
  insightReferences: InsightReferenceItem[];
  loading: boolean;
  expanded?: boolean;
}

const INSIGHT_PREVIEW_CHAR_LIMIT = 360;

interface InsightMarkdownToggleProps {
  markdown: string | null | undefined;
  createdAt: Date;
  variant: "preview" | "full";
  onToggleExpanded: () => void;
}

function InsightMarkdownToggle(props: InsightMarkdownToggleProps) {
  const insightExists = Boolean(props.markdown?.trim());

  return (
    <button
      type="button"
      onClick={props.onToggleExpanded}
      className="block w-full cursor-pointer text-left"
    >
      <div className="mb-2 flex items-center justify-end gap-4">
        <div className="shrink-0 text-xs text-gray-500">
          {props.createdAt.toLocaleDateString()}
        </div>
      </div>

      {insightExists ? (
        <div
          className={
            props.variant === "preview" ? "text-base text-gray-700" : ""
          }
        >
          <div className="prose prose-slate prose-sm sm:prose-base max-w-none break-words">
            <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
              {props.markdown ?? ""}
            </ReactMarkdown>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          No insight has been generated yet.
        </p>
      )}
    </button>
  );
}

function getMarkdownPreview(markdown: string, limit: number) {
  const normalized = markdown.trim();
  if (normalized.length <= limit) {
    return { preview: normalized, truncated: false };
  }

  const sliced = normalized.slice(0, limit);
  const lastWhitespaceIdx = Math.max(
    sliced.lastIndexOf(" "),
    sliced.lastIndexOf("\n"),
    sliced.lastIndexOf("\t"),
  );

  const truncatedAt =
    lastWhitespaceIdx > Math.floor(limit * 0.6) ? lastWhitespaceIdx : limit;

  return {
    preview: `${sliced.slice(0, truncatedAt).trimEnd()}...`,
    truncated: true,
  };
}

export function InsightCard(props: InsightCardProps) {
  const [insightExpanded, setInsightExpanded] = useState(props.expanded);

  const insightMarkdown = props.insight.insight ?? "";
  const { preview: insightPreviewMarkdown } = getMarkdownPreview(
    insightMarkdown,
    INSIGHT_PREVIEW_CHAR_LIMIT,
  );

  return (
    <div className="bg-white p-4">
      {props.loading ? (
        <div className="flex items-center justify-center py-8">
          <div
            className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900"
            aria-label="Loading"
            role="status"
          />
        </div>
      ) : insightExpanded ? (
        <>
          <InsightMarkdownToggle
            markdown={props.insight.insight}
            createdAt={props.insight.createdAt}
            variant="full"
            onToggleExpanded={() => {
              setInsightExpanded((prev) => !prev);
            }}
          />
          {/* Add margin below the expanded insight content */}
          <div className="mb-4" />

          <InsightReferences insightReferences={props.insightReferences} />
        </>
      ) : (
        <InsightMarkdownToggle
          markdown={props.insight.insight ? insightPreviewMarkdown : ""}
          createdAt={props.insight.createdAt}
          variant="preview"
          onToggleExpanded={() => {
            setInsightExpanded((prev) => !prev);
          }}
        />
      )}
    </div>
  );
}
