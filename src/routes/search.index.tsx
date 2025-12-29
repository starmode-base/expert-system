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
 * @param {string[]} categories - The possible category values
 * @param {string[]} sources - The possible source values
 * @returns {FilterParams} The denormalized filter values
 */
const denormalizeFilters = (
  filters: FilterParams,
  categories: string[],
  sources: string[],
) => {
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

  return {
    categories: filters.categories
      .map((category) => categoryMap[category])
      .filter(Boolean),
    sources: filters.sources.map((source) => sourceMap[source]).filter(Boolean),
    startDate: filters.startDate,
    endDate: filters.endDate,
  };
};

export const Route = createFileRoute("/search/")({
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
    const { sources, categories } = await getFilterValues();
    const { searchInput, filters } = search;

    const takeaways = await searchTakeawaysSF({
      data: {
        searchInput,
        filters: filters
          ? denormalizeFilters(filters, categories, sources)
          : {
              categories,
              sources,
              startDate: undefined,
              endDate: undefined,
            },
      },
    });

    const filtersProp = filters
      ? denormalizeFilters(filters, categories, sources)
      : {
          categories,
          sources,
          startDate: undefined,
          endDate: undefined,
        };

    return {
      takeaways,
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
  const [filters, setFilters] = useState<FilterParams>(filtersProp);

  return (
    <div className="flex h-[calc(100vh-64px)] items-center justify-center overflow-hidden">
      {/* center pane */}
      <div className="flex h-full w-1/2 flex-col items-center justify-center border-r border-gray-200 bg-white p-4">
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
                  search: {
                    searchInput,
                    filters: router.state.location.search.filters,
                  },
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
                search: {
                  searchInput,
                  filters: router.state.location.search.filters,
                },
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
        <div className="min-h-0 flex-1 overflow-y-auto">
          {takeawaySearchResults.length === 0 ? (
            <p className="text-gray-500">No takeaways found.</p>
          ) : (
            <div className="border-t border-gray-200">
              {takeawaySearchResults.map((takeaway) => (
                <TakeawayTile takeaway={takeaway} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
