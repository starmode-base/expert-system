import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useInfiniteScroll } from "~/lib/use-infinite-scroll";
import type { PaginatedResult } from "~/server/pagination";
import { queryDocumentsPaginated } from "~/server/queries";

interface DocumentItem {
  id: string;
  title: string;
  description: string;
  publicationDate: Date;
  source: string;
  link: string;
}

interface NewsFeedListProps {
  initialPage: PaginatedResult<DocumentItem>;
  selectedDocId?: string;
}

function NewsFeedItem(props: { document: DocumentItem; isSelected: boolean }) {
  const { document, isSelected } = props;
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const description = document.description.trim();

  const secondaryMeta = [
    document.source,
    document.publicationDate.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={
        "relative border-b border-gray-200 p-4 transition-colors sm:p-6" +
        (isSelected
          ? " bg-gray-50 ring-2 ring-gray-300"
          : " bg-white hover:bg-gray-50")
      }
    >
      <Link
        to="/feeds/news/$documentid"
        params={{ documentid: document.id }}
        className="block"
      >
        <div className="min-w-0 space-y-1">
          <h2 className="text-base leading-tight font-semibold break-words text-gray-900 sm:text-lg">
            {document.title}
          </h2>
          {document.source ? (
            <p className="text-sm break-words text-gray-500 sm:truncate">
              {document.source}
            </p>
          ) : null}
          <p className="text-xs text-gray-500">{secondaryMeta}</p>
        </div>

        {description.length > 0 ? (
          <p
            className={
              "mt-3 text-sm leading-relaxed break-words text-gray-700" +
              (summaryExpanded ? "" : " line-clamp-2")
            }
          >
            {description}
          </p>
        ) : null}
      </Link>

      {description.length > 0 ? (
        <button
          type="button"
          onClick={() => {
            setSummaryExpanded((prev) => !prev);
          }}
          className="mt-2 cursor-pointer text-xs font-medium text-gray-400 hover:text-gray-600"
        >
          {summaryExpanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </div>
  );
}

export function NewsFeedList(props: NewsFeedListProps) {
  const { initialPage, selectedDocId } = props;

  const { items, sentinelRef, isLoadingMore } = useInfiniteScroll({
    initialData: initialPage,
    fetchPage: (cursor) =>
      queryDocumentsPaginated({ data: { cursor, limit: 25 } }),
  });

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {items.map((document) => (
        <NewsFeedItem
          key={document.id}
          document={document}
          isSelected={selectedDocId === document.id}
        />
      ))}
      <div ref={sentinelRef} className="py-4 text-center">
        {isLoadingMore ? (
          <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
        ) : null}
      </div>
    </div>
  );
}
