import { Takeaway } from "~/server/queries";
import { TakeawayTile } from "../takeaway-tile";

// Takeaways (Takeaways Tab Component)
export function InsightTakeaways({
  insightTakeaways,
}: {
  insightTakeaways: Takeaway[];
}) {
  if (insightTakeaways.length === 0) {
    return <p>No takeaways yet</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {insightTakeaways.map((takeaway) => (
        <TakeawayTile key={takeaway.id} takeaway={takeaway} insights={[]} />
      ))}
    </ul>
  );
}
