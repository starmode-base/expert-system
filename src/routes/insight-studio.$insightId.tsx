import {
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  createInsightSF,
  deleteInsightSF,
  getInsightsSF,
  updateInsightTitleSF,
} from "~/server/insights-studio-SFs";

export const Route = createFileRoute("/insight-studio/$insightId")({
  loader: async ({ params: { insightId } }) => {
    const insights = await getInsightsSF();
    const insight =
      insights.find((insight) => insight.id === insightId) ?? null;

    return { insight, insights };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { insights, insight } = Route.useLoaderData();
  const router = useRouter();
  const navigate = useNavigate();

  const createInsight = useServerFn(createInsightSF);
  const deleteInsight = useServerFn(deleteInsightSF);
  const updateInsightTitle = useServerFn(updateInsightTitleSF);

  const handleSelectInsight = async (insightId: string) => {
    await navigate({
      to: "/insight-studio/$insightId",
      params: { insightId },
    });
  };

  return (
    <div className="flex h-screen gap-4 p-2">
      {/* Left Pane - Insight List */}
      <div className="h-full w-1/5 items-center gap-2 border-r border-gray-300 p-2">
        <div className="mb-4 flex justify-between">
          {" "}
          <h1 className="text-2xl font-semibold">Insight Studio</h1>
          <button
            onClick={async () => {
              await createInsight();
              await router.invalidate();
            }}
            className="rounded-md border border-zinc-900 bg-zinc-900 px-4 py-2 text-white"
          >
            +
          </button>
        </div>
        {insights.length > 0
          ? insights.map((insight) => (
              <div
                key={insight.id}
                className="flex flex-col rounded-md border-b border-gray-300 bg-white p-2"
              >
                <div
                  className="flex items-start justify-between"
                  onClick={async () => {
                    await handleSelectInsight(insight.id);
                  }}
                >
                  <p className="text-lg font-semibold">{insight.title}</p>

                  <button
                    onClick={async () => {
                      await deleteInsight({ data: insight.id });
                      await router.invalidate();
                    }}
                    className="ml-4 h-8 w-8 rounded-full bg-red-500 text-white hover:bg-red-600"
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-gray-700">{insight.insight}</p>
              </div>
            ))
          : "No insights"}
      </div>
      {/* Right Pane - Insight */}
      {!insight ? (
        <div className="flex w-2/3 items-center justify-center">
          <p className="text-gray-500">Select an insight to view details</p>
        </div>
      ) : (
        <div className="flex w-4/5">
          <div className="h-full flex-1 overflow-y-auto p-4">
            <input
              type="text"
              defaultValue={insight.title}
              onChange={async (e) => {
                await updateInsightTitle({
                  data: { id: insight.id, title: e.target.value },
                });
                await router.invalidate();
              }}
              className="text-lg font-semibold outline-none focus:border focus:border-zinc-500"
            />
            <p className="text-gray-700">{insight.insight}</p>
          </div>
        </div>
      )}
    </div>
  );
}
