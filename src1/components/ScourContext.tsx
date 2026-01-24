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

  const startScour = useCallback(
    async (accessToken?: string, opts?: ScourStartOpts) => {
      const token = accessToken || defaultAccessToken;

      try {
        setIsScouring(true);
        setLastError(null);
        setLastStartedAt(new Date().toISOString());

        let sourceIds = Array.isArray(opts?.sourceIds) ? opts!.sourceIds! : [];

        // If none provided, fetch enabled sources
        if (sourceIds.length === 0) {
          const sourcesRes = await apiFetchJson<{ ok: boolean; sources?: Array<{ id: string; enabled: boolean }> }>(
            "/sources?pageSize=1000",
            token
          );

          const allSources = sourcesRes.sources || [];
          const enabled = allSources.filter((s) => s.enabled).map((s) => s.id);
          sourceIds = enabled;
          
          console.log(`[Scour] Fetched sources: total=${allSources.length}, enabled=${enabled.length}`);
        }

        if (sourceIds.length === 0) {
          throw new Error(`No enabled sources available to scour (checked sources endpoint)`);
        }

        console.log(`[Scour] Starting with ${sourceIds.length} sources:`, sourceIds);

        const startRes = await apiPostJson<{ ok: boolean; jobId?: string; total?: number; error?: string; debugInfo?: any }>(
          "/scour-sources",
          { sourceIds, daysBack: opts?.daysBack || 14 },
          token
        );

        if (!startRes.ok || !startRes.jobId) {
          console.error(`[Scour] Start failed:`, startRes);
          throw new Error(startRes.error || "Failed to start scour job");
        }

        const newJobId = startRes.jobId;
        setJobId(newJobId);

        setScourJob({
          id: newJobId,
          status: "running",
          total: startRes.total || sourceIds.length,
          processed: 0,
          created: 0,
          duplicatesSkipped: 0,
          lowConfidenceSkipped: 0,
          errorCount: 0,
        });

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

  return <ScourContext.Provider value={value}>{children}</ScourContext.Provider>;
};

export default ScourContext;
