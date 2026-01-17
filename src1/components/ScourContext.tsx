import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { apiFetchJson, apiPostJson } from '../lib/utils/api';

// ============================================================================
// TYPES
// ============================================================================

export interface ScourJob {
  id: string;
  status: 'running' | 'done' | 'error';
  total: number;
  nextIndex?: number;
  processed: number;
  created: number;
  duplicatesSkipped?: number;
  lowConfidenceSkipped?: number;
  errorCount?: number;
  errors?: Array<{ sourceId: string; reason: string }>;
  rejections?: Array<{ sourceId: string; reason: string; query?: string }>;
  updated_at?: string;
  created_at?: string;
  ai_engaged?: boolean;
}

export interface ScourStartOpts {
  sourceIds?: string[];
  daysBack?: number;
}

export interface ScourTotals {
  processed: number;
  created: number;
  duplicatesSkipped: number;
  lowConfidenceSkipped: number;
  errorCount: number;
}

export interface ScourState {
  isScouring: boolean;
  scourJob: ScourJob | null;
  jobId: string | null;
  lastResult: ScourTotals | null;
  lastError: string | null;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
}

export interface ScourContextType extends ScourState {
  startScour: (accessToken?: string, opts?: ScourStartOpts) => Promise<void>;
  runScour: (accessToken?: string, opts?: ScourStartOpts) => Promise<void>;
  stopScour: () => void;
  scourJobId: string | null;
}

// ============================================================================
// CONTEXT
// ============================================================================

const ScourContext = createContext<ScourContextType | undefined>(undefined);

export const useScour = (): ScourContextType => {
  const context = useContext(ScourContext);
  if (!context) {
    throw new Error('useScour must be used within a ScourProvider');
  }
  return context;
};

// ============================================================================
// PROVIDER
// ============================================================================

export const ScourProvider: React.FC<{ children: React.ReactNode; accessToken?: string }> = ({ 
  children,
  accessToken: defaultAccessToken 
}) => {
  const [isScouring, setIsScouring] = useState(false);
  const [scourJob, setScourJob] = useState<ScourJob | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ScourTotals | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastStartedAt, setLastStartedAt] = useState<string | null>(null);
  const [lastFinishedAt, setLastFinishedAt] = useState<string | null>(null);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(async (currentJobId: string, token?: string) => {
    try {
      const response = await apiFetchJson<{ ok: boolean; job?: ScourJob }>(
        `/scour/status?jobId=${encodeURIComponent(currentJobId)}`,
        token
      );

      if (response.ok && response.job) {
        const job = response.job;
        setScourJob(job);

        if (job.status === 'done' || job.status === 'error') {
          setIsScouring(false);
          setLastFinishedAt(new Date().toISOString());
          
          if (job.status === 'done') {
            setLastResult({
              processed: job.processed || 0,
              created: job.created || 0,
              duplicatesSkipped: job.duplicatesSkipped || 0,
              lowConfidenceSkipped: job.lowConfidenceSkipped || 0,
              errorCount: job.errorCount || 0,
            });
            setLastError(null);
          } else {
            setLastError(job.errors?.[0]?.reason || 'Scour failed');
          }
          
          stopPolling();
        }
      }
    } catch (error: any) {
      console.error('Poll error:', error);
      setLastError(error.message || 'Polling failed');
      setIsScouring(false);
      stopPolling();
    }
  }, [stopPolling]);

  const startScour = useCallback(async (accessToken?: string, opts?: ScourStartOpts) => {
    const token = accessToken || defaultAccessToken;
    
    try {
      setIsScouring(true);
      setLastError(null);
      setLastStartedAt(new Date().toISOString());

      let sourceIds = opts?.sourceIds || [];

      // If no sourceIds provided, fetch all enabled sources
      if (sourceIds.length === 0) {
        console.log('Ã¢Å¡Â Ã¯Â¸Â  No sourceIds provided - fetching enabled sources...');
        try {
          const sourcesResponse = await apiFetchJson<{ ok: boolean; sources: Array<{ id: string; enabled: boolean }> }>(
            '/sources',
            token
          );

          if (sourcesResponse.ok && Array.isArray(sourcesResponse.sources)) {
            sourceIds = sourcesResponse.sources
              .filter(s => s.enabled)
              .map(s => s.id);
            
            console.log(`Ã¢Å“â€¦ Fetched ${sourceIds.length} enabled sources`);
          } else {
            throw new Error('Failed to fetch sources');
          }
        } catch (fetchErr: any) {
          console.error('Failed to fetch sources:', fetchErr);
          throw new Error(`Cannot start scour: ${fetchErr.message}`);
        }
      }

      if (sourceIds.length === 0) {
        throw new Error('No enabled sources available to scour');
      }

      console.log(`Ã°Å¸Å¡â‚¬ Starting scour with ${sourceIds.length} sources`);

      // Start the scour job
      const response = await apiPostJson<{
        ok: boolean;
        jobId: string;
        status: string;
        total: number;
        message?: string;
      }>('/scour-sources', {
        sourceIds,
        daysBack: opts?.daysBack || 14,
      }, token);

      if (response.ok && response.jobId) {
        const newJobId = response.jobId;
        setJobId(newJobId);
        
        // Initialize job state
        setScourJob({
          id: newJobId,
          status: 'running',
          total: response.total || sourceIds.length,
          processed: 0,
          created: 0,
          duplicatesSkipped: 0,
          lowConfidenceSkipped: 0,
          errorCount: 0,
        });

        // Start polling
        stopPolling();
        pollIntervalRef.current = setInterval(() => {
          pollStatus(newJobId, token);
        }, 3000);

        // Do immediate first poll
        setTimeout(() => pollStatus(newJobId, token), 1000);
      } else {
        throw new Error('Failed to start scour job');
      }
    } catch (error: any) {
      console.error('Start scour error:', error);
      setLastError(error.message || 'Failed to start scour');
      setIsScouring(false);
      stopPolling();
    }
  }, [defaultAccessToken, stopPolling, pollStatus]);

  const stopScour = useCallback(() => {
    setIsScouring(false);
    stopPolling();
  }, [stopPolling]);

  const value: ScourContextType = {
    isScouring,
    scourJob,
    jobId,
    lastResult,
    lastError,
    lastStartedAt,
    lastFinishedAt,
    startScour,
    runScour: startScour,
    stopScour,
    scourJobId: jobId,
  };

  return (
    <ScourContext.Provider value={value}>
      {children}
    </ScourContext.Provider>
  );
};

export default ScourContext;
