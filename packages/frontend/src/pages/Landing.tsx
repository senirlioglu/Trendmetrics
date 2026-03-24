import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  TrendingUp,
  Search,
  ShieldCheck,
  FileBarChart,
  Globe,
  Zap,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  MonitorSmartphone,
  ShoppingCart,
  MessageSquare,
  Music,
  Newspaper,
  Gamepad2,
  Brain,
  Target,
  Lock,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: 'easeOut' },
  }),
};

const platformGroups = [
  { name: 'Search & Web', icon: Search, color: 'text-blue-400' },
  { name: 'Social Media', icon: MessageSquare, color: 'text-pink-400' },
  { name: 'E-Commerce', icon: ShoppingCart, color: 'text-amber-400' },
  { name: 'Entertainment', icon: Music, color: 'text-purple-400' },
  { name: 'News & Publishing', icon: Newspaper, color: 'text-emerald-400' },
  { name: 'Gaming & Tech', icon: Gamepad2, color: 'text-red-400' },
];

const features = [
  {
    icon: MonitorSmartphone,
    title: 'Multi-Platform Tracking',
    description:
      'Monitor trends across 18+ platforms simultaneously. From Google Search to TikTok, Amazon to Steam -- all in one unified dashboard.',
    color: 'from-blue-500/20 to-blue-600/5',
    iconColor: 'text-blue-400',
  },
  {
    icon: Brain,
    title: 'AI-Powered Live Data',
    description:
      'Gemini AI with Google Search Grounding delivers real-time, verified trend data. No stale databases, no cached results -- fresh intelligence every query.',
    color: 'from-purple-500/20 to-purple-600/5',
    iconColor: 'text-purple-400',
  },
  {
    icon: FileBarChart,
    title: 'Deep Intelligence Reports',
    description:
      'Generate comprehensive analysis reports with competitive landscape, audience insights, growth projections, and actionable recommendations.',
    color: 'from-emerald-500/20 to-emerald-600/5',
    iconColor: 'text-emerald-400',
  },
  {
    icon: ShieldCheck,
    title: 'Smart Verification System',
    description:
      'Every trend is scored, verified, and backed by source evidence. Know exactly how reliable each data point is before making decisions.',
    color: 'from-amber-500/20 to-amber-600/5',
    iconColor: 'text-amber-400',
  },
];

const stats = [
  { value: '18+', label: 'Platforms', icon: Globe },
  { value: '12', label: 'Categories', icon: BarChart3 },
  { value: '10', label: 'Regions', icon: Target },
  { value: 'Real-time', label: 'Updates', icon: Zap },
];

