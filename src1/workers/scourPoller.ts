/**
 * Web Worker for polling scour job status
 * This worker runs in a separate thread to avoid blocking the UI
 */

interface PollConfig {
  apiBase: string;
  token?: string;
  jobId: string;
  pollMs: number;
}

interface JobStatus {
  id: string;
  status: 'running' | 'done';
  sourceIds?: string[];
  nextIndex?: number;
  processed?: number;
  created?: number;
  duplicatesSkipped?: number;
  lowConfidenceSkipped?: number;
  errors?: Array<{ sourceId: string; reason: string }>;
  rejections?: Array<{ sourceId: string; reason: string; query?: string }>;
  updated_at?: string;
  created_at?: string;
  total?: number;
  errorCount?: number;
}

interface StatusResponse {
  ok: boolean;
  job?: JobStatus;
  error?: string;
}

let polling = false;
let pollInterval: ReturnType<typeof setInterval> | null = null;

async function pollStatus(config: PollConfig): Promise<void> {
  const { apiBase, token, jobId, pollMs } = config;
  
  const fetchStatus = async (): Promise<void> => {
    try {
      const url = `${apiBase}/scour/status?jobId=${encodeURIComponent(jobId)}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        throw new Error(`Poll failed: ${response.status}`);
      }

      const data: StatusResponse = await response.json();
      
      if (data.ok && data.job) {
        const job = data.job;
        
        // Send status update to main thread
        self.postMessage({
          type: 'status',
          payload: {
            jobId: job.id,
            status: job.status,
            total: job.total ?? job.sourceIds?.length ?? 0,
            nextIndex: job.nextIndex ?? 0,
            processed: job.processed ?? 0,
            created: job.created ?? 0,
            duplicatesSkipped: job.duplicatesSkipped ?? 0,
            lowConfidenceSkipped: job.lowConfidenceSkipped ?? 0,
            errorCount: job.errorCount ?? job.errors?.length ?? 0,
            errorsThisCall: job.errors ?? [],
            rejectionsThisCall: job.rejections ?? [],
            lastUpdateTs: job.updated_at ?? new Date().toISOString(),
          },
        });

        // Stop polling if job is done
        if (job.status === 'done') {
          stopPolling();
          self.postMessage({ type: 'done', jobId });
        }
      } else if (data.error) {
        self.postMessage({ type: 'error', error: data.error });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown polling error';
      self.postMessage({ type: 'error', error: message });
    }
  };

  // Initial fetch
  await fetchStatus();
  
  // Set up interval polling
  pollInterval = setInterval(fetchStatus, pollMs);
}

function stopPolling(): void {
  polling = false;
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

// Handle messages from main thread
self.onmessage = (event: MessageEvent) => {
  const { type, ...config } = event.data;

  switch (type) {
    case 'start':
      if (!polling) {
        polling = true;
        pollStatus(config as PollConfig);
      }
      break;
      
    case 'stop':
      stopPolling();
      self.postMessage({ type: 'stopped' });
      break;
      
    default:
      console.warn('Unknown message type:', type);
  }
};

// Export empty object for module compatibility
export {};





