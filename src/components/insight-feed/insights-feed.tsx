import { InsightCard } from "~/components/insight-feed/insight-card";
import type { InsightsItem } from "~/server/queries";

export interface InsightsFeedProps {
  items: InsightsItem[];
}

export function InsightsFeed(props: InsightsFeedProps) {
  const items = props.items;

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
    </div>
  );
}
