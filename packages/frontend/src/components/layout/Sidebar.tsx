import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Globe, Tag, Layers } from 'lucide-react';
import {
  PLATFORM_CONFIGS,
  CATEGORIES,
  COUNTRIES,
  type PlatformGroupId,
  type PlatformConfig,
} from '@/types';
import { useTrendStore } from '@/stores/trendStore';

const PLATFORM_GROUPS: {
  id: PlatformGroupId;
  label: string;
  platforms: PlatformConfig[];
}[] = [
  {
    id: 'social-media',
    label: 'Social Media',
    platforms: Object.values(PLATFORM_CONFIGS).filter(
      (p) => p.group === 'social-media'
    ),
  },
  {
    id: 'e-commerce',
    label: 'E-Commerce',
    platforms: Object.values(PLATFORM_CONFIGS).filter(
      (p) => p.group === 'e-commerce'
    ),
  },
  {
    id: 'app-stores',
    label: 'App Stores',
    platforms: Object.values(PLATFORM_CONFIGS).filter(
      (p) => p.group === 'app-stores'
    ),
  },
  {
    id: 'travel-local',
    label: 'Travel & Local',
    platforms: Object.values(PLATFORM_CONFIGS).filter(
      (p) => p.group === 'travel-local'
    ),
  },
  {
    id: 'search-engines',
    label: 'Search Engines',
    platforms: Object.values(PLATFORM_CONFIGS).filter(
      (p) => p.group === 'search-engines'
    ),
  },
];

const COUNTRY_FLAGS: Record<string, string> = {
  US: '🇺🇸',
  GB: '🇬🇧',
  TR: '🇹🇷',
  DE: '🇩🇪',
  FR: '🇫🇷',
  ES: '🇪🇸',
  IT: '🇮🇹',
  NL: '🇳🇱',
  BR: '🇧🇷',
  IN: '🇮🇳',
  JP: '🇯🇵',
  KR: '🇰🇷',
  AU: '🇦🇺',
  CA: '🇨🇦',
  MX: '🇲🇽',
  RU: '🇷🇺',
  SA: '🇸🇦',
  AE: '🇦🇪',
  PL: '🇵🇱',
  SE: '🇸🇪',
};

function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl bg-gray-900/50 border border-gray-800">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800/50 rounded-xl transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary-400" />
          {title}
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </motion.div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Sidebar() {
  const {
    selectedPlatformGroup,
    selectedCategory,
    selectedCountry,
    setFilters,
  } = useTrendStore();

  const setSelectedPlatformGroup = (id: PlatformGroupId) =>
    setFilters({ platformGroup: id });
  const setSelectedCategory = (cat: string) => setFilters({ category: cat });
  const setSelectedCountry = (code: string) => setFilters({ country: code });

  const [expandedGroups, setExpandedGroups] = useState<Set<PlatformGroupId>>(new Set());

  const toggleGroupExpand = (groupId: PlatformGroupId) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  return (
    <aside className="w-full space-y-4">
      {/* Platform Groups */}
      <CollapsibleSection title="Platforms" icon={Layers}>
        <div className="space-y-1">
          {PLATFORM_GROUPS.map((group) => {
            const isSelected = selectedPlatformGroup === group.id;
            const isExpanded = expandedGroups.has(group.id);

            return (
              <div key={group.id}>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSelectedPlatformGroup(group.id)}
                    className={`flex-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left ${
                      isSelected
                        ? 'bg-primary-500/10 text-primary-400 border border-primary-500/30'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    {group.label}
                  </button>
                  <button
                    onClick={() => toggleGroupExpand(group.id)}
                    className="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
                  >
                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </motion.div>
                  </button>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div className="ml-4 mt-1 space-y-0.5">
                        {group.platforms.map((platform: PlatformConfig) => (
                          <div
                            key={platform.id}
                            className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-gray-500"
                          >
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: platform.color }}
                            />
                            <span>{platform.name}</span>
                            <span
                              className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full ${
                                platform.capabilities.reliability_tier === 'high'
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : platform.capabilities.reliability_tier === 'medium'
                                    ? 'bg-yellow-500/10 text-yellow-400'
                                    : 'bg-red-500/10 text-red-400'
                              }`}
                            >
                              {platform.capabilities.reliability_tier}
                            </span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </CollapsibleSection>

      {/* Categories */}
      <CollapsibleSection title="Category" icon={Tag}>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </CollapsibleSection>

      {/* Countries */}
      <CollapsibleSection title="Country / Region" icon={Globe}>
        <div className="grid grid-cols-2 gap-1">
          {COUNTRIES.map((code) => {
            const isSelected = selectedCountry === code;
            return (
              <button
                key={code}
                onClick={() => setSelectedCountry(code)}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  isSelected
                    ? 'bg-primary-500/10 text-primary-400 border border-primary-500/30'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <span className="text-base">{COUNTRY_FLAGS[code] ?? '🏳️'}</span>
                <span className="text-xs font-medium">{code}</span>
              </button>
            );
          })}
        </div>
      </CollapsibleSection>
    </aside>
  );
}
