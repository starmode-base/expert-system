import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import {
  ArrowUpOnSquareIcon,
  CheckIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentIcon,
} from "@heroicons/react/24/outline";
import type { InsightsItem } from "~/server/queries";
import { InsightReferences } from "~/components/shared/references";

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

interface ResearchQuestionProps {
  prompt: string | null | undefined;
}

function ResearchQuestion(props: ResearchQuestionProps) {
  return (
    <details className="group mt-4 rounded-md border border-gray-200 bg-gray-50">
      <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold tracking-wide text-gray-600 uppercase">
        <span className="mr-2 inline-flex h-4 w-4 items-center justify-center border-gray-300 text-[10px] text-gray-500 group-open:rotate-90">
          ▶
        </span>
        Research Question
      </summary>
      <div className="border-t border-gray-200 px-3 py-2 text-sm text-gray-800">
        <p className="break-words whitespace-pre-wrap">
          {props.prompt?.trim() ? props.prompt : "—"}
        </p>
      </div>
    </details>
  );
}

interface InsightResearchProps {
  markdown: string;
}

function InsightResearch(props: InsightResearchProps) {
  const [researchExpanded, setResearchExpanded] = useState(false);

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setResearchExpanded((prev) => !prev);
        }}
        className="flex w-full cursor-pointer items-center gap-1 text-left font-medium text-gray-500"
      >
        <span
          className={`inline-block transition-transform ${researchExpanded ? "rotate-90" : ""}`}
        >
          ▶
        </span>
        Research
      </button>
      {researchExpanded ? (
        <div className="mt-2">
          <div className="prose prose-slate prose-sm sm:prose-base max-w-none break-words">
            <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
              {props.markdown}
            </ReactMarkdown>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatInsightClipboardText(insightFeedItem: InsightsItem) {
  const sections: string[] = [];
  const insightText = insightFeedItem.insight.insight?.trim();

  if (insightText) {
    sections.push(`Insight:\n${insightText}`);
  }

  const references = insightFeedItem.insightReferences
    .slice()
    .sort((a, b) => a.insightReferenceNumber - b.insightReferenceNumber);

  if (references.length > 0) {
    const formattedRefs = references.map((ref) => {
      const publishedDate = new Date(ref.documentPublicationDate);
      const publishedLabel = Number.isNaN(publishedDate.getTime())
        ? null
        : `Published ${publishedDate.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}`;

      const metaParts = [
        ref.documentTitle,
        ref.documentSource,
        publishedLabel,
        ref.documentLink,
      ].filter(Boolean);

      const metaSuffix =
        metaParts.length > 0 ? ` (${metaParts.join(" · ")})` : "";

      return `${ref.insightReferenceNumber}. ${ref.reference}${metaSuffix}`;
    });

    sections.push(`References:\n${formattedRefs.join("\n")}`);
  }

  return sections.join("\n\n");
}

export function InsightCard(props: InsightCardProps) {
  const [insightExpanded, setInsightExpanded] = useState(props.expanded);
  const router = useRouter();
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const [insightCopied, setInsightCopied] = useState(false);
  const insightPrompt = props.insightFeedItem.insight.insightPrompt;
  const hasInsightPrompt = Boolean(insightPrompt?.trim());
  const researchMarkdown = props.insightFeedItem.insight.research?.trim() ?? "";
  const hasResearchMarkdown = Boolean(researchMarkdown);

  const { preview: insightPreviewMarkdown } = getMarkdownPreview(
    props.insightFeedItem.insight.insight ?? "",
    INSIGHT_PREVIEW_CHAR_LIMIT,
  );

  return (
    <div className="bg-white p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="shrink-0 text-xs text-gray-500">
          {props.insightFeedItem.insight.createdAt.toLocaleDateString()}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={
              insightCopied
                ? "inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-800"
                : "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs text-gray-500"
            }
            aria-label={
              insightCopied
                ? "Copied insight to clipboard"
                : "Copy insight text and references"
            }
            onClick={async () => {
              const clipboardText = formatInsightClipboardText(
                props.insightFeedItem,
              );
              const copied = await copyToClipboard(clipboardText);
              if (!copied) return;

              setInsightCopied(true);
              window.setTimeout(() => {
                setInsightCopied(false);
              }, 2000);
            }}
          >
            {insightCopied ? (
              <ClipboardDocumentCheckIcon
                className="h-4 w-4"
                aria-hidden="true"
              />
            ) : (
              <ClipboardDocumentIcon className="h-4 w-4" aria-hidden="true" />
            )}
            <span>{insightCopied ? "Copied" : "Copy"}</span>
          </button>
          <button
            type="button"
            className={
              shareLinkCopied
                ? "inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-800"
                : "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs text-gray-500"
            }
            aria-label={
              shareLinkCopied ? "Copied share link" : "Copy share link"
            }
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
            <span>{shareLinkCopied ? "Copied" : "Share"}</span>
          </button>
        </div>
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

          {hasResearchMarkdown ? (
            <InsightResearch markdown={researchMarkdown} />
          ) : null}
          <InsightReferences
            references={props.insightFeedItem.insightReferences.map((ref) => ({
              referenceId: ref.referenceId,
              referenceNumber: ref.insightReferenceNumber,
              reference: ref.reference,
              documentId: ref.documentId,
              documentTitle: ref.documentTitle,
              documentSource: ref.documentSource,
              documentLink: ref.documentLink,
              publicationDate: ref.documentPublicationDate,
            }))}
          />
          {hasInsightPrompt ? (
            <ResearchQuestion prompt={insightPrompt} />
          ) : null}
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
