import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  MessageSquare,
  ShoppingCart,
  Music,
  Newspaper,
  Gamepad2,
  X,
  SlidersHorizontal,
  Inbox,
} from 'lucide-react';
import { useTrendStore } from '@/stores/trendStore';
import type { CanonicalTrend, PlatformGroupId } from '@/types';
import DashboardHeader from '../components/dashboard/DashboardHeader';
import FilterBar from '../components/dashboard/FilterBar';
import Sidebar from '../components/layout/Sidebar';
import TrendCard from '../components/trend/TrendCard';
import TrendDetail from '../components/trend/TrendDetail';
import DeepAnalysisModal from '../components/report/DeepAnalysisModal';
import DailyReportModal from '../components/report/DailyReportModal';
import ProgressBar from '../components/common/ProgressBar';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import EmptyState from '../components/common/EmptyState';

const platformGroupMeta: Record<
  string,
  { label: string; icon: React.ElementType; color: string }
> = {
  search_web: { label: 'Search & Web', icon: Search, color: 'text-blue-400' },
  social_media: {
    label: 'Social Media',
    icon: MessageSquare,
    color: 'text-pink-400',
  },
  ecommerce: {
    label: 'E-Commerce',
    icon: ShoppingCart,
    color: 'text-amber-400',
  },
  entertainment: {
    label: 'Entertainment',
    icon: Music,
    color: 'text-purple-400',
  },
  news_publishing: {
    label: 'News & Publishing',
    icon: Newspaper,
    color: 'text-emerald-400',
  },
  gaming_tech: {
    label: 'Gaming & Tech',
    icon: Gamepad2,
    color: 'text-red-400',
  },
};

export default function Dashboard() {
  const {
    trends,
    loading,
    error,
    progress,
    selectedPlatformGroup,
    viewMode,
    discover,
  } = useTrendStore();

  const [selectedTrend, setSelectedTrend] = useState<CanonicalTrend | null>(null);
  const [deepAnalysisTrend, setDeepAnalysisTrend] = useState<CanonicalTrend | null>(
    null,
  );
  const [showDailyReport, setShowDailyReport] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const platformMeta = platformGroupMeta[selectedPlatformGroup] ?? {
    label: 'All Platforms',
    icon: Search,
    color: 'text-indigo-400',
  };
  const PlatformIcon = platformMeta.icon;

  const handleRetry = useCallback(() => {
    discover();
  }, [discover]);

  const handleDeepAnalysis = useCallback((trend: CanonicalTrend) => {
    setDeepAnalysisTrend(trend);
  }, []);

  // Close mobile filters on desktop resize
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = () => {
      if (mq.matches) setMobileFiltersOpen(false);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <DashboardHeader
        onToggleMobileFilters={() => setMobileFiltersOpen((v) => !v)}
      />

      {/* Progress bar */}
      <AnimatePresence>
        {loading && progress > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-4 lg:px-8 pt-2"
          >
            <ProgressBar progress={progress} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-72 shrink-0 border-r border-gray-800/50 min-h-[calc(100vh-4rem)] sticky top-16">
          <Sidebar />
        </aside>

        {/* Mobile filter button */}
        <button
          className="lg:hidden fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/25 flex items-center justify-center transition-colors cursor-pointer"
          onClick={() => setMobileFiltersOpen(true)}
        >
          <SlidersHorizontal className="w-5 h-5" />
        </button>

        {/* Mobile filter sheet */}
        <AnimatePresence>
          {mobileFiltersOpen && (
            <>
              <motion.div
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileFiltersOpen(false)}
              />
              <motion.div
                className="fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] bg-gray-950 border-r border-gray-800/50 lg:hidden overflow-y-auto"
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/50">
                  <span className="font-semibold text-sm">Filters</span>
                  <button
                    onClick={() => setMobileFiltersOpen(false)}
                    className="p-1 rounded-lg hover:bg-gray-800/50 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <Sidebar />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Main content */}
        <main className="flex-1 min-w-0 px-4 lg:px-8 py-6">
          {/* Filter bar */}
          <FilterBar />

          {/* Platform indicator */}
          <motion.div
            className="flex items-center gap-2 mb-6"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            key={selectedPlatformGroup}
          >
            <PlatformIcon className={`w-5 h-5 ${platformMeta.color}`} />
            <h2 className="text-lg font-semibold">{platformMeta.label}</h2>
            {trends.length > 0 && !loading && (
              <span className="text-sm text-gray-500">
                ({trends.length} trend{trends.length !== 1 ? 's' : ''})
              </span>
            )}
          </motion.div>

          {/* Content states */}
          {loading && trends.length === 0 ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={handleRetry} />
          ) : trends.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No trends found"
              description="Try changing your filters or discover new trends."
            />
          ) : (
            <motion.div
              className={
                viewMode === 'grid'
                  ? 'grid sm:grid-cols-2 xl:grid-cols-3 gap-4'
                  : 'flex flex-col gap-3'
              }
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {trends.map((trend: CanonicalTrend, i: number) => (
                <motion.div
                  key={trend.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.3 }}
                >
                  <TrendCard
                    trend={trend}
                    viewMode={viewMode}

                    onDeepAnalysis={() => handleDeepAnalysis(trend)}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </main>
      </div>

      {/* Trend Detail Drawer */}
      <AnimatePresence>
        {selectedTrend && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTrend(null)}
            />
            <motion.div
              className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-gray-950 border-l border-gray-800/50 overflow-y-auto"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800/50 sticky top-0 bg-gray-950/90 backdrop-blur-xl z-10">
                <h3 className="font-semibold truncate pr-4">Trend Details</h3>
                <button
                  onClick={() => setSelectedTrend(null)}
                  className="p-1.5 rounded-lg hover:bg-gray-800/50 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <TrendDetail
                trend={selectedTrend}
                onClose={() => setSelectedTrend(null)}
                onDeepAnalysis={() => {
                  setDeepAnalysisTrend(selectedTrend);
                  setSelectedTrend(null);
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Deep Analysis Modal */}
      <AnimatePresence>
        {deepAnalysisTrend && (
          <DeepAnalysisModal
            trend={deepAnalysisTrend}
            isOpen={true}
            onClose={() => setDeepAnalysisTrend(null)}
          />
        )}
      </AnimatePresence>

      {/* Daily Report Modal */}
      <AnimatePresence>
        {showDailyReport && (
          <DailyReportModal
            platformGroup={selectedPlatformGroup as PlatformGroupId}
            trends={trends}
            isOpen={true}
            onClose={() => setShowDailyReport(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
