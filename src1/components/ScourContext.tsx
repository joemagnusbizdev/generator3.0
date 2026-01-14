/**
 * ScourContext - React context for server-side source scanning
 */
import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { getApiUrl } from '../lib/supabase/api';

// ============================================================================
// Types
// ============================================================================
// Add this constant at the top of ScourContext.tsx (after imports)
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdub2JueXplemt1eXB0dWFrenRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM4MTA5MywiZXhwIjoyMDgzOTU3MDkzfQ.tX4M3i08_d8P1gCTL37XogysPgAac-7Et09godBSdNA';

// Then update the scourSources function (around line 200):
const scourSources = useCallback(async (
  sourceIds?: string[],
  maxSources?: number,
  daysBack?: number
) => {
  setIsScourRunning(true);
  setScourError(null);
  setScourProgress({ processed: 0, total: 0, currentSource: '' });

  const payload: any = {};
  if (sourceIds && sourceIds.length > 0) payload.sourceIds = sourceIds;
  if (maxSources) payload.maxSources = maxSources;
  if (daysBack) payload.daysBack = daysBack;

  try {
    const res = await fetch(getApiUrl('/scour-sources'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,  // ← ADD THIS LINE
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Scour failed: ${res.status} ${errorText}`);
    }

    const data = await res.json();
    
    if (data.jobId) {
      pollScourStatus(data.jobId);
    } else {
      setIsScourRunning(false);
      await refreshAll();
    }
  } catch (err: any) {
    console.error('Scour error:', err);
    setScourError(err.message);
    setIsScourRunning(false);
  }
}, [pollScourStatus, refreshAll]);
export interface ScourStartOpts {
  maxSources?: number;
  batchSize?: number;
  sourceIds?: string[];
  jobId?: string;
}

export interface ScourTotals {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  jobId?: string;
  status: 'running' | 'done';
  total: number;
  nextIndex: number;
  processed: number;
  created: number;
  duplicatesSkipped: number;
  lowConfidenceSkipped: number;
  errorCount: number;
  errorsThisCall: Array<{ sourceId: string; reason: string }>;
  rejectionsThisCall: Array<{ sourceId: string; reason: string; query?: string }>;
  processedThisCall?: number;
  createdThisCall?: number;
  done?: boolean;
  partial?: boolean;
  lastUpdateTs?: string;
}

export interface JobStatusResp {
  ok: boolean;
  job?: {
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
  };
}

export interface HealthInfo {
  ok: boolean;
  time?: string;
  env?: {
    AUTO_SCOUR_ENABLED?: boolean;
    AI_ENABLED?: boolean;
    SCOUR_ENABLED?: boolean;
    [key: string]: unknown;
  };
}

export interface ScourState {
  isScouring: boolean;
  isRunning: boolean;
  lastError: string | null;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastScouredIso: string | null;
  health: HealthInfo | null;
  autoEnabled: boolean;
  jobId: string | null;
  // Alias for compatibility with components expecting scourJobId
  scourJobId: string | null;
  job: JobStatusResp['job'] | null;
  lastResult: ScourTotals | null;
  startScour: (opts?: ScourStartOpts) => Promise<void>;
  // Alias for compatibility with components expecting runScour
  runScour: (opts?: ScourStartOpts) => Promise<void>;
  cancelScour: () => void;
  refreshLastScoured: () => Promise<void>;
  refreshHealth: () => Promise<void>;
  refreshJob: (jobId: string) => Promise<void>;
}

// ============================================================================
// Context
// ============================================================================

const ScourContext = createContext<ScourState | null>(null);

export function useScour(): ScourState {
  const ctx = useContext(ScourContext);
  if (!ctx) {
    throw new Error('useScour must be used within a ScourProvider');
  }
  return ctx;
}

// ============================================================================
// Helpers
// ============================================================================

function isoNow(): string {
  return new Date().toISOString();
}

async function fetchJson<T>(
  url: string,
  token?: string,  // Keep parameter for compatibility but don't use it
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,  // ← ALWAYS use service key
    ...(options.headers as Record<string, string> || {}),
  };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request failed ${response.status}: ${text}`);
  }

  return response.json();
}
// ============================================================================
// Provider
// ============================================================================

interface ScourProviderProps {
  children: ReactNode;
  accessToken?: string;
}

export function ScourProvider({ children, accessToken }: ScourProviderProps): JSX.Element {
  const [isScouring, setIsScouring] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastStartedAt, setLastStartedAt] = useState<string | null>(null);
  const [lastFinishedAt, setLastFinishedAt] = useState<string | null>(null);
  const [lastScouredIso, setLastScouredIso] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobStatusResp['job'] | null>(null);
  const [lastResult, setLastResult] = useState<ScourTotals | null>(null);

  const tokenRef = useRef(accessToken);
  const workerRef = useRef<Worker | null>(null);
  const cancelledRef = useRef(false);

  // Update token ref when prop changes
  useEffect(() => {
    tokenRef.current = accessToken;
  }, [accessToken]);

  // Cleanup worker on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  const stopWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'stop' });
      workerRef.current.terminate();
      workerRef.current = null;
    }
  }, []);

  const refreshLastScoured = useCallback(async () => {
    try {
      const url = getApiUrl('/last-scoured');
      const data = await fetchJson<{ lastIso?: string }>(url, tokenRef.current);
      if (data.lastIso) {
        setLastScouredIso(data.lastIso);
      }
    } catch (err) {
      console.warn('Failed to refresh last scoured:', err);
    }
  }, []);

  const refreshHealth = useCallback(async () => {
    try {
      const url = getApiUrl('/health');
      const data = await fetchJson<HealthInfo>(url, tokenRef.current);
      setHealth(data);
      if (data.env?.AUTO_SCOUR_ENABLED) {
        setAutoEnabled(true);
      }
    } catch (err) {
      console.warn('Failed to refresh health:', err);
    }
  }, []);

  const refreshJob = useCallback(async (jid: string) => {
    try {
      const url = getApiUrl(`/scour/status?jobId=${encodeURIComponent(jid)}`);
      const data = await fetchJson<JobStatusResp>(url, tokenRef.current);
      if (data.ok && data.job) {
        setJob(data.job);
      }
    } catch (err) {
      console.warn('Failed to refresh job:', err);
    }
  }, []);

  const startScour = useCallback(async (opts: ScourStartOpts = {}) => {
    cancelledRef.current = false;
    setIsScouring(true);
    setLastError(null);
    setLastStartedAt(isoNow());
    setLastFinishedAt(null);
    setJobId(null);
    setJob(null);
    setLastResult(null);
    stopWorker();

    try {
      const url = getApiUrl('/scour-sources');
      // Timeout values aligned with AI guidelines:
      // - callBudgetMs: Total time for this API call (multiple sources)
      // - sourceTimeoutMs: Must exceed Brave(10s) + OpenAI(20s) = 30s minimum
      const body = {
        maxSources: opts.maxSources ?? 25,
        batchSize: opts.batchSize ?? 5, // Smaller batches = more responsive
        sourceIds: opts.sourceIds,
        jobId: opts.jobId,
        daysBack: 14, // AI_DAYS_BACK default per guidelines
        callBudgetMs: 50000, // 50s call budget
        sourceTimeoutMs: 35000, // 35s per source (Brave 10s + OpenAI 20s + buffer)
      };

      const data = await fetchJson<ScourTotals>(url, tokenRef.current, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (data.jobId) {
        const jid = data.jobId;
        setJobId(jid);
        refreshJob(jid);

        // Start the polling worker
        const worker = new Worker(
          new URL('../workers/scourPoller.ts', import.meta.url),
          { type: 'module' }
        );
        workerRef.current = worker;

        worker.onmessage = (event) => {
          const msg = event.data;

          if (msg.type === 'status') {
            setLastResult({
              ok: true,
              jobId: msg.payload.jobId,
              status: msg.payload.status,
              total: msg.payload.total,
              nextIndex: msg.payload.nextIndex,
              processed: msg.payload.processed,
              created: msg.payload.created,
              duplicatesSkipped: msg.payload.duplicatesSkipped,
              lowConfidenceSkipped: msg.payload.lowConfidenceSkipped,
              errorCount: msg.payload.errorCount,
              errorsThisCall: msg.payload.errorsThisCall,
              rejectionsThisCall: msg.payload.rejectionsThisCall,
              lastUpdateTs: msg.payload.lastUpdateTs,
            });

            if (msg.payload.status === 'done') {
              setIsScouring(false);
              setLastFinishedAt(isoNow());
              refreshLastScoured();
              refreshHealth();
              stopWorker();
            }
          } else if (msg.type === 'error') {
            setLastError(msg.error);
          } else if (msg.type === 'done') {
            setIsScouring(false);
            setLastFinishedAt(isoNow());
            refreshLastScoured();
            refreshHealth();
            stopWorker();
          }
        };

        worker.onerror = (err) => {
          setLastError(err.message);
          setIsScouring(false);
          stopWorker();
        };

        // Start polling
        worker.postMessage({
          type: 'start',
          apiBase: getApiUrl(''),
          token: tokenRef.current,
          jobId: jid,
          pollMs: 1500,
        });
      } else {
        // No job ID - immediate completion or skipped
        setIsScouring(false);
        setLastFinishedAt(isoNow());
        setLastResult(data);
        refreshLastScoured();
        refreshHealth();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start scour';
      setLastError(message);
      setIsScouring(false);
      setLastFinishedAt(isoNow());
    }
  }, [refreshJob, refreshLastScoured, refreshHealth, stopWorker]);

  const cancelScour = useCallback(() => {
    cancelledRef.current = true;
    stopWorker();
    setIsScouring(false);
    setLastFinishedAt(isoNow());
  }, [stopWorker]);

  const state: ScourState = {
    isScouring,
    isRunning: isScouring,
    lastError,
    lastStartedAt,
    lastFinishedAt,
    lastScouredIso,
    health,
    autoEnabled,
    jobId,
    scourJobId: jobId, // Alias for components expecting scourJobId
    job,
    lastResult,
    startScour,
    runScour: startScour, // Alias for components expecting runScour
    cancelScour,
    refreshLastScoured,
    refreshHealth,
    refreshJob,
  };

  return (
    <ScourContext.Provider value={state}>
      {children}
    </ScourContext.Provider>
  );
}

export default ScourContext;
