import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowUpOnSquareIcon,
  CheckIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentIcon,
} from "@heroicons/react/24/outline";
import {
  InsightReferences,
  type ReferenceItem,
} from "~/components/shared/references";
import { createInsightWithTakeawaySF } from "~/server/insights-studio-SFs";
import { Takeaway } from "~/server/queries";

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

function formatTakeawayClipboardText(takeaway: Takeaway) {
  const sections: string[] = [];
  const takeawayText = takeaway.takeaway.trim();

  if (takeawayText) {
    sections.push(`Takeaway:\n${takeawayText}`);
  }

  const sortedRefs = takeaway.references
    .slice()
    .sort((a, b) => a.referenceNumber - b.referenceNumber);

  if (sortedRefs.length > 0) {
    const documentSource =
      takeaway.documentSource ?? (takeaway as { source?: string }).source;

    const formattedRefs = sortedRefs.map((ref) => {
      const publishedDate = new Date(takeaway.publicationDate);
      const publishedLabel = Number.isNaN(publishedDate.getTime())
        ? null
        : `Published ${publishedDate.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}`;

      const metaParts = [
        takeaway.documentTitle,
        documentSource,
        publishedLabel,
        takeaway.documentLink,
      ].filter(Boolean);

      const metaSuffix =
        metaParts.length > 0 ? ` (${metaParts.join(" · ")})` : "";

      return `${ref.referenceNumber}. ${ref.reference}${metaSuffix}`;
    });

    sections.push(`References:\n${formattedRefs.join("\n")}`);
  }

  return sections.join("\n\n");
}

export function TakeawayTile(props: {
  takeaway: Takeaway;
  highlighted?: boolean;
}) {
  const { takeaway, highlighted = false } = props;
  const [takeawayExpanded, setTakeawayExpanded] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(true);
  const [isCreatingInsight, setIsCreatingInsight] = useState(false);
  const [conceptExpanded, setConceptExpanded] = useState(false);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const [takeawayCopied, setTakeawayCopied] = useState(false);
  const createInsightWithTakeaway = useServerFn(createInsightWithTakeawaySF);
  const router = useRouter();

  const documentSource =
    takeaway.documentSource ?? (takeaway as { source?: string }).source;
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

  const references: ReferenceItem[] = takeaway.references.map((ref) => ({
    referenceId: ref.id,
    referenceNumber: ref.referenceNumber,
    reference: ref.reference,
    documentId: takeaway.documentId,
    documentTitle: takeaway.documentTitle,
    documentSource,
    publicationDate: takeaway.publicationDate,
    documentLink: takeaway.documentLink,
  }));

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
      {/* Top bar: date + action buttons */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="shrink-0 text-xs text-gray-500">
          {takeaway.publicationDate.toLocaleDateString()}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={
              takeawayCopied
                ? "inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-800"
                : "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs text-gray-500"
            }
            aria-label={
              takeawayCopied
                ? "Copied takeaway to clipboard"
                : "Copy takeaway text and references"
            }
            onClick={async () => {
              const clipboardText = formatTakeawayClipboardText(takeaway);
              const copied = await copyToClipboard(clipboardText);
              if (!copied) return;

              setTakeawayCopied(true);
              window.setTimeout(() => {
                setTakeawayCopied(false);
              }, 2000);
            }}
          >
            {takeawayCopied ? (
              <ClipboardDocumentCheckIcon
                className="h-4 w-4"
                aria-hidden="true"
              />
            ) : (
              <ClipboardDocumentIcon className="h-4 w-4" aria-hidden="true" />
            )}
            <span>{takeawayCopied ? "Copied" : "Copy"}</span>
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
                to: "/takeaway/$takeawayId",
                params: { takeawayId: takeaway.id },
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className="text-base leading-tight font-semibold break-words text-gray-900 sm:text-lg">
            {takeaway.title}
          </h2>
          {takeaway.documentTitle || documentSource ? (
            <p className="text-sm break-words text-gray-500 sm:truncate">
              {takeaway.documentTitle ? (
                takeaway.documentLink ? (
                  <a
                    href={takeaway.documentLink}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                  >
                    {takeaway.documentTitle}
                  </a>
                ) : takeaway.documentId ? (
                  <Link
                    to="/news-feed/$documentid"
                    params={{ documentid: takeaway.documentId }}
                    className="hover:underline"
                  >
                    {takeaway.documentTitle}
                  </Link>
                ) : (
                  takeaway.documentTitle
                )
              ) : null}
              {takeaway.documentTitle && documentSource ? " · " : ""}
              {documentSource ?? null}
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
      </div>

      {/* References — amber provenance-style box */}
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
          <div className="bg-white/70 px-3 py-2 ring-1 ring-amber-100">
            <InsightReferences references={references} />
          </div>
        </div>
      </section>
    </div>
  );
}
