import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowUpCircle,
  ArrowDownCircle,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { CreditTransaction } from '@/types';

interface TransactionHistoryProps {
  transactions: CreditTransaction[];
  pageSize?: number;
}

const TYPE_CONFIG: Record<
  CreditTransaction['type'],
  {
    label: string;
    icon: typeof ArrowUpCircle;
    bgClass: string;
    textClass: string;
  }
> = {
  topup: {
    label: 'Top Up',
    icon: ArrowUpCircle,
    bgClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-400',
  },
  deep_analysis: {
    label: 'Deep Analysis',
    icon: ArrowDownCircle,
    bgClass: 'bg-red-500/10',
    textClass: 'text-red-400',
  },
  force_refresh: {
    label: 'Force Refresh',
    icon: ArrowDownCircle,
    bgClass: 'bg-red-500/10',
    textClass: 'text-red-400',
  },
  daily_report: {
    label: 'Daily Report',
    icon: ArrowDownCircle,
    bgClass: 'bg-red-500/10',
    textClass: 'text-red-400',
  },
  refund: {
    label: 'Refund',
    icon: RotateCcw,
    bgClass: 'bg-blue-500/10',
    textClass: 'text-blue-400',
  },
};

export default function TransactionHistory({
  transactions,
  pageSize = 10,
}: TransactionHistoryProps) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(transactions.length / pageSize);
  const pageItems = transactions.slice(page * pageSize, (page + 1) * pageSize);

  if (transactions.length === 0) {
    return (
      <div className="rounded-xl bg-gray-900/50 border border-gray-800 p-8 text-center">
        <p className="text-sm text-gray-500">No transactions yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-gray-900/50 border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-12 gap-2 border-b border-gray-800 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        <div className="col-span-2">Type</div>
        <div className="col-span-3">Date</div>
        <div className="col-span-4">Description</div>
        <div className="col-span-1 text-right">Amount</div>
        <div className="col-span-2 text-right">Balance</div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-800/50">
        {pageItems.map((tx, i) => {
          const cfg = TYPE_CONFIG[tx.type];
          const Icon = cfg.icon;
          const isDeduction = ['deep_analysis', 'force_refresh', 'daily_report'].includes(
            tx.type
          );

          return (
            <motion.div
              key={tx.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              className="grid grid-cols-12 gap-2 px-4 py-3 text-sm items-center hover:bg-gray-800/30 transition-colors"
            >
              {/* Type badge */}
              <div className="col-span-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.bgClass} ${cfg.textClass}`}
                >
                  <Icon className="h-3 w-3" />
                  {cfg.label}
                </span>
              </div>

              {/* Date */}
              <div className="col-span-3 text-xs text-gray-400">
                {new Date(tx.created_at).toLocaleString()}
              </div>

              {/* Description */}
              <div className="col-span-4 text-xs text-gray-300 truncate">
                {tx.description}
              </div>

              {/* Amount */}
              <div
                className={`col-span-1 text-right text-xs font-semibold ${
                  isDeduction ? 'text-red-400' : 'text-emerald-400'
                }`}
              >
                {isDeduction ? '-' : '+'}${Math.abs(tx.amount).toFixed(2)}
              </div>

              {/* Balance after */}
              <div className="col-span-2 text-right text-xs text-gray-400">
                ${tx.balance_after.toFixed(2)}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-800 px-4 py-3">
          <span className="text-xs text-gray-500">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
