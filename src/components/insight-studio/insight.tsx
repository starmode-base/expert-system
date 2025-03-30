// Insight (Insight Tab Component)
interface InsightProps {
  insight: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    title: string;
    insight: string | null;
  };
}

export function Insight({ insight }: InsightProps) {
  if (!insight.insight)
    return (
      <div className="flex w-2/3 items-center justify-center">
        <p className="text-gray-700">No insight has been generated</p>
      </div>
    );
  return <p className="text-lg">{insight.insight}</p>;
}
