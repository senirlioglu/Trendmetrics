import { create } from 'zustand'
import type { CanonicalTrend, PlatformGroupId, FilterState, SortOption } from '@/types'
import { api } from '@/services/api'

interface TrendState {
  trends: CanonicalTrend[]
  loading: boolean
  error: string | null
  progress: number
  cached: boolean
  selectedPlatformGroup: PlatformGroupId
  selectedCategory: string
  selectedCountry: string
  selectedLanguage: string
  viewMode: 'grid' | 'list'
  sortBy: SortOption

  discover: (forceRefresh?: boolean) => Promise<void>
  setFilters: (filters: Partial<FilterState>) => void
  setViewMode: (mode: 'grid' | 'list') => void
  setSortBy: (sort: SortOption) => void
  getTrendById: (id: string) => CanonicalTrend | undefined
}

function sortTrends(trends: CanonicalTrend[], sortBy: SortOption): CanonicalTrend[] {
  return [...trends].sort((a, b) => {
    switch (sortBy) {
      case 'momentum':
        return b.momentum_score - a.momentum_score
      case 'confidence':
        return b.confidence_score - a.confidence_score
      case 'freshness':
        return b.freshness_score - a.freshness_score
      case 'commercial':
        return b.commercial_relevance_score - a.commercial_relevance_score
      default:
        return 0
    }
  })
}

export const useTrendStore = create<TrendState>((set, get) => ({
  trends: [],
  loading: false,
  error: null,
  progress: 0,
  cached: false,
  selectedPlatformGroup: 'social-media',
  selectedCategory: 'Technology',
  selectedCountry: 'US',
  selectedLanguage: 'en',
  viewMode: 'grid',
  sortBy: 'momentum',

  discover: async (forceRefresh = false) => {
    const state = get()
    set({ loading: true, error: null, progress: 0 })

    // Simulate progress updates during discovery
    const progressInterval = setInterval(() => {
      set((s) => ({
        progress: Math.min(s.progress + Math.random() * 15, 90),
      }))
    }, 500)

    try {
      const trends = await api.discoverTrends({
        platform_group: state.selectedPlatformGroup,
        category: state.selectedCategory,
        country: state.selectedCountry,
        language: state.selectedLanguage,
        force_refresh: forceRefresh,
      })

      clearInterval(progressInterval)

      const sorted = sortTrends(trends, state.sortBy)
      set({
        trends: sorted,
        loading: false,
        progress: 100,
        cached: !forceRefresh,
        error: null,
      })
    } catch (error) {
      clearInterval(progressInterval)
      const message = error instanceof Error ? error.message : 'Discovery failed'
      set({
        loading: false,
        error: message,
        progress: 0,
      })
    }
  },

  setFilters: (filters: Partial<FilterState>) => {
    const updates: Partial<TrendState> = {}
    if (filters.platformGroup !== undefined) updates.selectedPlatformGroup = filters.platformGroup
    if (filters.category !== undefined) updates.selectedCategory = filters.category
    if (filters.country !== undefined) updates.selectedCountry = filters.country
    if (filters.language !== undefined) updates.selectedLanguage = filters.language
    set(updates)
  },

  setViewMode: (mode: 'grid' | 'list') => {
    set({ viewMode: mode })
  },

  setSortBy: (sort: SortOption) => {
    const state = get()
    const sorted = sortTrends(state.trends, sort)
    set({ sortBy: sort, trends: sorted })
  },

  getTrendById: (id: string) => {
    return get().trends.find((t) => t.id === id)
  },
}))
