import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  FilterBar,
  FilterParams,
  normalizeFilterValue,
} from "~/components/filter-bar";
import { TakeawayTile } from "~/components/takeaway-tile";
import {
  getFilterValues,
  // queryTakeaways,
} from "~/server/queries";
import { searchTakeawaysSF, TakeawaySearchResult } from "~/server/searchSFs";

/**
 * denormalizeFilters takes normalized filter values from the URL and maps them back
 * to their original values. This is required because the normalized values are used
 * in the URL params to avoid breaking the URL.
 *
 * @param {FilterParams} filters - The normalized filter values
 * @param {string[]} sources - The possible source values
 * @returns {FilterParams} The denormalized filter values
 */
const denormalizeFilters = (filters: FilterParams, sources: string[]) => {
  // normalizeFilterValue cleans the filter values, so they dont break the URL params
  // This mapping is required to map the normalized values back to the original
  const sourceMap: Record<string, string> = sources.reduce(
    (acc: Record<string, string>, source) => {
      acc[normalizeFilterValue(source)] = source;
      return acc;
    },
    {},
  );

  return {
    sources: filters.sources.map((source) => sourceMap[source]).filter(Boolean),
    startDate: filters.startDate,
    endDate: filters.endDate,
  };
};

export const Route = createFileRoute("/takeaway-feed")({
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
  loader: async ({ deps: search }) => {
    const { sources } = await getFilterValues();
    const { searchInput, filters } = search;

    const takeaways = await searchTakeawaysSF({
      data: {
        searchInput,
        filters: filters
          ? denormalizeFilters(filters, sources)
          : {
              sources,
              startDate: undefined,
              endDate: undefined,
            },
      },
    });

    const filtersProp = filters
      ? denormalizeFilters(filters, sources)
      : {
          sources,
          startDate: undefined,
          endDate: undefined,
        };

    return {
      takeaways,
      sources,
      searchInput,
      filtersProp,
    };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const {
    takeaways,
    sources,
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
  const [filters, setFilters] = useState<FilterParams>(filtersProp);

  const handleSearch = () => {
    const existingPath = router.state.location.pathname;
    void router.navigate({
      to: existingPath,
      search: {
        searchInput,
        filters: router.state.location.search.filters,
      },
    });
  };

  return (
    <div className="h-[calc(100dvh-96px)] overflow-hidden">
      <div className="mx-auto flex h-full max-w-4xl flex-col px-2 sm:px-4">
        <div className="flex flex-col gap-3 bg-white p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
              placeholder="Search takeaways..."
              className="min-w-0 flex-1 rounded border border-gray-300 p-2"
            />
            <button
              onClick={handleSearch}
              className="cursor-pointer rounded-md border border-zinc-900 bg-zinc-900 px-4 py-2 text-white sm:py-1"
            >
              Search
            </button>
          </div>

          <FilterBar
            availableSources={sources}
            filters={filters}
            setFilters={setFilters}
            updateURL={true}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {takeawaySearchResults.length === 0 ? (
            <p className="py-4 text-center text-gray-500">
              No takeaways found.
            </p>
          ) : (
            <div className="border-t border-gray-200">
              {takeawaySearchResults.map((takeaway) => (
                <TakeawayTile key={takeaway.id} takeaway={takeaway} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
