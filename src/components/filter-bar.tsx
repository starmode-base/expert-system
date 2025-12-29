import { useRouter } from "@tanstack/react-router";
import React from "react";
import { ListFilter, ChevronDown } from "lucide-react";

export interface FilterParams {
  sources: string[];
  startDate: string | undefined;
  endDate: string | undefined;
}

interface FilterBarProps {
  availableSources: string[];
  filters: FilterParams;
  setFilters: (filters: FilterParams) => void;
  updateURL: boolean;
}

export const normalizeFilterValue = (value: string) => {
  // remove spaces and special characters
  return value.replace(/[^a-zA-Z0-9]+/g, "").toLowerCase();
};

export const FilterBar = (props: FilterBarProps) => {
  const { availableSources, filters, setFilters, updateURL } = props;
  const [isCollapsed, setIsCollapsed] = React.useState(true);

  // Helpers to toggle values

  const router = useRouter();

  const updateURLWithFilters = (nextFilters: FilterParams) => {
    if (!updateURL) return;

    // Preserve the current searchInput, only swap filters
    const existingPath = router.state.location.pathname;
    const searchInput = (
      router.state.location.search as { searchInput?: string }
    ).searchInput;

    void router.navigate({
      to: existingPath,
      search: {
        searchInput,
        filters: {
          ...nextFilters,
          sources: nextFilters.sources.map(normalizeFilterValue),
        },
      },
    });
  };

  const toggleValue = (array: string[], value: string): string[] =>
    array.includes(value)
      ? array.filter((v) => v !== value)
      : [...array, value];

  const handleSourceToggle = (source: string) => {
    const newFilters = {
      ...filters,
      sources: toggleValue(filters.sources, source),
    };
    setFilters(newFilters);
    updateURLWithFilters(newFilters);
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value;
    const newFilters = { ...filters, startDate: date };
    setFilters(newFilters);
    updateURLWithFilters(newFilters);
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value;
    const newFilters = { ...filters, endDate: date };
    setFilters(newFilters);
    updateURLWithFilters(newFilters);
  };

  // const formatDate = (date: Date | null | undefined): string => {
  //   const formattedDate = date ? (date.toISOString().split("T")[0] ?? "") : "";
  //   return formattedDate;
  // };

  return (
    <div className="rounded-lg border border-gray-200 bg-white/90 shadow-sm">
      {/* Header Row */}
      <div
        className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-gray-50"
        onClick={() => {
          setIsCollapsed((prev) => !prev);
        }}
      >
        <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
          <ListFilter size={18} />
          Filters
        </div>
        <ChevronDown
          size={18}
          className={`transition-transform duration-300 ${
            isCollapsed ? "rotate-0" : "rotate-180"
          }`}
        />
      </div>

      {/* Content */}
      <div
        className={`transition-all duration-300 ease-in-out ${
          isCollapsed
            ? "max-h-0 overflow-hidden opacity-0"
            : "max-h-[1000px] opacity-100"
        }`}
      >
        <div className="flex flex-wrap items-start gap-4 bg-white px-3 pt-1 pb-3 sm:gap-6 sm:pt-2">
          {/* Source Filter */}
          <div>
            <label className="mb-1 block text-sm font-semibold">Sources</label>
            <div className="flex max-h-28 flex-col gap-1 overflow-y-auto">
              {availableSources.map((source) => (
                <label key={source} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={filters.sources.includes(source)}
                    onChange={() => {
                      handleSourceToggle(source);
                    }}
                    className="accent-blue-500"
                  />
                  {source}
                </label>
              ))}
            </div>
          </div>

          {/* Date Filters */}
          <div className="flex flex-col">
            <label className="mb-1 text-sm font-semibold">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={handleStartDateChange}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </div>

          <div className="flex flex-col">
            <label className="mb-1 text-sm font-semibold">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={handleEndDateChange}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
