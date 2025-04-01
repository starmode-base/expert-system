import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { TakeawayTile } from "~/components/takeaway-tile";
import { getInsightsSF } from "~/server/insights-studio-SFs";
import { searchTakeawaysSF, TakeawaySearchResult } from "~/server/searchSFs";

export const Route = createFileRoute("/search")({
  loader: async () => {
    const insights = await getInsightsSF();
    return { insights };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const [takeawaySearchResults, setTakeawaySearchResults] = useState<
    TakeawaySearchResult[]
  >([]);
  const { insights } = Route.useLoaderData();
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
    <div className="mx-auto max-w-4xl p-4">
      <h1 className="mb-4 text-2xl font-bold">Search Takeaways</h1>

      <div className="mb-6 flex gap-2">
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

      {takeawaySearchResults.length === 0 ? (
        <p className="text-gray-500">No takeaways found.</p>
      ) : (
        <div className="space-y-4">
          {takeawaySearchResults.map((takeaway) => (
            <TakeawayTile
              key={takeaway.id}
              takeaway={takeaway}
              insights={insights}
            />
          ))}
        </div>
      )}
    </div>
  );
}
