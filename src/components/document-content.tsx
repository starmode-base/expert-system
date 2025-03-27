import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { sendEventGentateTakeawaysSF } from "~/server/inggest";
import { Document } from "~/server/queries";

export function DocumentContent({
  selectedDoc,
}: {
  selectedDoc: Document | null;
}) {
  const [takeawayPrompt, setTakeawayPrompt] = useState("");
  const [model, setModel] = useState("gpt-4o");
  const sendEventScienceDailyScraper = useServerFn(sendEventGentateTakeawaysSF);

  return (
    <div className="flex h-full flex-col">
      {selectedDoc ? (
        <>
          {/* Top: Takeaways */}
          <div className="flex h-1/2 flex-col border-b border-gray-200 p-4">
            <h2 className="mb-2 text-2xl font-semibold">{selectedDoc.title}</h2>

            <div className="h-full flex-1 overflow-y-auto">
              {/* <div className="mb-4 flex flex-wrap">
                {selectedDoc.tags.map((tag) => (
                  <div
                    key={tag}
                    className="mr-1 rounded bg-gray-50 p-1 shadow-sm"
                  >
                    <p className="font-medium">{tag}</p>
                  </div>
                ))}
              </div> */}
              {selectedDoc.takeaways.map((takeaway) => (
                <div
                  key={takeaway.id}
                  className="mb-4 rounded bg-gray-50 p-4 shadow-sm"
                >
                  <p className="font-medium">
                    <span className="text-gray-600">Takeaway: </span>
                    {takeaway.takeaway}
                  </p>
                  <hr className="my-4 border-gray-300" />
                  <p className="font-medium">
                    <span className="text-gray-600">Concept: </span>
                    {takeaway.concept}
                  </p>
                  <div className="mt-2 flex space-x-4">
                    <p className="text-sm text-gray-600">
                      Category: {takeaway.category}
                    </p>
                    <p className="text-sm text-gray-600">
                      Monetization: {takeaway.monetization}
                    </p>
                    <p className="text-sm text-gray-600">
                      Importance: {takeaway.importance}
                    </p>
                    <p className="text-sm text-gray-600">
                      Novelty: {takeaway.novelty}
                    </p>
                  </div>
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
              {/* add dropdown for model  */}
              <select
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                }}
                className="mb-2 w-full rounded border border-gray-300 px-3 py-2"
              >
                <option value="gpt-4o">gpt-4o ($10)</option>
                <option value="gpt-4o-mini">gpt-4o-mini ($0.60)</option>
                <option value="o3-mini">o3-mini ($4.40)</option>
                <option value="gpt-4.5-preview">gpt-4.5-preview ($150)</option>
              </select>

              <button
                onClick={async () => {
                  await sendEventScienceDailyScraper({
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
          </div>

          {/* Bottom: Article Text */}
          <div className="h-1/2 flex-1 overflow-y-auto p-4">
            <div className="mb-4">
              <h2 className="text-2xl font-semibold">{selectedDoc.title}</h2>
            </div>
            <div className="overflow-y-scroll">
              {/* pubDate */}
              <p className="mb-4 text-sm text-gray-600">
                {selectedDoc.pubDate}
              </p>
              <p className="whitespace-pre-wrap text-gray-800">
                {selectedDoc.articleText}
              </p>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-gray-500">Select a document to view details</p>
        </div>
      )}
    </div>
  );
}
