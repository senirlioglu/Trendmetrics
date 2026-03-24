import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard,
  Check,
  Sparkles,
  Loader2,
  Star,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

const PACKAGES = [
  {
    id: 'starter',
    label: 'Starter',
    amount: 5,
    credits: '~10 analyses',
    highlighted: false,
  },
  {
    id: 'popular',
    label: 'Popular',
    amount: 15,
    credits: '~30 analyses',
    highlighted: true,
  },
  {
    id: 'pro',
    label: 'Pro',
    amount: 30,
    credits: '~60 analyses',
    highlighted: false,
  },
  {
    id: 'enterprise',
    label: 'Enterprise',
    amount: 50,
    credits: '~100 analyses',
    highlighted: false,
  },
];

export default function TopUpPanel() {
  const { user } = useAuthStore();
  const [selected, setSelected] = useState('popular');
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  const selectedPkg = PACKAGES.find((p) => p.id === selected);

  const handlePayment = async () => {
    setIsProcessing(true);
    // Simulated payment
    await new Promise((r) => setTimeout(r, 2000));
    setIsProcessing(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Current balance */}
      <div className="rounded-xl bg-gray-900/50 border border-gray-800 p-6 text-center">
        <p className="text-sm text-gray-400 mb-1">Current Balance</p>
        <p className="text-4xl font-bold text-white">
          ${user?.balance.toFixed(2) ?? '0.00'}
        </p>
      </div>

      {/* Package selection */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {PACKAGES.map((pkg) => {
          const isSelected = selected === pkg.id;
          return (
            <motion.button
              key={pkg.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelected(pkg.id)}
              className={`relative flex flex-col items-center rounded-xl border-2 p-4 transition-colors ${
                isSelected
                  ? 'border-primary-500 bg-primary-500/5'
                  : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'
              }`}
            >
              {pkg.highlighted && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 flex items-center gap-0.5 rounded-full bg-primary-500 px-2.5 py-0.5 text-[10px] font-bold text-white">
                  <Star className="h-2.5 w-2.5" />
                  BEST VALUE
                </span>
              )}

              <span className="text-xs font-medium text-gray-400 mb-1">
                {pkg.label}
              </span>
              <span className="text-2xl font-bold text-white">${pkg.amount}</span>
              <span className="text-[11px] text-gray-500 mt-1">{pkg.credits}</span>

              {isSelected && (
                <motion.div
                  layoutId="selected-check"
                  className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary-500"
                >
                  <Check className="h-3 w-3 text-white" />
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Payment button */}
      <AnimatePresence mode="wait">
        {success ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center rounded-xl bg-emerald-500/5 border border-emerald-500/30 p-6 space-y-2"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 10 }}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10"
            >
              <Sparkles className="h-7 w-7 text-emerald-400" />
            </motion.div>
            <p className="text-lg font-semibold text-emerald-400">Payment Successful!</p>
            <p className="text-sm text-gray-400">
              ${selectedPkg?.amount.toFixed(2)} has been added to your balance.
            </p>
          </motion.div>
        ) : (
          <motion.button
            key="pay"
            onClick={handlePayment}
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-emerald-500 hover:from-indigo-600 hover:to-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed py-4 text-base font-semibold text-white transition-colors"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="h-5 w-5" />
                Pay ${selectedPkg?.amount.toFixed(2)}
              </>
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
