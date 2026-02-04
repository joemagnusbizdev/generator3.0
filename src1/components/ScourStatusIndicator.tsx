import React, { useEffect, useState } from 'react';

interface ActiveJob {
  id: string;
  status: string;
  phase: string;
  processed: number;
  total: number;
  created: number;
  sources_count: number;
  started_at?: string;
  current_source?: string;
}

interface ScourStatusResponse {
  ok: boolean;
  active_jobs: ActiveJob[];
  has_active_job: boolean;
  job_count: number;
}

export function ScourStatusIndicator() {
  const [activeJobs, setActiveJobs] = useState<ActiveJob[]>([]);
  const [isPolling, setIsPolling] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        // Scour-worker doesn't provide a status endpoint
        // Status is managed through component state in ScourManagement
      } catch (e) {
        console.error('Failed to check scour status:', e);
      }
    };

    if (isPolling) {
      checkStatus();
      const interval = setInterval(checkStatus, 3000); // Poll every 3 seconds
      return () => clearInterval(interval);
    }
  }, [isPolling]);

  if (activeJobs.length === 0) {
    return null;
  }

  const job = activeJobs[0]; // Show first active job
  const progress = job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0;

  return (
    <div className="fixed top-0 left-0 right-0 bg-blue-600 text-white px-4 py-3 shadow-lg z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="flex items-center gap-2">
            <div className="animate-spin">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 5.293a1 1 0 011.414 0A7 7 0 0014.707 10a.999.999 0 11-1.414 1.414A5 5 0 005.707 5.707a1 1 0 010-1.414zm11.414 8.414a1 1 0 01-1.414 1.414A7 7 0 015.293 10a.999.999 0 111.414-1.414A5 5 0 0015.707 14.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <div className="font-semibold text-sm">
                🔍 Scour Job Running
              </div>
              <div className="text-xs opacity-90">
                {job.phase}: Processing {job.processed}/{job.total} sources
                {job.current_source && ` • Current: ${job.current_source}`}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Progress bar */}
          <div className="w-48">
            <div className="w-full bg-blue-500 rounded-full h-2 overflow-hidden">
              <div
                className="bg-green-400 h-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-xs text-center mt-1">{progress}%</div>
          </div>

          {/* Stats */}
          <div className="text-xs text-right whitespace-nowrap">
            <div>Created: {job.created}</div>
            <div>{job.sources_count} sources</div>
          </div>

          {/* Close button */}
          <button
            onClick={() => setIsPolling(false)}
            className="ml-2 hover:bg-blue-700 p-1 rounded transition-colors"
            title="Hide indicator"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
