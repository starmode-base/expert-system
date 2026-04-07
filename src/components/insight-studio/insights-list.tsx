import { useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { deleteInsightSF } from "~/server/insights-studio-SFs";

// Insight list (left pane component)
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
  const deleteInsight = useServerFn(deleteInsightSF);

  const handleSelectInsight = async (insightId: string) => {
    await navigate({
      to: "/dev/insight-studio/$insightId",
      params: { insightId },
    });
  };
  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="text-sm font-semibold text-gray-900">Insights</div>
        <button
          type="button"
          onClick={async () => {
            await navigate({ to: "/dev/insight-studio" });
          }}
          className="inline-flex items-center justify-center rounded-md bg-gray-900 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
          title="Create new insight"
        >
          New
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {props.insights.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No insights</p>
        ) : (
          <div className="border-t border-gray-200">
            {props.insights.map((insight) => (
              <div key={insight.id} className="border-b border-gray-200">
                <div className="flex items-start gap-2 px-4 py-3 hover:bg-gray-50">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={async () => {
                      await handleSelectInsight(insight.id);
                    }}
                  >
                    <p className="truncate text-sm font-medium text-gray-900">
                      {insight.title}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      await deleteInsight({ data: insight.id });
                      await router.invalidate();
                    }}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-xs text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
