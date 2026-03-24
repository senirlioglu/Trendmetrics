import { useState } from 'react';
import { motion } from 'framer-motion';

interface ScoreBadgeProps {
  score: number;
  label: string;
  explanation?: string;
  size?: 'sm' | 'lg';
}

function scoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-400';
  if (score >= 40) return 'text-yellow-400';
  return 'text-red-400';
}

function scoreTrackColor(score: number): string {
  if (score >= 70) return 'bg-emerald-400';
  if (score >= 40) return 'bg-yellow-400';
  return 'bg-red-400';
}

function scoreTrackBg(score: number): string {
  if (score >= 70) return 'bg-emerald-400/20';
  if (score >= 40) return 'bg-yellow-400/20';
  return 'bg-red-400/20';
}

export default function ScoreBadge({
  score,
  label,
  explanation,
  size = 'sm',
}: ScoreBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (size === 'lg') {
    return (
      <div
        className="relative"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className="flex flex-col items-center gap-2">
          {/* Circular visualization */}
          <div className="relative h-20 w-20">
            <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
              <circle
                cx="40"
                cy="40"
                r="34"
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                className="text-gray-800"
              />
              <motion.circle
                cx="40"
                cy="40"
                r="34"
                fill="none"
                strokeWidth="6"
                strokeLinecap="round"
                className={scoreColor(score)}
                stroke="currentColor"
                strokeDasharray={`${(score / 100) * 213.6} 213.6`}
                initial={{ strokeDasharray: '0 213.6' }}
                animate={{
                  strokeDasharray: `${(score / 100) * 213.6} 213.6`,
                }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-xl font-bold ${scoreColor(score)}`}>{score}</span>
            </div>
          </div>
          <span className="text-xs font-medium text-gray-400">{label}</span>
        </div>

        {explanation && showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-56 rounded-lg bg-gray-800 border border-gray-700 p-3 text-xs text-gray-300 shadow-xl"
          >
            {explanation}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
          </motion.div>
        )}
      </div>
    );
  }

  // Compact bar visualization
  return (
    <div
      className="relative group"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium text-gray-500 w-16 shrink-0 truncate">
          {label}
        </span>
        <div className={`h-1.5 flex-1 rounded-full ${scoreTrackBg(score)}`}>
          <motion.div
            className={`h-full rounded-full ${scoreTrackColor(score)}`}
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        <span className={`text-xs font-semibold w-7 text-right ${scoreColor(score)}`}>
          {score}
        </span>
      </div>

      {explanation && showTooltip && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-full left-0 mb-2 z-50 w-52 rounded-lg bg-gray-800 border border-gray-700 p-2.5 text-xs text-gray-300 shadow-xl"
        >
          {explanation}
          <div className="absolute top-full left-6 border-4 border-transparent border-t-gray-800" />
        </motion.div>
      )}
    </div>
  );
}
