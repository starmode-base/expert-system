import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
  FilterBar,
  FilterParams,
  normalizeFilterValue,
} from "~/components/filter-bar";
import { TakeawayTile } from "~/components/takeaway-tile";
import { useInfiniteScroll } from "~/lib/use-infinite-scroll";
import { getFilterValues } from "~/server/queries";
import { searchTakeawaysSF } from "~/server/searchSFs";

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

    const resolvedFilters = filters
      ? denormalizeFilters(filters, sources)
      : {
          sources,
          startDate: undefined,
          endDate: undefined,
        };

    const page = await searchTakeawaysSF({
      data: {
        searchInput,
        filters: resolvedFilters,
        cursor: null,
        limit: 20,
      },
    });

    return {
      page,
      sources,
      searchInput,
      filtersProp: resolvedFilters,
    };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const {
    page,
    sources,
    searchInput: searchInputProp,
    filtersProp,
  } = Route.useLoaderData();
  const router = useRouter();

  const resetKey = JSON.stringify({
    searchInput: searchInputProp,
    filters: filtersProp,
  });

  const { items, sentinelRef, isLoadingMore } = useInfiniteScroll({
    initialData: page,
    fetchPage: (cursor) =>
      searchTakeawaysSF({
        data: {
          searchInput: searchInputProp,
          filters: filtersProp,
          cursor,
          limit: 20,
        },
      }),
    resetKey,
  });

  const [searchInput, setSearchInput] = useState(searchInputProp);
  const [filters, setFilters] = useState<FilterParams>(filtersProp);

  const handleSearch = () => {
    void router.navigate({
      to: router.state.location.pathname,
      search: {
        searchInput,
        filters: {
          ...filters,
          sources: filters.sources.map(normalizeFilterValue),
        },
      },
    });
  };

  return (
    <div className="h-[calc(100dvh-64px)] overflow-hidden">
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
          {items.length === 0 ? (
            <p className="py-4 text-center text-gray-500">
              No takeaways found.
            </p>
          ) : (
            <div className="border-t border-gray-200">
              {items.map((takeaway) => (
                <TakeawayTile key={takeaway.id} takeaway={takeaway} />
              ))}
              <div ref={sentinelRef} className="py-4 text-center">
                {isLoadingMore ? (
                  <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
