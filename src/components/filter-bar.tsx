import React from "react";

export interface FilterParams {
  sources: string[];
  categories: string[];
  startDate: Date | null;
  endDate: Date | null;
}

interface FilterBarProps {
  availableSources: string[];
  availableCategories: string[];
  filters: FilterParams;
  setFilters: (filters: FilterParams) => void;
}

export const FilterBar = ({
  availableSources,
  availableCategories,
  filters,
  setFilters,
}: FilterBarProps) => {
  // Helpers to toggle values
  const toggleValue = (array: string[], value: string): string[] =>
    array.includes(value)
      ? array.filter((v) => v !== value)
      : [...array, value];

  const handleSourceToggle = (source: string) => {
    setFilters({
      ...filters,
      sources: toggleValue(filters.sources, source),
    });
  };

  const handleCategoryToggle = (category: string) => {
    setFilters({
      ...filters,
      categories: toggleValue(filters.categories, category),
    });
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value ? new Date(e.target.value) : null;
    setFilters({ ...filters, startDate: date });
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value ? new Date(e.target.value) : null;
    setFilters({ ...filters, endDate: date });
  };

  const formatDate = (date: Date | null): string =>
    date ? (date.toISOString().split("T")[0] ?? "") : "";

  return (
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
        <label className="mb-1 block text-sm font-semibold">Categories</label>
        <div className="flex max-h-36 flex-col gap-1 overflow-y-auto">
          {availableCategories.map((category) => (
            <label key={category} className="flex items-center gap-2 text-sm">
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

      {/* Date Range */}
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
  );
};
