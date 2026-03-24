import { motion } from 'framer-motion';

interface ProgressBarProps {
  progress: number;
  label?: string;
}

export default function ProgressBar({ progress, label }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, progress));

  return (
    <div className="w-full">
      {label && (
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-400">{label}</span>
          <span className="text-xs font-semibold text-gray-300">{clamped}%</span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500"
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      {!label && (
        <div className="mt-1 text-right">
          <span className="text-xs font-semibold text-gray-400">{clamped}%</span>
        </div>
      )}
    </div>
  );
}
