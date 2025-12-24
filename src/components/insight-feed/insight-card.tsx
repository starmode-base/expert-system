import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { ArrowUpOnSquareIcon, CheckIcon } from "@heroicons/react/24/outline";
import type { InsightsItem } from "~/server/queries";
import { InsightReferences } from "~/components/insight-feed/insight-references";

interface InsightCardProps {
  insightFeedItem: InsightsItem;
  loading: boolean;
  expanded?: boolean;
}

const INSIGHT_PREVIEW_CHAR_LIMIT = 360;

async function copyToClipboard(text: string) {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt("Copy link", text);
    return false;
  }
}

interface InsightMarkdownToggleProps {
  markdown: string | null | undefined;
  createdAt: Date;
  variant: "preview" | "full";
  onToggleExpanded: () => void;
}

function InsightMarkdownToggle(props: InsightMarkdownToggleProps) {
  const insightExists = Boolean(props.markdown?.trim());

  return (
    <div>
      <button
        type="button"
        onClick={props.onToggleExpanded}
        className="block w-full cursor-pointer text-left"
      >
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
    </div>
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
  const router = useRouter();
  const [shareLinkCopied, setShareLinkCopied] = useState(false);

  const { preview: insightPreviewMarkdown } = getMarkdownPreview(
    props.insightFeedItem.insight.insight ?? "",
    INSIGHT_PREVIEW_CHAR_LIMIT,
  );

  return (
    <div className="bg-white p-4">
      <div className="mb-2 flex items-center justify-end gap-2">
        <div className="shrink-0 text-xs text-gray-500">
          {props.insightFeedItem.insight.createdAt.toLocaleDateString()}
        </div>
        <button
          type="button"
          className={
            shareLinkCopied
              ? "inline-flex cursor-pointer items-center gap-1.5 px-2 py-1 text-xs font-medium"
              : "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-slate-700"
          }
          aria-label={shareLinkCopied ? "Copied share link" : "Copy share link"}
          onClick={async () => {
            const href = router.buildLocation({
              to: "/insight/$insightId",
              params: { insightId: props.insightFeedItem.insight.id },
            }).href;

            const fullUrl = new URL(href, window.location.origin).toString();
            const copied = await copyToClipboard(fullUrl);
            if (copied) {
              setShareLinkCopied(true);
              window.setTimeout(() => {
                setShareLinkCopied(false);
              }, 2000);
            }
          }}
        >
          {shareLinkCopied ? (
            <CheckIcon className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ArrowUpOnSquareIcon className="h-4 w-4" aria-hidden="true" />
          )}
          <span>{shareLinkCopied ? "Copied" : ""}</span>
        </button>
      </div>
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
            markdown={props.insightFeedItem.insight.insight}
            createdAt={props.insightFeedItem.insight.createdAt}
            variant="full"
            onToggleExpanded={() => {
              setInsightExpanded((prev) => !prev);
            }}
          />
          {/* Add margin below the expanded insight content */}
          <div className="mb-4" />

          <InsightReferences
            insightReferences={props.insightFeedItem.insightReferences}
          />
        </>
      ) : (
        <InsightMarkdownToggle
          markdown={
            props.insightFeedItem.insight.insight ? insightPreviewMarkdown : ""
          }
          createdAt={props.insightFeedItem.insight.createdAt}
          variant="preview"
          onToggleExpanded={() => {
            setInsightExpanded((prev) => !prev);
          }}
        />
      )}
    </div>
  );
}
