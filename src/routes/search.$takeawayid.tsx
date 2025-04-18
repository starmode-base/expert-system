import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useRef } from "react";
import { DocumentContent } from "~/components/document-content";
import { TakeawayTile } from "~/components/takeaway-tile";
import { getInsightsSF } from "~/server/insights-studio-SFs";
import { queryDocumentByTakeaway, queryTakeaways } from "~/server/queries";
import { searchTakeawaysSF, TakeawaySearchResult } from "~/server/searchSFs";

export const Route = createFileRoute("/search/$takeawayid")({
  loader: async ({ params: { takeawayid } }) => {
    const insights = await getInsightsSF();
    const takeaways = await queryTakeaways();
    if (!takeawayid || takeawayid === "none") {
      takeawayid = takeaways[0]?.id ?? "";
    }
    const selectedDoc = await queryDocumentByTakeaway({ data: takeawayid });

    return { insights, takeaways, selectedDoc, takeawayid };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { takeaways, insights, selectedDoc, takeawayid } =
    Route.useLoaderData();
  const [takeawaySearchResults, setTakeawaySearchResults] =
    useState<TakeawaySearchResult[]>(takeaways);
  const [searchInput, setSearchInput] = useState("");
  const [selectedTakeaway, setSelectedTakeaway] = useState<string | null>(
    takeawayid,
  );
  // Ref to the scrollable results pane
  const listRef = useRef<HTMLDivElement | null>(null);

  // Ensure only the results pane scrolls, not the whole page
  useEffect(() => {
    if (!selectedTakeaway || !listRef.current) return;
    const parent = listRef.current;
    const el = document.getElementById(`takeaway-${selectedTakeaway}`);
    if (el) {
      parent.scrollTo({
        top: el.offsetTop - parent.clientHeight / 4,
        behavior: "smooth",
      });
    }
  }, [selectedTakeaway, takeawaySearchResults.length]);
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
        {/* SEARCH PANE */}
        <div ref={listRef} className="h-full flex-1 overflow-y-auto">
          {" "}
          {takeawaySearchResults.length === 0 ? (
            <p className="text-gray-500">No takeaways found.</p>
          ) : (
            <div className="space-y-4">
              {takeawaySearchResults.map((takeaway) => (
                <Link
                  key={takeaway.id}
                  id={`takeaway-${takeaway.id}`}
                  to="/search/$takeawayid"
                  params={{ takeawayid: takeaway.id }}
                  onClick={() => {
                    setSelectedTakeaway(takeaway.id);
                  }}
                >
                  <TakeawayTile
                    key={takeaway.id}
                    takeaway={takeaway}
                    insights={insights}
                    highlighted={takeaway.id === selectedTakeaway}
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
