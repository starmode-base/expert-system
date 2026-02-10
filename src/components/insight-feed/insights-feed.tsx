import { InsightCard } from "~/components/insight-feed/insight-card";
import { useInfiniteScroll } from "~/lib/use-infinite-scroll";
import type { PaginatedResult } from "~/server/pagination";
import type { InsightsItem } from "~/server/queries";

export interface InsightsFeedProps {
  initialPage: PaginatedResult<InsightsItem>;
  fetchPage: (cursor: string) => Promise<PaginatedResult<InsightsItem>>;
}

export function InsightsFeed(props: InsightsFeedProps) {
  const { items, sentinelRef, isLoadingMore } = useInfiniteScroll({
    initialData: props.initialPage,
    fetchPage: props.fetchPage,
  });

  if (items.length === 0) {
    return <p className="text-sm text-gray-500">No insights yet.</p>;
  }

  return (
    <div className="border-t border-gray-200">
      {items.map((item) => (
        <div key={item.insight.id} className="border-b border-gray-200">
          <InsightCard insightFeedItem={item} loading={false} />
        </div>
      ))}
      <div ref={sentinelRef} className="py-4 text-center">
        {isLoadingMore ? (
          <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
        ) : null}
      </div>
    </div>
  );
}
