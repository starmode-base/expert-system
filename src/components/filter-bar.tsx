import { useRouter } from "@tanstack/react-router";
import React from "react";
import { ListFilter, ChevronDown } from "lucide-react";

export interface FilterParams {
  sources: string[];
  categories: string[];
  startDate: Date | undefined;
  endDate: Date | undefined;
}

interface FilterBarProps {
  availableSources: string[];
  availableCategories: string[];
  filters: FilterParams;
  setFilters: (filters: FilterParams) => void;
  updateURL: boolean;
}

export const normalizeFilterValue = (value: string) => {
  // remove spaces and special characters
  return value.replace(/[^a-zA-Z0-9]+/g, "").toLowerCase();
};

export const FilterBar = ({
  availableSources,
  availableCategories,
  filters,
  setFilters,
  updateURL,
}: FilterBarProps) => {
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
          categories: nextFilters.categories.map(normalizeFilterValue),
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

  const handleCategoryToggle = (category: string) => {
    const newFilters = {
      ...filters,
      categories: toggleValue(filters.categories, category),
    };
    setFilters(newFilters);
    updateURLWithFilters(newFilters);
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value ? new Date(e.target.value) : undefined;
    const newFilters = { ...filters, startDate: date };
    setFilters(newFilters);
    updateURLWithFilters(newFilters);
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value ? new Date(e.target.value) : undefined;
    const newFilters = { ...filters, endDate: date };
    setFilters(newFilters);
    updateURLWithFilters(newFilters);
  };

  const formatDate = (date: Date | null | undefined): string =>
    date ? (date.toISOString().split("T")[0] ?? "") : "";

  return (
    <div className="mb-4 rounded-md border border-gray-200 bg-white">
      {/* Header Row */}
      <div
        className="flex cursor-pointer items-center justify-between border-b px-4 py-2 hover:bg-gray-50"
        onClick={() => {
          setIsCollapsed((prev) => !prev);
        }}
      >
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
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
        <div className="flex flex-wrap items-start gap-6 bg-gray-50 px-4 py-3">
          {/* Source Filter */}
          <div>
            <label className="mb-1 block text-sm font-semibold">Sources</label>
            <div className="flex max-h-36 flex-col gap-1 overflow-y-auto">
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

          {/* Category Filter */}
          <div>
            <label className="mb-1 block text-sm font-semibold">
              Categories
            </label>
            <div className="flex max-h-36 flex-col gap-1 overflow-y-auto">
              {availableCategories.map((category) => (
                <label
                  key={category}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={filters.categories.includes(category)}
                    onChange={() => {
                      handleCategoryToggle(category);
                    }}
                    className="accent-green-500"
                  />
                  {category}
                </label>
              ))}
            </div>
          </div>

          {/* Date Filters */}
          <div className="flex flex-col">
            <label className="mb-1 text-sm font-semibold">Start Date</label>
            <input
              type="date"
              value={formatDate(filters.startDate)}
              onChange={handleStartDateChange}
              className="rounded border border-gray-300 p-1"
            />
          </div>

          <div className="flex flex-col">
            <label className="mb-1 text-sm font-semibold">End Date</label>
            <input
              type="date"
              value={formatDate(filters.endDate)}
              onChange={handleEndDateChange}
              className="rounded border border-gray-300 p-1"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
