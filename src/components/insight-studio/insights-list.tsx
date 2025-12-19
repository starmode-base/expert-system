import { useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { createInsightSF, deleteInsightSF } from "~/server/insights-studio-SFs";

// InsightList.tsx (Left Pane Component)
interface InsightItem {
  id: string;
  title: string;
  insight: string | null;
}

interface InsightListProps {
  insights: InsightItem[];
}

export function InsightList(props: InsightListProps) {
  const navigate = useNavigate();
  const router = useRouter();
  const createInsight = useServerFn(createInsightSF);
  const deleteInsight = useServerFn(deleteInsightSF);

  const handleSelectInsight = async (insightId: string) => {
    await navigate({
      to: "/insight-studio/$insightId",
      params: { insightId },
    });
  };
  return (
    <div className="h-full w-1/5 items-center gap-2 overflow-y-auto border-r border-gray-300 p-2">
      <div className="mb-4 flex justify-end">
        <button
          onClick={async () => {
            await createInsight();
            await router.invalidate();
          }}
          className="border border-zinc-900 bg-zinc-900 px-4 py-2 text-white"
        >
          +
        </button>
      </div>
      <div className="mb-4">
        {props.insights.length > 0
          ? props.insights.map((insight) => (
              <div
                key={insight.id}
                className="flex flex-col border-b border-gray-300 bg-white p-2 hover:bg-gray-100"
              >
                <div
                  className="flex cursor-pointer items-start gap-2"
                  onClick={async () => {
                    await handleSelectInsight(insight.id);
                  }}
                >
                  <p className="min-w-0 flex-1 text-lg leading-snug font-semibold break-words">
                    {insight.title}
                  </p>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      await deleteInsight({ data: insight.id });
                      await router.invalidate();
                    }}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          : "No insights"}
      </div>
    </div>
  );
}
