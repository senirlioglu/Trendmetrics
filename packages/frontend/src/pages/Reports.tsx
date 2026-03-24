import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  FileBarChart,
  Calendar,
  Sparkles,
  Newspaper,
  ChevronRight,
  Search,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { CanonicalTrend, PlatformGroupId } from '@/types';
import DeepAnalysisModal from '../components/report/DeepAnalysisModal';
import DailyReportModal from '../components/report/DailyReportModal';

type ReportTab = 'deep_analysis' | 'daily_reports';

interface DeepAnalysisReport {
  id: string;
  type: 'deep_analysis';
  trendTitle: string;
  platform: string;
  createdAt: string;
  preview: string;
  data: CanonicalTrend;
}

interface DailyReport {
  id: string;
  type: 'daily_report';
  platformGroup: PlatformGroupId;
  date: string;
  createdAt: string;
  preview: string;
  data: CanonicalTrend[];
}

type Report = DeepAnalysisReport | DailyReport;

// TODO: Replace with actual data from a reports store or API
const mockDeepAnalysisReports: DeepAnalysisReport[] = [];
const mockDailyReports: DailyReport[] = [];

const tabs: { key: ReportTab; label: string; icon: React.ElementType }[] = [
  { key: 'deep_analysis', label: 'Deep Analysis', icon: Sparkles },
  { key: 'daily_reports', label: 'Daily Reports', icon: Newspaper },
];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Reports() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ReportTab>('deep_analysis');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const reports: Report[] =
    activeTab === 'deep_analysis'
      ? mockDeepAnalysisReports
      : mockDailyReports;

  const filteredReports = reports.filter((report) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    if (report.type === 'deep_analysis') {
      return (
        report.trendTitle.toLowerCase().includes(q) ||
        report.preview.toLowerCase().includes(q)
      );
    }
    return (
      report.platformGroup.toLowerCase().includes(q) ||
      report.preview.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800/50 bg-gray-950/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-gray-800/50 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <FileBarChart className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h1 className="font-semibold text-sm">Report History</h1>
              <p className="text-xs text-gray-500">
                View past analysis and daily reports
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-900/50 border border-gray-800/50 rounded-xl p-1 mb-6 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activeTab === tab.key
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-900/50 border border-gray-800/50 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
          />
        </div>

        {/* Report list */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
          >
            {filteredReports.length === 0 ? (
              <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl p-12 text-center">
                <FileBarChart className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-400 mb-2">
                  No reports yet
                </h3>
                <p className="text-sm text-gray-500 max-w-md mx-auto">
                  {activeTab === 'deep_analysis'
                    ? 'Generate deep analysis reports from the dashboard by clicking the analysis button on any trend.'
                    : 'Daily reports are generated from the dashboard header. They provide a comprehensive overview of trending topics.'}
                </p>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="mt-6 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition-colors cursor-pointer"
                >
                  Go to Dashboard
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredReports.map((report, i) => (
                  <motion.button
                    key={report.id}
                    className="w-full text-left bg-gray-900/50 border border-gray-800/50 rounded-xl p-5 hover:border-gray-700/50 transition-colors group cursor-pointer"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.3 }}
                    onClick={() => setSelectedReport(report)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {report.type === 'deep_analysis' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 text-xs font-medium">
                              <Sparkles className="w-3 h-3" />
                              Deep Analysis
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-xs font-medium">
                              <Newspaper className="w-3 h-3" />
                              Daily Report
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Calendar className="w-3 h-3" />
                            {formatDate(report.createdAt)}
                          </span>
                        </div>

                        <h3 className="font-semibold text-sm truncate mb-1">
                          {report.type === 'deep_analysis'
                            ? (report as DeepAnalysisReport).trendTitle
                            : (report as DailyReport).platformGroup}
                        </h3>

                        <p className="text-sm text-gray-400 line-clamp-2">
                          {report.preview}
                        </p>
                      </div>

                      <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-colors shrink-0 mt-1" />
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Report modals */}
      <AnimatePresence>
        {selectedReport?.type === 'deep_analysis' && (
          <DeepAnalysisModal
            trend={selectedReport.data}
            isOpen={true}
            onClose={() => setSelectedReport(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedReport?.type === 'daily_report' && (
          <DailyReportModal
            platformGroup={(selectedReport as DailyReport).platformGroup}
            trends={(selectedReport as DailyReport).data}
            isOpen={true}
            onClose={() => setSelectedReport(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
