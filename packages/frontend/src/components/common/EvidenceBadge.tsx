import type { EvidenceLevel } from '@/types';

interface EvidenceBadgeProps {
  level: EvidenceLevel;
}

const CONFIG: Record<
  EvidenceLevel,
  { label: string; bgClass: string; textClass: string }
> = {
  verified: {
    label: 'Verified Data',
    bgClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-400',
  },
  inferred: {
    label: 'Inferred',
    bgClass: 'bg-yellow-500/10',
    textClass: 'text-yellow-400',
  },
  weak_signal: {
    label: 'Weak Signal',
    bgClass: 'bg-orange-500/10',
    textClass: 'text-orange-400',
  },
  stale: {
    label: 'Stale',
    bgClass: 'bg-gray-500/10',
    textClass: 'text-gray-400',
  },
};

export default function EvidenceBadge({ level }: EvidenceBadgeProps) {
  const cfg = CONFIG[level];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cfg.bgClass} ${cfg.textClass}`}
    >
      {cfg.label}
    </span>
  );
}
