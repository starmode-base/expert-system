import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { DocumentContent } from "~/components/document-content";
import { TakeawayTile } from "~/components/takeaway-tile";
import { getInsightsSF } from "~/server/insights-studio-SFs";
import { queryDocument, queryTakeaways } from "~/server/queries";
import { searchTakeawaysSF, TakeawaySearchResult } from "~/server/searchSFs";

export const Route = createFileRoute("/search/$documentid")({
  loader: async ({ params: { documentid } }) => {
    const insights = await getInsightsSF();
    const takeaways = await queryTakeaways();
    if (!documentid || documentid === "none") {
      documentid = takeaways[0]?.documentId ?? "";
    }
    const selectedDoc = await queryDocument({ data: documentid });

    return { insights, takeaways, selectedDoc };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { takeaways, insights, selectedDoc } = Route.useLoaderData();
  const [takeawaySearchResults, setTakeawaySearchResults] =
    useState<TakeawaySearchResult[]>(takeaways);
  const [searchInput, setSearchInput] = useState("");
  const searchTakeaways = useServerFn(searchTakeawaysSF);

  const handleSearch = async () => {
    console.log(searchInput);
    if (!searchInput.trim()) return;
    const results = await searchTakeaways({ data: searchInput });
    setTakeawaySearchResults(results);
    console.log(results);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      <div className="w-1/2 border-r border-gray-200 p-4">
        <h1 className="mb-4 text-2xl font-bold">Search Takeaways</h1>
        <div className="flex gap-2 border-b border-gray-200 pb-4">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
            }}
            onKeyDown={async (e) => {
              if (e.key === "Enter") {
                await handleSearch();
              }
            }}
            placeholder="Search takeaways..."
            className="flex-grow rounded border border-gray-300 p-2"
          />
          <button
            onClick={handleSearch}
            className="cursor-pointer rounded-md border border-zinc-900 bg-zinc-900 px-4 py-1 text-white"
          >
            Search
          </button>
        </div>
        <div className="h-full flex-1 overflow-y-auto">
          {" "}
          {takeawaySearchResults.length === 0 ? (
            <p className="text-gray-500">No takeaways found.</p>
          ) : (
            <div className="space-y-4">
              {takeawaySearchResults.map((takeaway) => (
                <Link
                  key={takeaway.id}
                  to="/search/$documentid"
                  params={{ documentid: takeaway.documentId }}
                >
                  <TakeawayTile
                    key={takeaway.id}
                    takeaway={takeaway}
                    insights={insights}
                    highlighted={takeaway.documentId === selectedDoc?.id}
                  />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex h-full w-2/3 flex-col">
        <DocumentContent selectedDoc={selectedDoc} insights={insights} />
      </div>
    </div>
  );
}
