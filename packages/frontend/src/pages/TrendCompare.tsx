import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  GitCompareArrows,
  ChevronDown,
  Trophy,
  Minus,
  TrendingUp,
  ShieldCheck,
  Flame,
  BarChart3,
  Zap,
} from 'lucide-react';
import { useTrendStore } from '@/stores/trendStore';
import type { CanonicalTrend } from '@/types';

interface MetricConfig {
  key: keyof CanonicalTrend;
  label: string;
  icon: React.ElementType;
  color: string;
  max: number;
}

const metrics: MetricConfig[] = [
  { key: 'confidence_score', label: 'Overall Score', icon: TrendingUp, color: 'indigo', max: 100 },
  { key: 'cross_platform_score', label: 'Verification', icon: ShieldCheck, color: 'emerald', max: 100 },
  { key: 'momentum_score', label: 'Momentum', icon: Flame, color: 'orange', max: 100 },
  { key: 'commercial_relevance_score', label: 'Relevance', icon: BarChart3, color: 'blue', max: 100 },
  { key: 'freshness_score', label: 'Freshness', icon: Zap, color: 'amber', max: 100 },
];

function getMetricValue(trend: CanonicalTrend | null, key: keyof CanonicalTrend): number {
  if (!trend) return 0;
  const val = trend[key];
  return typeof val === 'number' ? val : 0;
}

