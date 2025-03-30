import { InsightTakeaway } from "~/server/insights-studio-SFs";

// Takeaways (Takeaways Tab Component)
export function Takeaways({
  insightTakeaways,
}: {
  insightTakeaways: InsightTakeaway[];
}) {
  if (insightTakeaways.length === 0) {
    return <p>No takeaways yet</p>;
  }
  return (
    <ul>
      {insightTakeaways.map((takeaway) => (
        <li key={takeaway.takeawayId}>
          <p>{takeaway.takeaway.takeaway}</p>
        </li>
      ))}
    </ul>
  );
}
