import {
  Youtube,
  Facebook,
  Twitch,
  ShoppingBag,
  ShoppingCart,
  Store,
  Tag,
  Smartphone,
  PlayCircle,
  Plane,
  MapPin,
  Building2,
  Hotel,
  Search,
  Globe,
  Share2,
  Package,
  AppWindow,
  Navigation,
  type LucideIcon,
} from 'lucide-react'
import type { PlatformId, PlatformGroupId, PlatformGroupUiConfig } from '@/types'
import { PLATFORM_CONFIGS, CATEGORIES, COUNTRIES } from '@/types'

// ---------------------------------------------------------------------------
// Platform icon mapping
// ---------------------------------------------------------------------------

const platformIconMap: Record<PlatformId, LucideIcon> = {
  youtube: Youtube,
  tiktok: PlayCircle,
  instagram: Share2,
  facebook: Facebook,
  'x-twitter': Globe,
  twitch: Twitch,
  amazon: ShoppingCart,
  trendyol: ShoppingBag,
  hepsiburada: Store,
  sahibinden: Tag,
  'app-store': Smartphone,
  'google-play': AppWindow,
  airbnb: Hotel,
  tripadvisor: MapPin,
  booking: Building2,
  'google-business': Navigation,
  'google-search': Search,
  yandex: Globe,
}

// ---------------------------------------------------------------------------
// Platform group configuration
// ---------------------------------------------------------------------------

const platformGroupConfigs: Record<PlatformGroupId, PlatformGroupUiConfig> = {
  'social-media': {
    id: 'social-media',
    name: 'Social Media',
    description: 'YouTube, TikTok, Instagram, Facebook, X, Twitch',
    icon: 'share2',
    color: '#6366f1',
    platforms: ['youtube', 'tiktok', 'instagram', 'facebook', 'x-twitter', 'twitch'],
  },
  'e-commerce': {
    id: 'e-commerce',
    name: 'E-Commerce',
    description: 'Amazon, Trendyol, Hepsiburada, Sahibinden',
    icon: 'shoppingCart',
    color: '#f59e0b',
    platforms: ['amazon', 'trendyol', 'hepsiburada', 'sahibinden'],
  },
  'app-stores': {
    id: 'app-stores',
    name: 'App Stores',
    description: 'App Store, Google Play',
    icon: 'smartphone',
    color: '#10b981',
    platforms: ['app-store', 'google-play'],
  },
  'travel-local': {
    id: 'travel-local',
    name: 'Travel & Local',
    description: 'Airbnb, Tripadvisor, Booking.com, Google Business',
    icon: 'plane',
    color: '#ec4899',
    platforms: ['airbnb', 'tripadvisor', 'booking', 'google-business'],
  },
  'search-engines': {
    id: 'search-engines',
    name: 'Search Engines',
    description: 'Google Search, Yandex',
    icon: 'search',
    color: '#3b82f6',
    platforms: ['google-search', 'yandex'],
  },
}

const platformGroupIconMap: Record<PlatformGroupId, LucideIcon> = {
  'social-media': Share2,
  'e-commerce': ShoppingCart,
  'app-stores': Smartphone,
  'travel-local': Plane,
  'search-engines': Search,
}

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function getPlatformConfig(id: PlatformId) {
  return PLATFORM_CONFIGS[id]
}

export function getPlatformGroupConfig(id: PlatformGroupId): PlatformGroupUiConfig {
  return platformGroupConfigs[id]
}

export function getPlatformIcon(id: PlatformId): LucideIcon {
  return platformIconMap[id] ?? Package
}

export function getPlatformGroupIcon(id: PlatformGroupId): LucideIcon {
  return platformGroupIconMap[id] ?? Globe
}

// ---------------------------------------------------------------------------
// Exports: lists for dropdowns
// ---------------------------------------------------------------------------

export const platformGroups = Object.values(platformGroupConfigs)
export const categories = CATEGORIES
export const countries = COUNTRIES

export const languages = [
  { code: 'en', name: 'English' },
  { code: 'tr', name: 'Turkish' },
  { code: 'de', name: 'German' },
  { code: 'fr', name: 'French' },
  { code: 'es', name: 'Spanish' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'nl', name: 'Dutch' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ru', name: 'Russian' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'zh', name: 'Chinese' },
  { code: 'sv', name: 'Swedish' },
  { code: 'pl', name: 'Polish' },
]

export function getCountryName(code: string): string {
  const names: Record<string, string> = {
    US: 'United States',
    GB: 'United Kingdom',
    TR: 'Turkey',
    DE: 'Germany',
    FR: 'France',
    ES: 'Spain',
    IT: 'Italy',
    NL: 'Netherlands',
    BR: 'Brazil',
    IN: 'India',
    JP: 'Japan',
    KR: 'South Korea',
    AU: 'Australia',
    CA: 'Canada',
    MX: 'Mexico',
    RU: 'Russia',
    SA: 'Saudi Arabia',
    AE: 'UAE',
    PL: 'Poland',
    SE: 'Sweden',
  }
  return names[code] ?? code
}