const colorClasses: Record<string, { bar: string; text: string; bg: string }> = {
  indigo: { bar: 'bg-indigo-500', text: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  emerald: { bar: 'bg-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  orange: { bar: 'bg-orange-500', text: 'text-orange-400', bg: 'bg-orange-500/10' },
  blue: { bar: 'bg-blue-500', text: 'text-blue-400', bg: 'bg-blue-500/10' },
  purple: { bar: 'bg-purple-500', text: 'text-purple-400', bg: 'bg-purple-500/10' },
  amber: { bar: 'bg-amber-500', text: 'text-amber-400', bg: 'bg-amber-500/10' },
};

function TrendSelector({
  label,
  selected,
  trends,
  onSelect,
}: {
  label: string;
  selected: CanonicalTrend | null;
  trends: CanonicalTrend[];
  onSelect: (trend: CanonicalTrend) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">
        {label}
      </p>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-gray-900/50 border border-gray-800/50 hover:border-gray-700/50 transition-colors text-left cursor-pointer"
      >
        <span className={`text-sm truncate ${selected ? 'text-white' : 'text-gray-500'}`}>
          {selected ? selected.canonical_title : 'Select a trend...'}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute top-full left-0 right-0 mt-2 z-20 bg-gray-900 border border-gray-800/50 rounded-xl shadow-xl max-h-64 overflow-y-auto"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {trends.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500">
                No trends available. Discover trends from the dashboard first.
              </div>
            ) : (
              trends.map((trend) => (
                <button
                  key={trend.id}
                  onClick={() => {
                    onSelect(trend);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-800/50 transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                    selected?.id === trend.id
                      ? 'bg-indigo-500/10 text-indigo-400'
                      : 'text-gray-300'
                  }`}
                >
                  <span className="truncate">{trend.canonical_title}</span>
                  <span className="text-xs text-gray-500 shrink-0">
                    {trend.confidence_score}/100
                  </span>
                </button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function TrendCompare() {
  const navigate = useNavigate();
  const { trends } = useTrendStore();
  const [trendA, setTrendA] = useState<CanonicalTrend | null>(null);
  const [trendB, setTrendB] = useState<CanonicalTrend | null>(null);

  const bothSelected = trendA && trendB;

  const summary = useMemo(() => {
    if (!trendA || !trendB) return null;

    let aWins = 0;
    let bWins = 0;
    let ties = 0;

    metrics.forEach((metric) => {
      const a = getMetricValue(trendA, metric.key);
      const b = getMetricValue(trendB, metric.key);
      if (a > b) aWins++;
      else if (b > a) bWins++;
      else ties++;
    });

    const winner =
      aWins > bWins ? 'A' : bWins > aWins ? 'B' : 'tie';

    return { aWins, bWins, ties, winner };
  }, [trendA, trendB]);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800/50 bg-gray-950/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-gray-800/50 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <GitCompareArrows className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="font-semibold text-sm">Compare Trends</h1>
              <p className="text-xs text-gray-500">
                Side-by-side trend analysis
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Selectors */}
        <motion.div
          className="grid sm:grid-cols-2 gap-6 mb-8"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <TrendSelector
            label="Trend A"
            selected={trendA}
            trends={trends.filter((t: CanonicalTrend) => t.id !== trendB?.id)}
            onSelect={setTrendA}
          />
          <TrendSelector
            label="Trend B"
            selected={trendB}
            trends={trends.filter((t: CanonicalTrend) => t.id !== trendA?.id)}
            onSelect={setTrendB}
          />
        </motion.div>

        {/* Comparison */}
        <AnimatePresence mode="wait">
          {bothSelected ? (
            <motion.div
              key="comparison"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4 }}
            >
              {/* Metric bars */}
              <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl overflow-hidden">
                {/* Column headers */}
                <div className="grid grid-cols-[1fr_auto_1fr] gap-4 px-6 py-4 border-b border-gray-800/50 text-sm font-medium">
                  <span className="truncate text-indigo-400">{trendA!.canonical_title}</span>
                  <span className="text-gray-600 text-xs">VS</span>
                  <span className="truncate text-right text-emerald-400">
                    {trendB!.canonical_title}
                  </span>
                </div>

                {/* Metrics */}
                <div className="divide-y divide-gray-800/30">
                  {metrics.map((metric, i) => {
                    const valA = getMetricValue(trendA, metric.key);
                    const valB = getMetricValue(trendB, metric.key);
                    const winner =
                      valA > valB ? 'A' : valB > valA ? 'B' : 'tie';
                    const colors = colorClasses[metric.color];
                    const MetricIcon = metric.icon;

                    return (
                      <motion.div
                        key={metric.key as string}
                        className="px-6 py-5"
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06, duration: 0.3 }}
                      >
                        {/* Label */}
                        <div className="flex items-center justify-center gap-2 mb-3">
                          <MetricIcon className={`w-4 h-4 ${colors.text}`} />
                          <span className="text-sm font-medium text-gray-300">
                            {metric.label}
                          </span>
                        </div>

                        {/* Bars */}
                        <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                          {/* Trend A bar (right-aligned) */}
                          <div className="flex items-center gap-3">
                            <span
                              className={`text-sm font-semibold w-8 ${
                                winner === 'A'
                                  ? colors.text
                                  : 'text-gray-400'
                              }`}
                            >
                              {valA}
                            </span>
                            <div className="flex-1 h-3 rounded-full bg-gray-800/50 overflow-hidden">
                              <motion.div
                                className={`h-full rounded-full ${colors.bar} ${
                                  winner !== 'A' ? 'opacity-40' : ''
                                }`}
                                initial={{ width: 0 }}
                                animate={{
                                  width: `${(valA / metric.max) * 100}%`,
                                }}
                                transition={{
                                  delay: i * 0.06 + 0.2,
                                  duration: 0.5,
                                  ease: 'easeOut',
                                }}
                              />
                            </div>
                          </div>

                          {/* Winner indicator */}
                          <div className="w-8 flex justify-center">
                            {winner === 'A' && (
                              <Trophy className="w-4 h-4 text-amber-400" />
                            )}
                            {winner === 'B' && (
                              <Trophy className="w-4 h-4 text-amber-400" />
                            )}
                            {winner === 'tie' && (
                              <Minus className="w-4 h-4 text-gray-600" />
                            )}
                          </div>

                          {/* Trend B bar */}
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-3 rounded-full bg-gray-800/50 overflow-hidden">
                              <motion.div
                                className={`h-full rounded-full ${colors.bar} ${
                                  winner !== 'B' ? 'opacity-40' : ''
                                }`}
                                initial={{ width: 0 }}
                                animate={{
                                  width: `${(valB / metric.max) * 100}%`,
                                }}
                                transition={{
                                  delay: i * 0.06 + 0.2,
                                  duration: 0.5,
                                  ease: 'easeOut',
                                }}
                              />
                            </div>
                            <span
                              className={`text-sm font-semibold w-8 text-right ${
                                winner === 'B'
                                  ? colors.text
                                  : 'text-gray-400'
                              }`}
                            >
                              {valB}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Summary */}
              {summary && (
                <motion.div
                  className="mt-6 bg-gray-900/50 border border-gray-800/50 rounded-2xl p-6"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.4 }}
                >
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                    Comparison Summary
                  </h3>

                  <div className="grid sm:grid-cols-3 gap-4 mb-6">
                    <div
                      className={`rounded-xl p-4 text-center ${
                        summary.winner === 'A'
                          ? 'bg-indigo-500/10 border border-indigo-500/20'
                          : 'bg-gray-800/30 border border-gray-800/50'
                      }`}
                    >
                      <p className="text-2xl font-bold text-indigo-400">
                        {summary.aWins}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {trendA!.canonical_title}
                      </p>
                    </div>
                    <div className="rounded-xl bg-gray-800/30 border border-gray-800/50 p-4 text-center">
                      <p className="text-2xl font-bold text-gray-500">
                        {summary.ties}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Ties</p>
                    </div>
                    <div
                      className={`rounded-xl p-4 text-center ${
                        summary.winner === 'B'
                          ? 'bg-emerald-500/10 border border-emerald-500/20'
                          : 'bg-gray-800/30 border border-gray-800/50'
                      }`}
                    >
                      <p className="text-2xl font-bold text-emerald-400">
                        {summary.bWins}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {trendB!.canonical_title}
                      </p>
                    </div>
                  </div>

                  {/* Winner declaration */}
                  <div className="text-center">
                    {summary.winner === 'tie' ? (
                      <p className="text-sm text-gray-400">
                        Both trends are equally matched across all metrics.
                      </p>
                    ) : (
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20">
                        <Trophy className="w-4 h-4 text-amber-400" />
                        <span className="text-sm font-medium text-amber-400">
                          {summary.winner === 'A'
                            ? trendA!.canonical_title
                            : trendB!.canonical_title}{' '}
                          wins {Math.max(summary.aWins, summary.bWins)} of{' '}
                          {metrics.length} metrics
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              className="bg-gray-900/50 border border-gray-800/50 rounded-2xl p-12 text-center"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <GitCompareArrows className="w-12 h-12 text-gray-700 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-400 mb-2">
                Select two trends to compare
              </h3>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                Choose from your recently discovered trends to see a
                side-by-side comparison of their scores and metrics.
              </p>
              {trends.length === 0 && (
                <button
                  onClick={() => navigate('/dashboard')}
                  className="mt-6 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition-colors cursor-pointer"
                >
                  Discover Trends First
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
