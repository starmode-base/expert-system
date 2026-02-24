import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import {
  ArrowUpOnSquareIcon,
  CheckIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentIcon,
} from "@heroicons/react/24/outline";
import type { InsightsItem } from "~/server/queries";
import {
  InsightReferences,
  type ReferenceItem,
} from "~/components/shared/references";

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
    <div className="mt-4 rounded-md border border-gray-200 bg-gray-50">
      <div className="px-3 py-2 text-xs font-semibold tracking-wide text-gray-600 uppercase">
        Research Question
      </div>
      <div className="border-t border-gray-200 px-3 py-2 text-sm text-gray-800">
        <p className="break-words whitespace-pre-wrap">
          {props.prompt?.trim() ? props.prompt : "—"}
        </p>
      </div>
    </div>
  );
}

interface InsightResearchProps {
  markdown: string;
  prompt: string | null | undefined;
  references: ReferenceItem[];
  takeaways: InsightsItem["insightTakeaways"];
}

function InsightResearch(props: InsightResearchProps) {
  const [researchExpanded, setResearchExpanded] = useState(false);
  const hasPrompt = Boolean(props.prompt?.trim());
  const hasMarkdown = Boolean(props.markdown.trim());

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
        <div className="mt-2 space-y-4">
          {hasPrompt ? <ResearchQuestion prompt={props.prompt} /> : null}
          {hasMarkdown ? (
            <div className="prose prose-slate prose-sm sm:prose-base max-w-none break-words">
              <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
                {props.markdown}
              </ReactMarkdown>
            </div>
          ) : null}
          <ProvidenceSection
            references={props.references}
            takeaways={props.takeaways}
          />
        </div>
      ) : null}
    </div>
  );
}

interface InsightTakeawaysProps {
  takeaways: InsightsItem["insightTakeaways"];
}

function InsightTakeaways(props: InsightTakeawaysProps) {
  if (props.takeaways.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="text-sm font-medium text-amber-700">
        Takeaways{" "}
        <span className="text-amber-400">({props.takeaways.length})</span>
      </div>
      <ul className="mt-2 space-y-2">
        {props.takeaways.map((takeaway) => {
          const publishedLabel = (() => {
            if (!takeaway.documentPublicationDate) return null;
            const publishedDate = new Date(takeaway.documentPublicationDate);
            if (Number.isNaN(publishedDate.getTime())) {
              return null;
            }
            return `Published ${publishedDate.toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}`;
          })();

          const documentTitleNode = takeaway.documentTitle ? (
            takeaway.documentLink ? (
              <a
                href={takeaway.documentLink}
                target="_blank"
                rel="noreferrer"
                className="text-blue-500 underline decoration-blue-300 underline-offset-2 hover:text-blue-800"
              >
                {takeaway.documentTitle}
              </a>
            ) : takeaway.documentId ? (
              <Link
                to="/news-feed/$documentid"
                params={{ documentid: takeaway.documentId }}
                className="text-blue-500 underline decoration-blue-300 underline-offset-2 hover:text-blue-800"
              >
                {takeaway.documentTitle}
              </Link>
            ) : (
              <span>{takeaway.documentTitle}</span>
            )
          ) : null;

          const documentSourceNode = takeaway.documentSource ? (
            <span>{takeaway.documentSource}</span>
          ) : null;

          const metadataParts = [
            documentTitleNode,
            documentSourceNode,
            publishedLabel ? <span>{publishedLabel}</span> : null,
          ].filter(Boolean);

          return (
            <li key={takeaway.takeawayId} className="rounded-md px-3 py-2">
              <Link
                to="/takeaway/$takeawayId"
                params={{ takeawayId: takeaway.takeawayId }}
                className="text-sm font-semibold text-gray-900 hover:text-blue-600 hover:underline"
              >
                {takeaway.title}
              </Link>
              {metadataParts.length > 0 ? (
                <div className="mt-1 text-xs text-gray-500">
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
              <p className="mt-1 text-xs text-gray-600">{takeaway.summary}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface ProvidenceSectionProps {
  references: ReferenceItem[];
  takeaways: InsightsItem["insightTakeaways"];
}

function ProvidenceSection(props: ProvidenceSectionProps) {
  return (
    <section className="mt-5 rounded-xl border border-amber-100 bg-amber-50/80">
      <div className="flex flex-wrap items-center justify-between px-3 py-2">
        <p className="text-[11px] font-semibold tracking-[0.3em] text-amber-600 uppercase">
          Provenance
        </p>
        <span className="rounded-full border border-amber-200 bg-white px-2 py-1 text-[10px] font-semibold tracking-[0.2em] text-amber-500 uppercase">
          Sources
        </span>
      </div>
      <div className="border-t border-amber-100">
        <div>
          {props.takeaways.length > 0 ? (
            <div className="bg-white/70 px-2 py-2 ring-1 ring-amber-100">
              <InsightTakeaways takeaways={props.takeaways} />
            </div>
          ) : null}
          <div className="bg-white/70 px-3 py-2 ring-1 ring-amber-100">
            <InsightReferences references={props.references} />
          </div>
        </div>
      </div>
    </section>
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
  const insightTakeaways = props.insightFeedItem.insightTakeaways;
  const insightReferences = props.insightFeedItem.insightReferences.map(
    (ref) => ({
      referenceId: ref.referenceId,
      referenceNumber: ref.insightReferenceNumber,
      reference: ref.reference,
      documentId: ref.documentId,
      documentTitle: ref.documentTitle,
      documentSource: ref.documentSource,
      documentLink: ref.documentLink,
      publicationDate: ref.documentPublicationDate,
    }),
  );

  const { preview: insightPreviewMarkdown } = getMarkdownPreview(
    props.insightFeedItem.insight.insight ?? "",
    INSIGHT_PREVIEW_CHAR_LIMIT,
  );

  const hasResearchSection =
    hasResearchMarkdown ||
    hasInsightPrompt ||
    insightReferences.length > 0 ||
    insightTakeaways.length > 0;

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

          {hasResearchSection ? (
            <InsightResearch
              markdown={researchMarkdown}
              prompt={insightPrompt}
              references={insightReferences}
              takeaways={insightTakeaways}
            />
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
