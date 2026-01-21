import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { TakeawayTile } from "~/components/takeaway-tile";
import { sendEventGenerateInsightSF } from "~/server/inggest";
import { type TakeawaySearchResult } from "~/server/searchSFs";
import {
  vectorConceptSearchTimeWeightedSF,
  vectorTakeawaySearchTimeWeightedSF,
} from "~/server/queries";

type SimilarItemsTab = "takeaways" | "concepts";

export function InsightCreator() {
  const [summaryTakeaways, setSummaryTakeaways] = useState<
    TakeawaySearchResult[]
  >([]);
  const [conceptTakeaways, setConceptTakeaways] = useState<
    TakeawaySearchResult[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [similarItemsTab, setSimilarItemsTab] =
    useState<SimilarItemsTab>("takeaways");
  const sendEventGenerateInsight = useServerFn(sendEventGenerateInsightSF);

  function useDebouncedSearch(searchText: string | null | undefined) {
    const requestIdRef = useRef(0);

    useEffect(() => {
      const q = (searchText ?? "").trim();

      if (q.length < 8) {
        setSummaryTakeaways([]);
        setConceptTakeaways([]);
        return;
      }

      const myRequestId = ++requestIdRef.current;

      const t = window.setTimeout(() => {
        void (async () => {
          const [summary, concepts] = await Promise.all([
            vectorTakeawaySearchTimeWeightedSF({
              data: { query: q, limit: 10 },
            }),
            vectorConceptSearchTimeWeightedSF({
              data: { query: q, limit: 10 },
            }),
          ]);

          // Ignore stale responses
          if (myRequestId !== requestIdRef.current) return;

          setSummaryTakeaways(summary);
          setConceptTakeaways(concepts);
        })();
      }, 350);

      return () => {
        window.clearTimeout(t);
      };
    }, [searchText]);
  }

  useDebouncedSearch(prompt);

  const formCardClasses =
    "rounded-xl border border-gray-200 bg-white shadow-sm ring-1 ring-gray-50";

  return (
    <div className="flex min-h-[calc(100dvh-64px)] w-full flex-col bg-gray-50 md:flex-row">
      <div className="flex w-full flex-col gap-4 border-b border-gray-200 px-4 pt-6 pb-4 md:h-[calc(100dvh-64px)] md:max-w-[380px] md:border-r md:border-b-0 md:bg-white md:px-6 md:py-6 md:shadow-sm">
        <div className={`${formCardClasses} p-4`}>
          <div>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold text-gray-700">
                Enter Research Question
              </h2>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                Required
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              What is the research question you want to answer?
            </p>
          </div>

          <input
            type="text"
            placeholder="Enter your insight prompt..."
            className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-inner focus:border-gray-400 focus:ring-2 focus:ring-gray-300 focus:outline-none"
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
            }}
            aria-describedby={error ? "prompt-error" : undefined}
          />
          {error ? (
            <p id="prompt-error" className="mt-2 text-sm text-red-500">
              {error}
            </p>
          ) : null}
        </div>

        <div className="sticky right-0 bottom-0 left-0 z-10 -mx-4 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent px-4 md:static md:mx-0 md:bg-transparent md:px-0 md:pt-0 md:pb-0">
          <button
            disabled={!prompt.trim() || loading}
            className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition ${
              prompt.trim() && !loading
                ? "cursor-pointer bg-gray-900 text-white hover:bg-gray-800"
                : "cursor-not-allowed bg-gray-300 text-gray-600"
            }`}
            onClick={async () => {
              if (!prompt.trim()) {
                setError("Please enter a prompt before generating an insight.");
                return;
              }
              setError(null);
              await sendEventGenerateInsight({
                data: {
                  insightPrompt: prompt,
                },
              });
              setLoading(true);
            }}
          >
            {loading ? "Generating..." : "Generate Insight"}
          </button>
        </div>
      </div>

      <div className="flex h-full min-h-[420px] flex-1 flex-col bg-white md:h-[calc(100dvh-64px)] md:rounded-l-xl md:border-l md:border-gray-200 md:shadow-inner">
        <div
          className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur"
          role="tablist"
          aria-label="Similar items"
        >
          <nav className="flex overflow-x-auto px-4">
            <button
              type="button"
              role="tab"
              id="similar-items-tab-takeaways"
              aria-selected={similarItemsTab === "takeaways"}
              aria-controls="similar-items-panel-takeaways"
              onClick={() => {
                setSimilarItemsTab("takeaways");
              }}
              className={`border-b-2 px-3 py-3 text-sm font-medium whitespace-nowrap ${
                similarItemsTab === "takeaways"
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              }`}
            >
              Takeaways
            </button>
            <button
              type="button"
              role="tab"
              id="similar-items-tab-concepts"
              aria-selected={similarItemsTab === "concepts"}
              aria-controls="similar-items-panel-concepts"
              onClick={() => {
                setSimilarItemsTab("concepts");
              }}
              className={`border-b-2 px-3 py-3 text-sm font-medium whitespace-nowrap ${
                similarItemsTab === "concepts"
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              }`}
            >
              Concepts
            </button>
          </nav>
        </div>

        <div className="min-h-0 flex-1">
          <div
            role="tabpanel"
            id="similar-items-panel-takeaways"
            aria-labelledby="similar-items-tab-takeaways"
            hidden={similarItemsTab !== "takeaways"}
            className="h-full"
          >
            <div className="h-full overflow-y-auto">
              {summaryTakeaways.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">
                  No similar takeaways found.
                </p>
              ) : (
                <div className="border-t border-gray-200">
                  {summaryTakeaways.map((takeaway) => {
                    return (
                      <div
                        key={takeaway.id}
                        className="border-b border-gray-200"
                      >
                        <TakeawayTile takeaway={takeaway} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div
            role="tabpanel"
            id="similar-items-panel-concepts"
            aria-labelledby="similar-items-tab-concepts"
            hidden={similarItemsTab !== "concepts"}
            className="h-full"
          >
            <div className="h-full overflow-y-auto">
              {conceptTakeaways.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">
                  No similar concepts found.
                </p>
              ) : (
                <div className="border-t border-gray-200">
                  {conceptTakeaways.map((takeaway) => {
                    return (
                      <div
                        key={takeaway.id}
                        className="border-b border-gray-200"
                      >
                        <TakeawayTile takeaway={takeaway} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
