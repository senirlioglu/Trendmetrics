import {
  ExternalLink,
  Search,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import type { TrendSource } from '@/types';
import { PLATFORM_CONFIGS } from '@/types';

interface SourceListProps {
  sources: TrendSource[];
}

export default function SourceList({ sources }: SourceListProps) {
  return (
    <div className="space-y-2">
      {sources.map((source, idx) => {
        const platformCfg = PLATFORM_CONFIGS[source.platform];
        return (
          <div
            key={`${source.platform}-${idx}`}
            className="flex items-start gap-3 rounded-lg bg-gray-900/50 border border-gray-800 p-3"
          >
            {/* Platform badge */}
            <span
              className="inline-flex items-center gap-1 shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
              style={{ backgroundColor: platformCfg?.color ?? '#6366f1' }}
            >
              {platformCfg?.name ?? source.platform}
            </span>

            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-300 truncate">{source.title}</p>

              <div className="mt-1 flex items-center gap-3">
                {/* Main link */}
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  Source
                </a>

                {/* Search fallback */}
                {source.search_fallback_url && (
                  <a
                    href={source.search_fallback_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    <Search className="h-3 w-3" />
                    Search Fallback
                  </a>
                )}
              </div>

              {/* Metrics */}
              {Object.keys(source.metrics).length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {Object.entries(source.metrics).map(([key, val]) => (
                    <span
                      key={key}
                      className="inline-flex items-center rounded-md bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-400"
                    >
                      {key}: <span className="ml-0.5 text-gray-300">{String(val)}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Verified status */}
            <div className="shrink-0">
              {source.is_accessible ? (
                <CheckCircle className="h-4 w-4 text-emerald-400" />
              ) : (
                <XCircle className="h-4 w-4 text-red-400" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
