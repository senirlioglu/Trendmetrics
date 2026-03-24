import type { CanonicalTrend } from '@/types';
import ScoreBadge from '@/components/common/ScoreBadge';

interface TrendScorePanelProps {
  trend: CanonicalTrend;
}

const SCORES: {
  key: keyof CanonicalTrend;
  label: string;
  explanationKey: string;
}[] = [
  { key: 'momentum_score', label: 'Momentum', explanationKey: 'momentum' },
  { key: 'confidence_score', label: 'Confidence', explanationKey: 'confidence' },
  {
    key: 'cross_platform_score',
    label: 'Cross-Platform',
    explanationKey: 'cross_platform',
  },
  {
    key: 'commercial_relevance_score',
    label: 'Commercial',
    explanationKey: 'commercial_relevance',
  },
  { key: 'freshness_score', label: 'Freshness', explanationKey: 'freshness' },
];

export default function TrendScorePanel({ trend }: TrendScorePanelProps) {
  return (
    <div className="rounded-xl bg-gray-900/50 border border-gray-800 p-4">
      <h3 className="text-sm font-semibold text-white mb-4">Score Breakdown</h3>
      <div className="space-y-3">
        {SCORES.map((s) => {
          const value = trend[s.key] as number;
          const explanation =
            trend.score_explanations?.[s.explanationKey] ?? undefined;

          return (
            <div key={s.key}>
              <ScoreBadge
                score={value}
                label={s.label}
                explanation={explanation}
                size="sm"
              />
              {explanation && (
                <p className="mt-0.5 ml-18 text-[11px] text-gray-600 leading-snug pl-[72px]">
                  {explanation}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
