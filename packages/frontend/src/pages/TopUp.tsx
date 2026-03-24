import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  CreditCard,
  CheckCircle2,
  Wallet,
  ArrowRight,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import TopUpPanel from '../components/credit/TopUpPanel';
import TransactionHistory from '../components/credit/TransactionHistory';

export default function TopUp() {
  const navigate = useNavigate();
  const { balance } = useAuthStore();
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800/50 bg-gray-950/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-gray-800/50 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="font-semibold text-sm">Credits & Billing</h1>
              <p className="text-xs text-gray-500">Manage your credit balance</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Current balance card */}
        <motion.div
          className="bg-gray-900/50 border border-gray-800/50 rounded-2xl p-6 mb-8"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400 mb-1">Current Balance</p>
              <p className="text-3xl font-bold">
                <span className="text-emerald-400">$</span>
                {(balance ?? 0).toFixed(2)}
              </p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Wallet className="w-7 h-7 text-emerald-400" />
            </div>
          </div>
        </motion.div>

        {/* Payment success or TopUp panel */}
        <AnimatePresence mode="wait">
          {paymentSuccess ? (
            <motion.div
              key="success"
              className="bg-gray-900/50 border border-gray-800/50 rounded-2xl p-8 text-center"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  type: 'spring',
                  damping: 12,
                  stiffness: 200,
                  delay: 0.2,
                }}
              >
                <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-6" />
              </motion.div>
              <h2 className="text-2xl font-bold mb-2">Payment Successful!</h2>
              <p className="text-gray-400 mb-2">
                <span className="text-emerald-400 font-semibold">
                  ${topUpAmount?.toFixed(2)}
                </span>{' '}
                has been added to your account.
              </p>
              <p className="text-sm text-gray-500 mb-8">
                New balance:{' '}
                <span className="text-white font-medium">
                  ${(balance ?? 0).toFixed(2)}
                </span>
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-medium text-sm transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  Back to Dashboard
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setPaymentSuccess(false);
                    setTopUpAmount(null);
                  }}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 font-medium text-sm transition-colors cursor-pointer"
                >
                  Add More Credits
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="topup"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4 }}
            >
              <TopUpPanel />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Transaction history */}
        <motion.div
          className="mt-8"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <h2 className="text-lg font-semibold mb-4">Transaction History</h2>
          <TransactionHistory transactions={[]} />
        </motion.div>
      </div>
    </div>
  );
}
