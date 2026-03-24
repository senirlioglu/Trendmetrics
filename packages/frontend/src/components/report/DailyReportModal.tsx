import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  FileText,
  Loader2,
  Copy,
  Download,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { CanonicalTrend, PlatformGroupId } from '@/types';
import ProgressBar from '@/components/common/ProgressBar';
import { useAuthStore } from '@/stores/authStore';

interface DailyReportModalProps {
  platformGroup: PlatformGroupId;
  trends: CanonicalTrend[];
  isOpen: boolean;
  onClose: () => void;
}

type Phase = 'confirm' | 'generating' | 'done' | 'error';

const STEPS = [
  'Collecting trend data...',
  'Analyzing patterns...',
  'Generating market report...',
  'Formatting output...',
];

const COST = 0.25;

const GROUP_LABELS: Record<PlatformGroupId, string> = {
  'social-media': 'Social Media',
  'e-commerce': 'E-Commerce',
  'app-stores': 'App Stores',
  'travel-local': 'Travel & Local',
  'search-engines': 'Search Engines',
};

export default function DailyReportModal({
  platformGroup,
  trends,
  isOpen,
  onClose,
}: DailyReportModalProps) {
  const { user } = useAuthStore();
  const [phase, setPhase] = useState<Phase>('confirm');
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [report, setReport] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const generate = useCallback(async () => {
    setPhase('generating');
    setProgress(0);
    setStepIndex(0);

    try {
      for (let i = 0; i < STEPS.length; i++) {
        setStepIndex(i);
        const target = ((i + 1) / STEPS.length) * 100;
        for (let p = 0; p <= target; p += 5) {
          setProgress(Math.min(p, 100));
          await new Promise((r) => setTimeout(r, 80));
        }
      }

      // TODO: Replace with actual API call
      const trendList = trends
        .slice(0, 10)
        .map(
          (t, i) =>
            `### ${i + 1}. ${t.canonical_title}\n\n${t.summary}\n\n**Momentum:** ${t.momentum_score}/100 | **Confidence:** ${t.confidence_score}/100\n`
        )
        .join('\n');

      setReport(
        `# Daily Market Report: ${GROUP_LABELS[platformGroup]}\n\n` +
          `**Date:** ${today}\n\n` +
          `**Trends Analyzed:** ${trends.length}\n\n---\n\n` +
          `## Top Trends\n\n${trendList}\n\n` +
          `---\n\n*Report generated automatically by TrendMetrics*`
      );
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setPhase('error');
    }
  }, [platformGroup, trends, today]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-report-${platformGroup}-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    setPhase('confirm');
    setProgress(0);
    setReport('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-gray-950 border border-gray-800 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500/10">
                <FileText className="h-4 w-4 text-accent-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Daily Report</h2>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Calendar className="h-3 w-3" />
                  {today}
                </div>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {phase === 'confirm' && (
              <div className="space-y-6">
                <div className="rounded-xl bg-gray-900/50 border border-gray-800 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-white">
                      {GROUP_LABELS[platformGroup]}
                    </span>
                    <span className="text-xs text-gray-500">
                      {trends.length} trends
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Generate a comprehensive daily market report covering all current
                    trends for this platform group.
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-gray-900/50 border border-gray-800 p-4">
                  <div>
                    <span className="text-sm text-gray-400">Report Cost</span>
                    <p className="text-2xl font-bold text-white">${COST.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm text-gray-400">Your Balance</span>
                    <p className="text-2xl font-bold text-emerald-400">
                      ${user?.balance.toFixed(2) ?? '0.00'}
                    </p>
                  </div>
                </div>

                {(user?.balance ?? 0) < COST && (
                  <div className="rounded-lg bg-red-500/5 border border-red-500/20 p-3 text-sm text-red-400">
                    Insufficient balance. Please top up your credits.
                  </div>
                )}

                <button
                  onClick={generate}
                  disabled={(user?.balance ?? 0) < COST}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-emerald-500 hover:from-indigo-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed py-3 text-sm font-semibold text-white transition-colors"
                >
                  <FileText className="h-4 w-4" />
                  Generate Daily Report
                </button>
              </div>
            )}

            {phase === 'generating' && (
              <div className="flex flex-col items-center justify-center py-12 space-y-6">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                >
                  <Loader2 className="h-12 w-12 text-accent-500" />
                </motion.div>
                <div className="w-full max-w-sm">
                  <ProgressBar progress={progress} />
                </div>
                <motion.p
                  key={stepIndex}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-gray-400"
                >
                  {STEPS[stepIndex]}
                </motion.p>
              </div>
            )}

            {phase === 'done' && (
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{report}</ReactMarkdown>
              </div>
            )}

            {phase === 'error' && (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10">
                  <AlertCircle className="h-8 w-8 text-red-400" />
                </div>
                <p className="text-sm text-gray-400">{error}</p>
                <button
                  onClick={generate}
                  className="flex items-center gap-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          {phase === 'done' && (
            <div className="flex items-center justify-end gap-2 border-t border-gray-800 px-6 py-4">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
              >
                {copied ? (
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
              >
                <Download className="h-4 w-4" />
                Download MD
              </button>
              <button
                onClick={handleClose}
                className="rounded-lg bg-primary-500 hover:bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
