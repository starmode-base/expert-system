import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { DocumentContent } from "~/components/document-content";
import {
  FilterBar,
  FilterParams,
  normalizeFilterValue,
} from "~/components/filter-bar";
import { TakeawayTile } from "~/components/takeaway-tile";
import { getInsightsSF } from "~/server/insights-studio-SFs";
import {
  getFilterValues,
  queryDocumentByTakeaway,
  // queryTakeaways,
} from "~/server/queries";
import { searchTakeawaysSF, TakeawaySearchResult } from "~/server/searchSFs";

export const Route = createFileRoute("/search/$takeawayid")({
  validateSearch: (search: Record<string, unknown> | undefined) => {
    // validate and parse the search params into a typed state
    return {
      searchInput: search?.searchInput as string | undefined,
      filters: search?.filters as FilterParams | undefined,
    };
  },
  loaderDeps: ({ search: { searchInput, filters } }) => ({
    searchInput,
    filters,
  }),
  loader: async ({ params: { takeawayid }, deps: search }) => {
    const insights = await getInsightsSF();
    const { sources, categories } = await getFilterValues();

    // normalizeFilterValue cleans the filter values, so they dont break the URL params
    // This mapping is required to map the normalized values back to the original
    const categoryMap: Record<string, string> = categories.reduce(
      (acc: Record<string, string>, category) => {
        acc[normalizeFilterValue(category)] = category;
        return acc;
      },
      {},
    );

    const sourceMap: Record<string, string> = sources.reduce(
      (acc: Record<string, string>, source) => {
        acc[normalizeFilterValue(source)] = source;
        return acc;
      },
      {},
    );

    console.log({ search });

    const { searchInput, filters } = search;
    //TODO: fix this need to clean search params.
    // e.g. Business,+Finance+&+Industries

    // TODO: need to fix date filter bug

    const takeaways = await searchTakeawaysSF({
      data: {
        searchInput,
        filters: filters
          ? {
              categories: filters.categories
                .map((category) => categoryMap[category])
                .filter(Boolean),
              sources: filters.sources
                .map((source) => sourceMap[source])
                .filter(Boolean),
              startDate: filters.startDate,
              endDate: filters.endDate,
            }
          : {
              categories,
              sources,
              startDate: undefined,
              endDate: undefined,
            },
      },
    });

    if (!takeawayid || takeawayid === "none") {
      takeawayid = takeaways[0]?.id ?? "";
    }

    const filtersProp = filters
      ? {
          categories: filters.categories
            .map((category: string) => categoryMap[category])
            .filter(Boolean),
          sources: filters.sources
            .map((source: string) => sourceMap[source])
            .filter(Boolean),
          startDate: filters.startDate,
          endDate: filters.endDate,
        }
      : {
          categories,
          sources,
          startDate: undefined,
          endDate: undefined,
        };

    const selectedDoc = await queryDocumentByTakeaway({ data: takeawayid });

    return {
      insights,
      takeaways,
      selectedDoc,
      takeawayid,
      sources,
      categories,
      searchInput,
      filtersProp,
    };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const {
    takeaways,
    insights,
    selectedDoc,
    takeawayid,
    sources,
    categories,
    searchInput: searchInputProp,
    filtersProp,
  } = Route.useLoaderData();
  const router = useRouter();
  const [takeawaySearchResults, setTakeawaySearchResults] =
    useState<TakeawaySearchResult[]>(takeaways);

  // Keep results in‑sync when loader re‑runs (e.g. after filters change)
  useEffect(() => {
    setTakeawaySearchResults(takeaways);
  }, [takeaways]);

  const [searchInput, setSearchInput] = useState(searchInputProp);
  const [selectedTakeaway, setSelectedTakeaway] = useState<string | null>(
    takeawayid,
  );
  const [filters, setFilters] = useState<FilterParams>(filtersProp);

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

  // Handle up/down keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!["ArrowUp", "ArrowDown"].includes(e.key)) return;
      const index = takeawaySearchResults.findIndex(
        (t) => t.id === selectedTakeaway,
      );
      if (index === -1) return;

      let newIndex = index;
      if (e.key === "ArrowUp") {
        newIndex = Math.max(0, index - 1);
      } else if (e.key === "ArrowDown") {
        newIndex = Math.min(takeawaySearchResults.length - 1, index + 1);
      }

      const newTakeaway = takeawaySearchResults[newIndex];
      if (newTakeaway && newTakeaway.id !== selectedTakeaway) {
        setSelectedTakeaway(newTakeaway.id);

        void router.navigate({
          to: "/search/$takeawayid",
          params: { takeawayid: newTakeaway.id },
          search: { searchInput, filters },
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedTakeaway, takeawaySearchResults, router, searchInput, filters]);

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      <div className="w-1/2 border-r border-gray-200 p-4">
        <h1 className="mb-4 text-2xl font-bold">Search Takeaways</h1>
        <div className="flex gap-2 pb-4">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const existingPath = router.state.location.pathname;
                void router.navigate({
                  to: existingPath,
                  search: { searchInput, filters },
                });
              }
            }}
            placeholder="Search takeaways..."
            className="flex-grow rounded border border-gray-300 p-2"
          />
          <button
            onClick={() => {
              const existingPath = router.state.location.pathname;
              void router.navigate({
                to: existingPath,
                search: { searchInput, filters },
              });
            }}
            className="cursor-pointer rounded-md border border-zinc-900 bg-zinc-900 px-4 py-1 text-white"
          >
            Search
          </button>
        </div>

        <FilterBar
          availableSources={sources}
          availableCategories={categories}
          filters={filters}
          setFilters={setFilters}
          updateURL={true}
        />

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
                  search={{ searchInput, filters }}
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
