import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, ShieldAlert, AlertTriangle, Clock } from 'lucide-react';
import type { VerificationStatus } from '@/types';

interface VerificationBadgeProps {
  status: VerificationStatus;
  lastVerified?: Date;
}

const CONFIG: Record<
  VerificationStatus,
  {
    icon: typeof Shield;
    label: string;
    bgClass: string;
    textClass: string;
    borderClass: string;
  }
> = {
  verified: {
    icon: Shield,
    label: 'Verified',
    bgClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/30',
  },
  partially_verified: {
    icon: ShieldAlert,
    label: 'Partially Verified',
    bgClass: 'bg-yellow-500/10',
    textClass: 'text-yellow-400',
    borderClass: 'border-yellow-500/30',
  },
  weak_signal: {
    icon: AlertTriangle,
    label: 'Weak Signal',
    bgClass: 'bg-orange-500/10',
    textClass: 'text-orange-400',
    borderClass: 'border-orange-500/30',
  },
  stale: {
    icon: Clock,
    label: 'Stale',
    bgClass: 'bg-gray-500/10',
    textClass: 'text-gray-400',
    borderClass: 'border-gray-500/30',
  },
  unverified: {
    icon: AlertTriangle,
    label: 'Unverified',
    bgClass: 'bg-red-500/10',
    textClass: 'text-red-400',
    borderClass: 'border-red-500/30',
  },
};

export default function VerificationBadge({
  status,
  lastVerified,
}: VerificationBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const cfg = CONFIG[status];
  const Icon = cfg.icon;

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg.bgClass} ${cfg.textClass} ${cfg.borderClass}`}
      >
        <Icon className="h-3 w-3" />
        {cfg.label}
      </span>

      {lastVerified && showTooltip && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 whitespace-nowrap rounded-lg bg-gray-800 border border-gray-700 px-3 py-1.5 text-xs text-gray-300 shadow-xl"
        >
          Last verified: {new Date(lastVerified).toLocaleDateString()}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
        </motion.div>
      )}
    </div>
  );
}
