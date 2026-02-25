import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState, useCallback, useRef } from "react";
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
    const pollIntervalRef = useRef(null);
    const stopPolling = useCallback(() => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
    }, []);
    const pollStatus = useCallback(async (currentJobId, token) => {
        const res = await apiFetchJson(`/scour/status/${encodeURIComponent(currentJobId)}`, token);
        if (!res?.ok || !res.job) {
            console.log(`[ScourContext.pollStatus] Response not ok or missing job:`, { ok: res?.ok, hasJob: !!res?.job });
            return;
        }
        const job = res.job;
        console.log(`[ScourContext.pollStatus] Got job for ${currentJobId}:`, {
            phase: job.phase,
            processed: job.processed,
            created: job.created,
            hasActivityLog: !!job.activityLog,
            activityLogLength: job.activityLog?.length || 0,
            activityLogType: typeof job.activityLog,
            jobKeys: Object.keys(job),
        });
        // Debug: Check what's in activityLog
        if (job.activityLog) {
            console.log(`[ScourContext.pollStatus] First activityLog entry:`, job.activityLog[0]);
            console.log(`[ScourContext.pollStatus] Last activityLog entry:`, job.activityLog[job.activityLog.length - 1]);
        }
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
            }
            else {
                const firstErr = job.errors?.[0]?.reason || "Scour failed";
                setLastError(firstErr);
            }
            stopPolling();
        }
        else if (job.phase === 'early_signals' && pollIntervalRef.current) {
            // During early signals, poll faster to catch query updates
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = setInterval(() => {
                    pollStatus(currentJobId, token);
                }, 400); // Very fast polling for early signals
            }
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
                setIsScouring(false);
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
                setIsScouring(false);
            }
        }
        catch (e) {
            console.error(`[Scour] Batch trigger error:`, e);
            setLastError(e.message || "Failed to trigger next batch");
            setIsScouring(false);
        }
    }, [defaultAccessToken]);
    const startScour = useCallback(async (accessToken, opts) => {
        const token = accessToken || defaultAccessToken;
        try {
            setIsScouring(true);
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
            setIsScouring(false);
            stopPolling();
        }
    }, [defaultAccessToken, pollStatus, stopPolling]);
    const stopScour = useCallback(async () => {
        // Call backend to set stop flag
        if (jobId) {
            try {
                console.log(`[Scour] Requesting stop for job ${jobId}`);
                await apiPostJson(`/scour/stop/${jobId}`, {}, defaultAccessToken);
            }
            catch (e) {
                console.warn(`[Scour] Failed to notify backend of stop:`, e);
            }
        }
        // Stop frontend polling immediately
        setIsScouring(false);
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
        setIsScouring(true);
        setLastError(null);
        // Start polling with fast interval for early signals
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
        }
        pollIntervalRef.current = setInterval(() => {
            pollStatus(newJobId, token || defaultAccessToken);
        }, 400); // Fast polling for real-time updates
    }, [pollStatus, defaultAccessToken]);
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
    };
    return _jsx(ScourContext.Provider, { value: value, children: children });
};
export default ScourContext;