const steps = [
  {
    step: '01',
    title: 'Select Platform',
    description:
      'Choose from 6 platform groups covering 18+ services. Filter by category, country, and more.',
    icon: Search,
  },
  {
    step: '02',
    title: 'AI Discovers Trends',
    description:
      'Gemini AI with Google Search Grounding fetches live, verified trend data in real time.',
    icon: Sparkles,
  },
  {
    step: '03',
    title: 'Get Actionable Intelligence',
    description:
      'Receive scored, verified trends with deep analysis reports and competitive insights.',
    icon: TrendingUp,
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const { user, login } = useAuthStore();

  const handleCTA = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      login();
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-xl border-b border-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-indigo-500" />
            <span className="text-lg font-bold tracking-tight">
              Trend<span className="text-indigo-400">Metrics</span>
            </span>
          </div>
          <button
            onClick={handleCTA}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors cursor-pointer"
          >
            {user ? 'Go to Dashboard' : 'Get Started'}
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 px-4">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-indigo-600/10 rounded-full blur-[128px]" />
          <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] bg-emerald-600/8 rounded-full blur-[96px]" />
        </div>

        <div className="relative max-w-5xl mx-auto text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={0}
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              Powered by Gemini AI
            </span>
          </motion.div>

          <motion.h1
            className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={1}
          >
            Real-Time Market Intelligence{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
              Across Every Platform
            </span>
          </motion.h1>

          <motion.p
            className="mt-6 text-lg sm:text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={2}
          >
            AI-powered trend analysis with Google Search Grounding. Discover what
            is trending right now across 18+ platforms with verified, real-time
            data and deep intelligence reports.
          </motion.p>

          <motion.div
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={3}
          >
            <button
              onClick={handleCTA}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-base transition-all hover:shadow-lg hover:shadow-indigo-500/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              Get Started Free
              <ArrowRight className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-500">
              <span className="text-emerald-400 font-medium">$10.00</span> free
              credits on signup
            </span>
          </motion.div>

          {/* Platform icons row */}
          <motion.div
            className="mt-16 flex flex-wrap items-center justify-center gap-6 sm:gap-10"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={4}
          >
            {platformGroups.map((platform) => (
              <div
                key={platform.name}
                className="flex flex-col items-center gap-2 opacity-60 hover:opacity-100 transition-opacity"
              >
                <platform.icon className={`w-6 h-6 ${platform.color}`} />
                <span className="text-xs text-gray-500">{platform.name}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 sm:py-28 px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl sm:text-4xl font-bold">
              Intelligence, Not Just Data
            </h2>
            <p className="mt-4 text-gray-400 max-w-2xl mx-auto">
              Every feature is designed to give you actionable insights backed by
              verified, real-time information.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                className={`relative rounded-2xl border border-gray-800/50 bg-gradient-to-br ${feature.color} p-6 sm:p-8 overflow-hidden`}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
              >
                <div
                  className={`w-12 h-12 rounded-xl bg-gray-900/80 border border-gray-700/50 flex items-center justify-center mb-4 ${feature.iconColor}`}
                >
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-400 leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-4 border-y border-gray-800/50">
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              className="text-center"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
            >
              <stat.icon className="w-6 h-6 text-indigo-400 mx-auto mb-3" />
              <div className="text-3xl sm:text-4xl font-bold text-white">
                {stat.value}
              </div>
              <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 sm:py-28 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl sm:text-4xl font-bold">How It Works</h2>
            <p className="mt-4 text-gray-400">
              Three simple steps to actionable market intelligence.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <motion.div
                key={step.step}
                className="relative text-center"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
              >
                {i < steps.length - 1 && (
                  <div className="hidden sm:block absolute top-12 left-[60%] w-[80%] h-px bg-gradient-to-r from-gray-700 to-transparent" />
                )}
                <div className="w-16 h-16 rounded-2xl bg-gray-900/50 border border-gray-800/50 flex items-center justify-center mx-auto mb-5">
                  <step.icon className="w-7 h-7 text-indigo-400" />
                </div>
                <div className="text-xs font-semibold text-indigo-400 tracking-widest uppercase mb-2">
                  Step {step.step}
                </div>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="py-20 sm:py-28 px-4">
        <motion.div
          className="max-w-4xl mx-auto bg-gray-900/50 border border-gray-800/50 rounded-2xl p-8 sm:p-12 text-center"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <Lock className="w-10 h-10 text-emerald-400 mx-auto mb-6" />
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            Not a scraping tool. Not a guessing engine.
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto leading-relaxed mb-8">
            TrendMetrics uses Gemini AI with Google Search Grounding to fetch
            live, verified data from across the web. Every trend is scored for
            reliability, backed by source evidence, and verified against multiple
            signals. You get intelligence you can trust, not noise.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-gray-400">
            {[
              'Google Search Grounding',
              'Source-backed evidence',
              'Multi-signal verification',
            ].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                {item}
              </span>
            ))}
          </div>
        </motion.div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Ready to discover what is trending?
          </h2>
          <p className="text-gray-400 mb-8">
            Start with $10.00 in free credits. No credit card required.
          </p>
          <button
            onClick={handleCTA}
            className="px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold transition-all hover:shadow-lg hover:shadow-indigo-500/25 inline-flex items-center gap-2 cursor-pointer"
          >
            Get Started Free
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800/50 py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-500" />
            <span className="text-sm font-semibold">
              Trend<span className="text-indigo-400">Metrics</span>
            </span>
          </div>
          <p className="text-xs text-gray-600">
            &copy; {new Date().getFullYear()} TrendMetrics. Powered by Gemini AI
            with Google Search Grounding.
          </p>
        </div>
      </footer>
    </div>
  );
}
