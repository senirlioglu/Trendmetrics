import { motion } from 'framer-motion';
import {
  X,
  Zap,
  ShieldCheck,
  Clock,
  Lightbulb,
  AlertTriangle,
  TrendingUp,
  Target,
  ShoppingCart,
  Megaphone,
  Pen,
  ListOrdered,
} from 'lucide-react';
import type { CanonicalTrend } from '@/types';
import VerificationBadge from '@/components/common/VerificationBadge';
import EvidenceBadge from '@/components/common/EvidenceBadge';
import TrendScorePanel from './TrendScorePanel';
import SourceList from '@/components/common/SourceList';

interface TrendDetailProps {
  trend: CanonicalTrend;
  onClose: () => void;
  onDeepAnalysis: () => void;
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary-400" />
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function TrendDetail({
  trend,
  onClose,
  onDeepAnalysis,
}: TrendDetailProps) {
  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
      />

      {/* Drawer */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 z-50 h-full w-full max-w-2xl overflow-y-auto bg-gray-950 border-l border-gray-800 shadow-2xl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-800 bg-gray-950/90 backdrop-blur-xl p-6">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-white leading-tight mb-2">
              {trend.canonical_title}
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              <VerificationBadge
                status={trend.verification_status}
                lastVerified={trend.last_verified_at}
              />
              <EvidenceBadge level={trend.evidence_level} />
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Clock className="h-3 w-3" />
                {new Date(trend.last_verified_at).toLocaleDateString()}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Score Dashboard */}
          <TrendScorePanel trend={trend} />

          {/* Summary */}
          <Section title="Summary" icon={Lightbulb}>
            <p className="text-sm text-gray-300 leading-relaxed">{trend.summary}</p>
          </Section>

          {/* Why Rising */}
          {trend.why_rising && (
            <Section title="Why It's Rising" icon={TrendingUp}>
              <p className="text-sm text-gray-300 leading-relaxed">
                {trend.why_rising}
              </p>
            </Section>
          )}

          {/* Platform Distribution */}
          <Section title="Platform Distribution" icon={ShieldCheck}>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {trend.source_platforms.map((pid) => (
                <span
                  key={pid}
                  className="inline-flex rounded-md bg-gray-800 px-2 py-1 text-xs text-gray-300"
                >
                  {pid}
                </span>
              ))}
            </div>
            <SourceList sources={trend.sources} />
          </Section>

          {/* Business Insights */}
          <Section title="Business Insights" icon={Target}>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  label: 'Commercial Angle',
                  value: trend.commercial_angle,
                  icon: ShoppingCart,
                },
                {
                  label: 'Brand Angle',
                  value: trend.brand_angle,
                  icon: Megaphone,
                },
                {
                  label: 'E-Commerce Angle',
                  value: trend.ecommerce_angle,
                  icon: ShoppingCart,
                },
                {
                  label: 'Content Angle',
                  value: trend.content_angle,
                  icon: Pen,
                },
              ]
                .filter((item) => item.value)
                .map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg bg-gray-900/50 border border-gray-800 p-3"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <item.icon className="h-3.5 w-3.5 text-primary-400" />
                      <span className="text-xs font-semibold text-gray-400">
                        {item.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed">
                      {item.value}
                    </p>
                  </div>
                ))}
            </div>
          </Section>

          {/* Risks */}
          {trend.risks && (
            <Section title="Risks" icon={AlertTriangle}>
              <div className="rounded-lg bg-red-500/5 border border-red-500/20 p-3">
                <p className="text-sm text-gray-300 leading-relaxed">{trend.risks}</p>
              </div>
            </Section>
          )}

          {/* Recommended Actions */}
          {trend.recommended_actions?.length > 0 && (
            <Section title="Recommended Actions" icon={ListOrdered}>
              <ol className="space-y-2">
                {trend.recommended_actions.map((action, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-500/10 text-[10px] font-bold text-primary-400">
                      {i + 1}
                    </span>
                    <span className="text-sm text-gray-300">{action}</span>
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {/* Deep Analysis CTA */}
          <div className="pt-4 border-t border-gray-800">
            <button
              onClick={onDeepAnalysis}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-emerald-500 hover:from-indigo-600 hover:to-emerald-600 py-3 text-sm font-semibold text-white transition-colors"
            >
              <Zap className="h-4 w-4" />
              Generate Deep Analysis Report
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
