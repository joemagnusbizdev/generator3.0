import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { apiFetchJson, apiPostJson } from "../lib/utils/api";

// ============================================================================
// TYPES
// ============================================================================

export interface ScourJob {
  id: string;
  status: "running" | "done" | "error";
  phase?: "main_scour" | "early_signals" | "finalizing" | "done";
  currentEarlySignalQuery?: string;
  total: number;
  processed: number;
  created: number;
  duplicatesSkipped?: number;
  lowConfidenceSkipped?: number;
  errorCount?: number;
  errors?: Array<{ sourceId?: string; reason?: string }>;
  updated_at?: string;
  created_at?: string;
  ai_engaged?: boolean;
  currentSource?: string;
  currentActivity?: string;
  activityLog?: Array<{ time: string; message: string }>;
  aiActive?: boolean;
  braveActive?: boolean;
  extractActive?: boolean;
  dupeCheckActive?: boolean;
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
  const ctx = useContext(ScourContext);
  if (!ctx) throw new Error("useScour must be used within a ScourProvider");
  return ctx;
};

// ============================================================================
// PROVIDER
// ============================================================================

export const ScourProvider: React.FC<{ children: React.ReactNode; accessToken?: string }> = ({
  children,
  accessToken: defaultAccessToken,
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

  const pollStatus = useCallback(
    async (currentJobId: string, token?: string) => {
      const res = await apiFetchJson<{ ok: boolean; job?: ScourJob; error?: string }>(
        `/scour/status?jobId=${encodeURIComponent(currentJobId)}`,
        token
      );

      if (!res?.ok || !res.job) return;

      const job = res.job;
      setScourJob(job);

      if (job.status === "done" || job.status === "error") {
        setIsScouring(false);
        setLastFinishedAt(new Date().toISOString());

        if (job.status === "done") {
          setLastResult({
            processed: job.processed || 0,
            created: job.created || 0,
            duplicatesSkipped: job.duplicatesSkipped || 0,
            lowConfidenceSkipped: job.lowConfidenceSkipped || 0,
            errorCount: job.errorCount || 0,
          });
          setLastError(null);
        } else {
          const firstErr = job.errors?.[0]?.reason || "Scour failed";
          setLastError(firstErr);
        }

        stopPolling();
      }
    },
    [stopPolling]
  );

  // Helper to trigger next batch of scour
  const triggerNextBatch = useCallback(
    async (jobId: string, offset: number, token?: string) => {
      try {
        console.log(`[Scour] Triggering batch at offset ${offset}`);
        
        const batchRes = await apiPostJson<{
          ok: boolean;
          status?: string;
          hasMoreBatches?: boolean;
          nextBatchOffset?: number;
          processed?: number;
          created?: number;
          error?: string;
        }>(
          "/scour-sources-v2",
          {
            jobId,
            batchOffset: offset
          },
          token || defaultAccessToken
        );

        if (!batchRes.ok) {
          console.error(`[Scour] Batch failed:`, batchRes);
          setLastError(batchRes.error || "Batch processing failed");
          setIsScouring(false);
          return;
        }

        // Update progress (accumulate across batches)
        if (batchRes.processed !== undefined) {
          setScourJob(prev => prev ? { ...prev, processed: prev.processed + batchRes.processed! } : prev);
        }
        if (batchRes.created !== undefined) {
          setScourJob(prev => prev ? { ...prev, created: prev.created + batchRes.created! } : prev);
        }

        // Trigger next batch if more remain
        if (batchRes.hasMoreBatches && batchRes.nextBatchOffset !== undefined) {
          console.log(`[Scour] More batches remain, triggering offset ${batchRes.nextBatchOffset}`);
          setTimeout(() => triggerNextBatch(jobId, batchRes.nextBatchOffset!, token), 1000);
        } else {
          console.log(`[Scour] All batches complete!`);
          setScourJob(prev => prev ? { ...prev, status: "done" } : prev);
          setIsScouring(false);
        }
      } catch (e: any) {
        console.error(`[Scour] Batch trigger error:`, e);
        setLastError(e.message || "Failed to trigger next batch");
        setIsScouring(false);
      }
    },
    [defaultAccessToken]
  );

  const startScour = useCallback(
    async (accessToken?: string, opts?: ScourStartOpts) => {
      const token = accessToken || defaultAccessToken;

      try {
        setIsScouring(true);
        setLastError(null);
        setLastStartedAt(new Date().toISOString());

        console.log(`[Scour] Starting batch-based scour with ${opts?.daysBack || 14} days back`);

        const startRes = await apiPostJson<{ 
          ok: boolean; 
          jobId?: string; 
          status?: string;
          totalSources?: number;
          hasMoreBatches?: boolean;
          nextBatchOffset?: number;
          error?: string;
        }>(
          "/scour-sources-v2",
          { 
            daysBack: opts?.daysBack || 14,
            batchOffset: 0  // Start from beginning
          },
          token
        );

        if (!startRes.ok || !startRes.jobId) {
          console.error(`[Scour] Start failed:`, startRes);
          throw new Error(startRes.error || "Failed to start scour job");
        }

        const newJobId = startRes.jobId;
        setJobId(newJobId);

        const jobData: ScourJob = {
          id: newJobId,
          status: "running",
          total: startRes.totalSources || 0,
          processed: 0,
          created: 0,
          duplicatesSkipped: 0,
          lowConfidenceSkipped: 0,
          errorCount: 0,
        };
        
        console.log(`[Scour] Setting scourJob state:`, jobData);
        setScourJob(jobData);

        // If more batches remain, trigger next batch
        if (startRes.hasMoreBatches && startRes.nextBatchOffset !== undefined) {
          console.log(`[Scour] Batch complete, triggering next batch at offset ${startRes.nextBatchOffset}`);
          setTimeout(() => triggerNextBatch(newJobId, startRes.nextBatchOffset!, token), 1000);
        }

        stopPolling();
        pollIntervalRef.current = setInterval(() => {
          pollStatus(newJobId, token);
        }, 2500);

        setTimeout(() => pollStatus(newJobId, token), 600);
      } catch (e: any) {
        const errorMsg = e?.message || "Failed to start scour";
        console.error(`[Scour Error]`, errorMsg);
        setLastError(errorMsg);
        setIsScouring(false);
        stopPolling();
      }
    },
    [defaultAccessToken, pollStatus, stopPolling]
  );

  const stopScour = useCallback(async () => {
    // Call backend to set stop flag
    if (jobId) {
      try {
        console.log(`[Scour] Requesting stop for job ${jobId}`);
        await apiPostJson(
          `/scour/stop/${jobId}`,
          {},
          defaultAccessToken
        );
      } catch (e) {
        console.warn(`[Scour] Failed to notify backend of stop:`, e);
      }
    }
    
    // Stop frontend polling immediately
    setIsScouring(false);
    stopPolling();
  }, [jobId, defaultAccessToken, stopPolling]);

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

  return <ScourContext.Provider value={value}>{children}</ScourContext.Provider>;
};

export default ScourContext;
