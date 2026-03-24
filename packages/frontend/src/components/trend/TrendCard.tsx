import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  ExternalLink,
  Search,
  Zap,
  Globe,
} from 'lucide-react';
import type { CanonicalTrend } from '@/types';
import { PLATFORM_CONFIGS } from '@/types';
import VerificationBadge from '@/components/common/VerificationBadge';
import ScoreBadge from '@/components/common/ScoreBadge';

interface TrendCardProps {
  trend: CanonicalTrend;
  onDeepAnalysis: (trend: CanonicalTrend) => void;
  viewMode: 'grid' | 'list';
  index?: number;
}

const FALLBACK_IMAGE = 'https://picsum.photos/seed/trend/400/240';

export default function TrendCard({
  trend,
  onDeepAnalysis,
  viewMode,
  index = 0,
}: TrendCardProps) {
  const [imgError, setImgError] = useState(false);

  const growthColor =
    trend.momentum_score >= 70
      ? 'text-emerald-400 bg-emerald-500/10'
      : trend.momentum_score >= 40
        ? 'text-yellow-400 bg-yellow-500/10'
        : 'text-red-400 bg-red-500/10';

  if (viewMode === 'list') {
    return (
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.03, duration: 0.3 }}
        className="flex items-center gap-4 rounded-xl bg-gray-900/50 border border-gray-800 p-3 hover:border-gray-700 transition-colors"
      >
        {/* Rank */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-500/10 text-primary-400 text-sm font-bold">
          #{index + 1}
        </div>

        {/* Thumbnail */}
        <img
          src={imgError ? FALLBACK_IMAGE : trend.thumbnail_url || FALLBACK_IMAGE}
          alt=""
          onError={() => setImgError(true)}
          className="h-10 w-10 shrink-0 rounded-lg object-cover"
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white truncate">
              {trend.canonical_title}
            </h3>
            <VerificationBadge status={trend.verification_status} />
          </div>
          <p className="text-xs text-gray-500 truncate mt-0.5">{trend.summary}</p>
        </div>

        {/* Scores */}
        <div className="hidden md:flex items-center gap-4 shrink-0">
          <div className="w-28">
            <ScoreBadge score={trend.momentum_score} label="Momentum" size="sm" />
          </div>
          <div className="w-28">
            <ScoreBadge score={trend.confidence_score} label="Confidence" size="sm" />
          </div>
        </div>

        {/* Platforms */}
        <div className="hidden lg:flex items-center gap-1 shrink-0">
          {trend.source_platforms.slice(0, 3).map((pid) => {
            const cfg = PLATFORM_CONFIGS[pid];
            return (
              <span
                key={pid}
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: cfg?.color ?? '#6366f1' }}
                title={cfg?.name ?? pid}
              />
            );
          })}
          {trend.source_platforms.length > 3 && (
            <span className="text-[10px] text-gray-600">
              +{trend.source_platforms.length - 3}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <a
            href={trend.sources[0]?.url ?? trend.search_fallback_url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button
            onClick={() => onDeepAnalysis(trend)}
            className="flex items-center gap-1 rounded-md bg-primary-500/10 hover:bg-primary-500/20 px-2.5 py-1 text-[11px] font-medium text-primary-400 transition-colors"
          >
            <Zap className="h-3 w-3" />
            Analyze
          </button>
        </div>
      </motion.div>
    );
  }

  // Grid mode
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35 }}
      className="group flex flex-col rounded-xl bg-gray-900/50 border border-gray-800 overflow-hidden hover:border-gray-700 transition-colors"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gray-800 overflow-hidden">
        <img
          src={imgError ? FALLBACK_IMAGE : trend.thumbnail_url || FALLBACK_IMAGE}
          alt=""
          onError={() => setImgError(true)}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />

        {/* Rank badge */}
        <div className="absolute top-2 left-2 flex h-7 w-7 items-center justify-center rounded-lg bg-gray-950/80 backdrop-blur-sm text-xs font-bold text-white">
          #{index + 1}
        </div>

        {/* Growth badge */}
        <div
          className={`absolute top-2 right-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold backdrop-blur-sm ${growthColor}`}
        >
          <TrendingUp className="h-3 w-3" />
          {trend.momentum_score}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        {/* Badges row */}
        <div className="flex items-center gap-2 mb-2">
          <VerificationBadge status={trend.verification_status} />
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2 mb-1">
          {trend.canonical_title}
        </h3>

        {/* Summary */}
        <p className="text-xs text-gray-400 line-clamp-2 mb-3">{trend.summary}</p>

        {/* Platform badges */}
        <div className="flex items-center gap-1.5 mb-3">
          {trend.source_platforms.slice(0, 4).map((pid) => {
            const cfg = PLATFORM_CONFIGS[pid];
            return (
              <span
                key={pid}
                className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold text-white"
                style={{ backgroundColor: cfg?.color ?? '#6366f1' }}
              >
                {cfg?.name ?? pid}
              </span>
            );
          })}
          {trend.source_platforms.length > 4 && (
            <span className="text-[10px] text-gray-600">
              +{trend.source_platforms.length - 4}
            </span>
          )}
        </div>

        {/* Mini scores */}
        <div className="space-y-1.5 mb-3">
          <ScoreBadge
            score={trend.momentum_score}
            label="Momentum"
            size="sm"
          />
          <ScoreBadge
            score={trend.confidence_score}
            label="Confidence"
            size="sm"
          />
        </div>

        {/* Source count */}
        <div className="flex items-center gap-1 text-[11px] text-gray-600 mb-3">
          <Globe className="h-3 w-3" />
          {trend.sources.length} source{trend.sources.length !== 1 ? 's' : ''}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onDeepAnalysis(trend)}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 py-2 text-xs font-medium text-white transition-colors"
          >
            <Zap className="h-3.5 w-3.5" />
            Deep Analysis
          </button>
          <a
            href={trend.sources[0]?.url ?? trend.search_fallback_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center rounded-lg border border-gray-800 hover:bg-gray-800 p-2 text-gray-400 hover:text-white transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          {trend.search_fallback_url && (
            <a
              href={trend.search_fallback_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center rounded-lg border border-gray-800 hover:bg-gray-800 p-2 text-gray-400 hover:text-white transition-colors"
              title="Search fallback"
            >
              <Search className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}
