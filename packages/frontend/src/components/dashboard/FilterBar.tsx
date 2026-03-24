import { CATEGORIES, COUNTRIES } from '@/types';
import type { PlatformGroupId } from '@/types';
import { useTrendStore } from '@/stores/trendStore';

const PLATFORM_GROUP_OPTIONS: { id: PlatformGroupId; label: string }[] = [
  { id: 'social-media', label: 'Social' },
  { id: 'e-commerce', label: 'E-Commerce' },
  { id: 'app-stores', label: 'Apps' },
  { id: 'travel-local', label: 'Travel' },
  { id: 'search-engines', label: 'Search' },
];

const SORT_OPTIONS = [
  { value: 'momentum', label: 'Momentum' },
  { value: 'confidence', label: 'Confidence' },
  { value: 'freshness', label: 'Freshness' },
  { value: 'commercial', label: 'Commercial' },
] as const;

export default function FilterBar() {
  const {
    selectedPlatformGroup,
    selectedCategory,
    selectedCountry,
    sortBy,
    setFilters,
    setSortBy,
  } = useTrendStore();

  const setSelectedPlatformGroup = (id: PlatformGroupId) =>
    setFilters({ platformGroup: id });
  const setSelectedCategory = (cat: string) => setFilters({ category: cat });
  const setSelectedCountry = (code: string) => setFilters({ country: code });

  return (
    <div className="space-y-3">
      {/* Platform groups */}
      <div className="flex flex-wrap gap-1.5">
        {PLATFORM_GROUP_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setSelectedPlatformGroup(opt.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              selectedPlatformGroup === opt.id
                ? 'bg-primary-500 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Category + Country + Sort row */}
      <div className="flex flex-wrap gap-2">
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-primary-500"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <select
          value={selectedCountry}
          onChange={(e) => setSelectedCountry(e.target.value)}
          className="rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-primary-500"
        >
          <option value="">All Countries</option>
          {COUNTRIES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-primary-500"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              Sort: {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
