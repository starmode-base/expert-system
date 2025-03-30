import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { InsightSelect } from "~/postgres/schema";
import { sendEventGenerateTakeawaysSF } from "~/server/inggest";
import { addTakeawayToInsightSF } from "~/server/insights-studio-SFs";
import { Document } from "~/server/queries";

export function TakeawaysSection({
  selectedDoc,
  insights,
}: {
  selectedDoc: Document;
  insights: InsightSelect[];
}) {
  const [takeawayPrompt, setTakeawayPrompt] = useState("");
  const [model, setModel] = useState("gpt-4o");
  const [insightSelectionOpen, setInsightSelectionOpen] = useState(false);
  const sendEventGenerateTakeaways = useServerFn(sendEventGenerateTakeawaysSF);
  const addTakeawayToInsight = useServerFn(addTakeawayToInsightSF);

  const dropDown = (takeawayId: string) => {
    if (insights.length === 0) return null;

    return (
      <div className="flex w-64 flex-col overflow-hidden rounded-md border border-gray-200 bg-white shadow-md">
        {insights.map((insight) => (
          <div
            key={insight.id}
            role="button"
            tabIndex={0}
            onClick={async () => {
              await addTakeawayToInsight({
                data: { insightId: insight.id, takeawayId },
              });
            }}
            onKeyDown={async (e) => {
              if (e.key === "Enter") {
                await addTakeawayToInsight({
                  data: { insightId: insight.id, takeawayId },
                });
              }
            }}
            className="cursor-pointer px-4 py-2 transition-colors hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
          >
            {insight.title}
          </div>
        ))}
      </div>
    );
  };

  console.log({ insights });
  return (
    <div className="flex h-full max-h-[calc(100vh-200px)] flex-col overflow-y-auto p-4">
      {selectedDoc.takeaways.map((takeaway) => (
        <div
          key={takeaway.id}
          className="mb-4 rounded bg-gray-50 p-4 shadow-sm"
        >
          <h2 className="font-lg font-semibold text-gray-800">
            {takeaway.title}
          </h2>

          <div className="relative mt-2 text-sm text-gray-600">
            <div className="flex items-center justify-between">
              <p className="py-2 font-medium">{takeaway.category}</p>
              <button
                onClick={() => {
                  setInsightSelectionOpen(!insightSelectionOpen);
                }}
                className="font-medium underline"
              >
                Add to Insight
              </button>
            </div>

            {insightSelectionOpen ? (
              <div className="absolute right-0 z-10 mt-2">
                {dropDown(takeaway.id)}
              </div>
            ) : null}
          </div>

          <div className="mt-2 flex space-x-4 text-sm text-gray-600">
            <p>Monetization: {takeaway.monetization}</p>
            <p>Importance: {takeaway.importance}</p>
            <p>Novelty: {takeaway.novelty}</p>
          </div>

          <p className="py-2">
            <span className="font-medium text-gray-600 underline">
              Concept:
            </span>{" "}
            {takeaway.concept}
          </p>
          <hr className="my-4 border-gray-300" />

          <p className="py-2">
            <span className="font-medium text-gray-600 underline">
              Takeaway:
            </span>{" "}
            {takeaway.takeaway}
          </p>
        </div>
      ))}

      <input
        type="text"
        value={takeawayPrompt}
        onChange={(e) => {
          setTakeawayPrompt(e.target.value);
        }}
        className="mb-2 w-full rounded border border-gray-300 px-3 py-2"
        placeholder="Enter a prompt"
      />

      <select
        value={model}
        onChange={(e) => {
          setModel(e.target.value);
        }}
        className="mb-2 w-full rounded border border-gray-300 px-3 py-2"
      >
        <option value="o3-mini">o3-mini ($4.40)</option>
        <option value="gpt-4o">gpt-4o ($10)</option>
        <option value="gpt-4o-mini">gpt-4o-mini ($0.60)</option>
        <option value="gpt-4.5-preview">gpt-4.5-preview ($150)</option>
      </select>

      <button
        onClick={async () => {
          await sendEventGenerateTakeaways({
            data: {
              documentId: selectedDoc.id,
              takeawayPrompt,
              model,
            },
          });
        }}
        className="cursor-pointer rounded-md border border-zinc-900 bg-zinc-900 px-2 py-1 text-white"
      >
        Generate Takeaways
      </button>
    </div>
  );
}

export function ArticleSection({ selectedDoc }: { selectedDoc: Document }) {
  return (
    <div className="h-full flex-1 overflow-y-auto p-4">
      <div className="mb-4">
        <h2 className="text-2xl font-semibold">{selectedDoc.title}</h2>
      </div>
      <div className="overflow-y-scroll">
        <p className="mb-4 text-sm text-gray-600">
          {selectedDoc.publicationDate.toLocaleString()}
        </p>
        <p className="whitespace-pre-wrap text-gray-800">
          {selectedDoc.articleText}
        </p>
      </div>
    </div>
  );
}

export function DocumentContent({
  selectedDoc,
  insights,
}: {
  selectedDoc: Document | null;
  insights: InsightSelect[];
}) {
  const [activeTab, setActiveTab] = useState<"takeaways" | "article">(
    "takeaways",
  );

  if (!selectedDoc) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-gray-500">Select a document to view details</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <h2 className="mb-4 px-4 pt-4 text-2xl font-semibold">
        {selectedDoc.title}
      </h2>

      {activeTab === "takeaways" && (
        <TakeawaysSection selectedDoc={selectedDoc} insights={insights} />
      )}
      {activeTab === "article" && <ArticleSection selectedDoc={selectedDoc} />}

      {/* Tab Headers */}
      <div className="mb-2 border-b border-gray-200 px-4">
        <nav className="flex space-x-4">
          <button
            onClick={() => {
              setActiveTab("takeaways");
            }}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              activeTab === "takeaways"
                ? "border-black-500 text-black-600"
                : "hover:text-black-600 border-transparent text-gray-500"
            }`}
          >
            Takeaways
          </button>
          <button
            onClick={() => {
              setActiveTab("article");
            }}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              activeTab === "article"
                ? "border-black-500 text-black-600"
                : "hover:text-black-600 border-transparent text-gray-500"
            }`}
          >
            Article
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {activeTab === "takeaways" ? (
          <TakeawaysSection selectedDoc={selectedDoc} insights={insights} />
        ) : (
          <ArticleSection selectedDoc={selectedDoc} />
        )}
      </div>
    </div>
  );
}
