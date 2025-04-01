import { InsightSelect } from "~/postgres/schema";
import { Takeaway } from "~/server/queries";

// Insight (Insight Tab Component)
interface InsightProps {
  insight: InsightSelect;
  insightTakeaways: Takeaway[];
}

export function Insight({ insight, insightTakeaways }: InsightProps) {
  return (
    <div className="flex h-screen overflow-hidden p-2">
      <div className="flex w-2/3 flex-col">
        <p> Select takeaways:</p>
        {insightTakeaways.length > 0 &&
          insightTakeaways.map((takeaway) => <p> {takeaway.title}</p>)}

        <div className="text-gray-500">
          {insight.insight ? (
            <p className="text-lg">{insight.insight}</p>
          ) : (
            <ul className="text-gray-700">No insight has been generated</ul>
          )}
        </div>
      </div>
    </div>
  );
}
