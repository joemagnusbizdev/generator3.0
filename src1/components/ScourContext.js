import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { apiFetchJson, apiPostJson } from "../lib/utils/api";
// ============================================================================
// CONTEXT
// ============================================================================
const ScourContext = createContext(undefined);
export const useScour = () => {
    const ctx = useContext(ScourContext);
    if (!ctx)
        throw new Error("useScour must be used within a ScourProvider");
    return ctx;
};
// ============================================================================
// PROVIDER
// ============================================================================
export const ScourProvider = ({ children, accessToken: defaultAccessToken, }) => {
    const [isScouring, setIsScouring] = useState(false);
    const [scourJob, setScourJob] = useState(null);
    const [jobId, setJobId] = useState(null);
    const [lastResult, setLastResult] = useState(null);
    const [lastError, setLastError] = useState(null);
    const [lastStartedAt, setLastStartedAt] = useState(null);
    const [lastFinishedAt, setLastFinishedAt] = useState(null);
    const [activeJobs, setActiveJobs] = useState(new Map());
    const pollIntervalRef = useRef(null);
    const activeJobsRef = useRef(new Map());
    // Sync isScouring with activeJobs - only true if any jobs are running
    useEffect(() => {
        const hasRunningJobs = Array.from(activeJobs.values()).some(job => job.status === 'running');
        setIsScouring(hasRunningJobs);
    }, [activeJobs]);
    const stopPolling = useCallback(() => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
    }, []);
    const pollStatus = useCallback(async (currentJobId, token) => {
        const res = await apiFetchJson(`/scour/status?jobId=${encodeURIComponent(currentJobId)}`, token);
        if (!res?.ok || !res.job) {
            console.log(`[ScourContext.pollStatus] Response not ok or missing job:`, { ok: res?.ok, hasJob: !!res?.job });
            return;
        }
        const job = res.job;
        console.log(`[ScourContext.pollStatus] Got job for ${currentJobId}: status=${job.status}`);
        // Update both the primary scourJob (for main UI) and activeJobs map (for tracking multiple jobs)
        setScourJob(job);
        setActiveJobs(prev => {
            const updated = new Map(prev);
            updated.set(currentJobId, job);
            return updated;
        });
        if (job.status === "done" || job.status === "error") {
            // Job finished - remove from active jobs
            setActiveJobs(prev => {
                const updated = new Map(prev);
                updated.delete(currentJobId);
                // useEffect will automatically set isScouring based on remaining jobs
                return updated;
            });
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
            }
            else {
                const firstErr = job.errors?.[0]?.reason || "Scour failed";
                setLastError(firstErr);
            }
            stopPolling();
        }
    }, [stopPolling]);
    // Helper to trigger next batch of scour
    const triggerNextBatch = useCallback(async (jobId, offset, token) => {
        try {
            console.log(`[Scour] Triggering batch at offset ${offset}`);
            const batchRes = await apiPostJson("/scour-sources-v2", {
                jobId,
                batchOffset: offset
            }, token || defaultAccessToken);
            if (!batchRes.ok) {
                console.error(`[Scour] Batch failed:`, batchRes);
                setLastError(batchRes.error || "Batch processing failed");
                // Remove job from activeJobs - useEffect will update isScouring
                setActiveJobs(prev => {
                    const updated = new Map(prev);
                    updated.delete(jobId);
                    return updated;
                });
                return;
            }
            // Update progress (accumulate across batches)
            if (batchRes.processed !== undefined) {
                setScourJob(prev => prev ? { ...prev, processed: prev.processed + batchRes.processed } : prev);
            }
            if (batchRes.created !== undefined) {
                setScourJob(prev => prev ? { ...prev, created: prev.created + batchRes.created } : prev);
            }
            if (batchRes.duplicatesSkipped !== undefined) {
                setScourJob(prev => prev ? { ...prev, duplicatesSkipped: prev.duplicatesSkipped + batchRes.duplicatesSkipped } : prev);
            }
            if (batchRes.errorCount !== undefined) {
                setScourJob(prev => prev ? { ...prev, errorCount: prev.errorCount + batchRes.errorCount } : prev);
            }
            if (batchRes.errors && Array.isArray(batchRes.errors)) {
                setScourJob(prev => prev ? {
                    ...prev,
                    errors: [...(prev.errors || []), ...batchRes.errors.map((e) => ({
                            reason: typeof e === 'string' ? e : e.reason || 'Unknown error'
                        }))]
                } : prev);
            }
            if (batchRes.phase) {
                setScourJob(prev => prev ? { ...prev, phase: batchRes.phase } : prev);
            }
            if (batchRes.earlySignalsActive !== undefined) {
                setScourJob(prev => prev ? { ...prev, currentActivity: batchRes.earlySignalsActive ? '⚡ Running early signal queries...' : undefined } : prev);
            }
            // Trigger next batch if more remain
            if (batchRes.hasMoreBatches && batchRes.nextBatchOffset !== undefined) {
                console.log(`[Scour] More batches remain, triggering offset ${batchRes.nextBatchOffset}`);
                setTimeout(() => triggerNextBatch(jobId, batchRes.nextBatchOffset, token), 1000);
            }
            else {
                console.log(`[Scour] All batches complete!`);
                setScourJob(prev => prev ? { ...prev, status: "done", phase: "done" } : prev);
                // Remove job from activeJobs - useEffect will update isScouring
                setActiveJobs(prev => {
                    const updated = new Map(prev);
                    updated.delete(jobId);
                    return updated;
                });
            }
        }
        catch (e) {
            console.error(`[Scour] Batch trigger error:`, e);
            setLastError(e.message || "Failed to trigger next batch");
            // Remove job from activeJobs - useEffect will update isScouring
            setActiveJobs(prev => {
                const updated = new Map(prev);
                updated.delete(jobId);
                return updated;
            });
        }
    }, [defaultAccessToken]);
    const startScour = useCallback(async (accessToken, opts) => {
        const token = accessToken || defaultAccessToken;
        try {
            // Don't set global isScouring here - track via activeJobs instead
            setLastError(null);
            setLastStartedAt(new Date().toISOString());
            console.log(`[Scour] Starting batch-based scour with ${opts?.daysBack || 14} days back`);
            const startRes = await apiPostJson("/scour-sources-v2", {
                daysBack: opts?.daysBack || 14,
                batchOffset: 0 // Start from beginning
            }, token);
            if (!startRes.ok || !startRes.jobId) {
                console.error(`[Scour] Start failed:`, startRes);
                throw new Error(startRes.error || "Failed to start scour job");
            }
            const newJobId = startRes.jobId;
            setJobId(newJobId);
            const jobData = {
                id: newJobId,
                status: "running",
                phase: "main_scour",
                total: startRes.totalSources || 0,
                processed: 0,
                created: 0,
                duplicatesSkipped: 0,
                lowConfidenceSkipped: 0,
                errorCount: 0,
            };
            console.log(`[Scour] Setting scourJob state:`, jobData);
            setScourJob(jobData);
            // Add to activeJobs so useEffect can manage isScouring
            setActiveJobs(prev => {
                const updated = new Map(prev);
                updated.set(newJobId, jobData);
                return updated;
            });
            // If more batches remain, trigger next batch
            if (startRes.hasMoreBatches && startRes.nextBatchOffset !== undefined) {
                console.log(`[Scour] Batch complete, triggering next batch at offset ${startRes.nextBatchOffset}`);
                setTimeout(() => triggerNextBatch(newJobId, startRes.nextBatchOffset, token), 1000);
            }
            stopPolling();
            // Start polling (interval will adjust based on phase)
            pollIntervalRef.current = setInterval(() => {
                pollStatus(newJobId, token);
            }, 2500);
            setTimeout(() => pollStatus(newJobId, token), 200);
        }
        catch (e) {
            const errorMsg = e?.message || "Failed to start scour";
            console.error(`[Scour Error]`, errorMsg);
            setLastError(errorMsg);
            stopPolling();
            // useEffect will set isScouring based on activeJobs
        }
    }, [defaultAccessToken, pollStatus, stopPolling]);
    const stopScour = useCallback(async () => {
        // Call backend to set stop flag
        if (jobId) {
            try {
                console.log(`[Scour] Requesting stop for job ${jobId}`);
                await apiPostJson(`/scour/stop/${jobId}`, {}, defaultAccessToken);
                // Remove from activeJobs - useEffect will update isScouring
                setActiveJobs(prev => {
                    const updated = new Map(prev);
                    updated.delete(jobId);
                    return updated;
                });
            }
            catch (e) {
                console.warn(`[Scour] Failed to notify backend of stop:`, e);
            }
        }
        // Stop frontend polling immediately
        stopPolling();
    }, [jobId, defaultAccessToken, stopPolling]);
    // Helper methods for direct job management (used by Early Signals)
    const setScourJobHelper = useCallback((job) => {
        console.log(`[Scour] Directly setting scourJob:`, job);
        setScourJob(job);
    }, []);
    const setJobIdHelper = useCallback((newJobId) => {
        console.log(`[Scour] Directly setting jobId:`, newJobId);
        setJobId(newJobId);
    }, []);
    const startJobPolling = useCallback((newJobId, token) => {
        console.log(`[Scour] Starting polling for jobId:`, newJobId);
        setJobId(newJobId);
        setLastError(null);
        // Add placeholder job to activeJobs - pollStatus will update it
        // This ensures useEffect sets isScouring=true before first poll
        setActiveJobs(prev => {
            const updated = new Map(prev);
            updated.set(newJobId, {
                id: newJobId,
                status: 'running',
                phase: 'early_signals',
                total: 0,
                processed: 0,
                created: 0,
                duplicatesSkipped: 0,
                lowConfidenceSkipped: 0,
                errorCount: 0,
            });
            return updated;
        });
        // Start polling with fast interval for early signals
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
        }
        pollIntervalRef.current = setInterval(() => {
            pollStatus(newJobId, token || defaultAccessToken);
        }, 400); // Fast polling for real-time updates
    }, [pollStatus, defaultAccessToken]);
    // Emergency hard reset - clears all UI state
    const hardReset = useCallback(() => {
        console.log('🔄 [HARD RESET] Clearing all state...');
        setIsScouring(false);
        setScourJob(null);
        setJobId(null);
        setLastResult(null);
        setLastError(null);
        setLastStartedAt(null);
        setLastFinishedAt(null);
        setActiveJobs(new Map());
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
        }
    }, []);
    const value = {
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
        setScourJob: setScourJobHelper,
        setJobId: setJobIdHelper,
        startJobPolling,
        activeJobs,
        isJobRunning: (jobId) => activeJobs.has(jobId) && activeJobs.get(jobId)?.status === 'running',
        hardReset,
    };
    return _jsx(ScourContext.Provider, { value: value, children: children });
};
export default ScourContext;
