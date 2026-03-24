import { motion } from 'framer-motion';
import {
  Database,
  Wifi,
  LayoutGrid,
  List,
  FileText,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import { useTrendStore } from '@/stores/trendStore';

interface DashboardHeaderProps {
  onToggleMobileFilters?: () => void;
}

export default function DashboardHeader({
  onToggleMobileFilters,
}: DashboardHeaderProps) {
  const {
    viewMode,
    setViewMode,
    cached: isCached,
    loading: isLoading,
    discover,
  } = useTrendStore();

  const forceRefresh = () => discover(true);
  const generateDailyReport = () => {
    // Handled by parent via callback or modal
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-white">Trend Dashboard</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Real-time market intelligence across platforms
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Mobile filter toggle */}
        <button
          onClick={onToggleMobileFilters}
          className="lg:hidden flex items-center gap-1.5 rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
        </button>

        {/* Cache indicator */}
        <div className="flex items-center gap-1.5 rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2">
          {isCached ? (
            <>
              <Database className="h-3.5 w-3.5 text-yellow-400" />
              <span className="text-xs text-yellow-400 font-medium">Cached</span>
            </>
          ) : (
            <>
              <Wifi className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-xs text-emerald-400 font-medium">Live</span>
            </>
          )}
        </div>

        {/* View mode toggle */}
        <div className="flex rounded-lg border border-gray-800 bg-gray-900/50 overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={`flex items-center justify-center p-2 transition-colors ${
              viewMode === 'grid'
                ? 'bg-primary-500/10 text-primary-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center justify-center p-2 transition-colors ${
              viewMode === 'list'
                ? 'bg-primary-500/10 text-primary-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>

        {/* Daily Report */}
        <button
          onClick={generateDailyReport}
          className="flex items-center gap-1.5 rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <FileText className="h-4 w-4" />
          <span className="hidden sm:inline">Daily Report</span>
        </button>

        {/* Force Refresh */}
        <button
          onClick={forceRefresh}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 text-sm font-medium text-white transition-colors"
        >
          <motion.div
            animate={isLoading ? { rotate: 360 } : {}}
            transition={
              isLoading ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}
            }
          >
            <RefreshCw className="h-4 w-4" />
          </motion.div>
          <span className="hidden sm:inline">Refresh</span>
          <span className="text-[10px] text-primary-200 hidden sm:inline">($0.10)</span>
        </button>
      </div>
    </div>
  );
}
