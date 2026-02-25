import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useScour } from "./ScourContext";
import { apiPostJson } from "../lib/utils/api";
import MAGNUS_COLORS from "../styles/magnus-colors";
const spinnerStyle = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .early-signals-spinner {
    display: inline-block;
    animation: spin 1s linear infinite;
    margin-right: 0.35rem;
  }
`;
export default function ScourStatusBarInline({ accessToken }) {
    const { isScouring, scourJob, stopScour, startScour } = useScour();
    const [runningEarlySignals, setRunningEarlySignals] = useState(false);
    const [earlySignalsProgress, setEarlySignalsProgress] = useState(null);
    const [showErrors, setShowErrors] = useState(false);
    const [showLogs, setShowLogs] = useState(false);
    const [liveLogs, setLiveLogs] = useState([]);
    // DEBUG: Log scourJob changes
    useEffect(() => {
        console.log(`[ScourStatusBarInline] scourJob updated:`, {
            id: scourJob?.id,
            phase: scourJob?.phase,
            status: scourJob?.status,
            processed: scourJob?.processed,
            activityLogLength: scourJob?.activityLog?.length
        });
    }, [scourJob]);
    // Reset early signals flag when scour completes
    useEffect(() => {
        if (!isScouring && scourJob?.status === "done" && runningEarlySignals) {
            setRunningEarlySignals(false);
            setEarlySignalsProgress(null);
        }
    }, [isScouring, scourJob?.status, runningEarlySignals]);
    // Automatically set runningEarlySignals when entering early_signals phase
    useEffect(() => {
        console.log(`[EarlySignals.AutoEnable] Effect triggered:`, {
            phase: scourJob?.phase,
            runningEarlySignals,
            scourJobId: scourJob?.id,
            willSet: scourJob?.phase === 'early_signals' && !runningEarlySignals
        });
        if (scourJob?.phase === 'early_signals' && !runningEarlySignals) {
            console.log(`[EarlySignals] Auto-enabling display for early_signals phase`);
            setRunningEarlySignals(true);
        }
    }, [scourJob?.phase, runningEarlySignals, scourJob?.id]);
    // Fetch live logs from server and parse Early Signals progress
    // Also try to use activityLog from scourJob directly if available
    useEffect(() => {
        console.log(`[EarlySignals.useEffect] Triggered:`, {
            scourJobId: scourJob?.id,
            isScouring,
            phase: scourJob?.phase,
            hasActivityLog: !!scourJob?.activityLog,
            activityLogLength: scourJob?.activityLog?.length,
            activityLogType: typeof scourJob?.activityLog,
            isArray: Array.isArray(scourJob?.activityLog)
        });
        // Check if we're in early signals phase OR actively scouring
        const isEarlySignals = scourJob?.phase === 'early_signals' || runningEarlySignals;
        const shouldDisplay = isScouring || isEarlySignals;
        if (!scourJob?.id || !shouldDisplay) {
            console.log(`[EarlySignals.useEffect] Returning early: scourJobId=${scourJob?.id}, shouldDisplay=${shouldDisplay}`);
            return;
        }
        // First, use activityLog from scourJob if available (already polled every 400ms)
        if (scourJob.activityLog && Array.isArray(scourJob.activityLog) && scourJob.activityLog.length > 0) {
            console.log(`[EarlySignals] Using activityLog from scourJob: ${scourJob.activityLog.length} entries`);
            console.log(`[EarlySignals] First log:`, scourJob.activityLog[0]);
            console.log(`[EarlySignals] Last log:`, scourJob.activityLog[scourJob.activityLog.length - 1]);
            setLiveLogs(scourJob.activityLog);
            // Parse Early Signals progress from logs using progress bar pattern
            // Format: [████████...░░░░░] 1234/3710 (33%) - query text
            const progressLogs = scourJob.activityLog.filter((log) => log.message?.includes('/') && log.message?.includes('%') && log.message?.includes('['));
            if (progressLogs.length > 0) {
                const lastLog = progressLogs[progressLogs.length - 1].message;
                const match = lastLog.match(/(\d+)\/(\d+)\s+\((\d+)%\)/);
                if (match) {
                    const current = parseInt(match[1]);
                    const total = parseInt(match[2]);
                    setEarlySignalsProgress({ current, total });
                }
            }
            return; // Don't need to fetch if we have logs
        }
        else {
            console.log(`[EarlySignals] scourJob.activityLog not available or empty`, {
                hasActivityLog: !!scourJob?.activityLog,
                isArray: Array.isArray(scourJob?.activityLog),
                length: scourJob?.activityLog?.length
            });
        }
        // Fallback: Fetch from logs endpoint if not in scourJob
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clever-function/scour/logs?jobId=${scourJob.id}&limit=300`, { headers: { 'Authorization': `Bearer ${accessToken}` } }).then(r => r.json());
                if (res.ok && res.logs) {
                    console.log(`[EarlySignals] Fetched ${res.logs.length} logs from server endpoint`);
                    setLiveLogs(res.logs);
                    // Parse Early Signals progress from logs using progress bar pattern
                    // Format: [████████...░░░░░] 1234/3710 (33%) - query text
                    const progressLogs = res.logs.filter((log) => log.message?.includes('/') && log.message?.includes('%') && log.message?.includes('['));
                    if (progressLogs.length > 0) {
                        const lastLog = progressLogs[progressLogs.length - 1].message;
                        const match = lastLog.match(/(\d+)\/(\d+)\s+\((\d+)%\)/);
                        if (match) {
                            const current = parseInt(match[1]);
                            const total = parseInt(match[2]);
                            setEarlySignalsProgress({ current, total });
                        }
                    }
                }
                else {
                    console.log(`[EarlySignals] No logs in response or response not ok:`, res);
                }
            }
            catch (e) {
                console.error('[EarlySignals] Error fetching logs:', e);
            }
        }, 2000); // Poll every 2 seconds
        return () => clearInterval(interval);
    }, [scourJob?.id, scourJob?.activityLog?.length, scourJob?.phase, isScouring, runningEarlySignals, accessToken]);
    // Track early signals phase - keep running true while in early_signals phase
    useEffect(() => {
        if (scourJob?.phase === 'early_signals') {
            setRunningEarlySignals(true);
        }
    }, [scourJob?.phase]);
    // Track early signals progress
    useEffect(() => {
        if (scourJob?.phase === "early_signals" && scourJob?.currentEarlySignalQuery) {
            // Parse query count from logs if available
            setEarlySignalsProgress(prev => ({
                ...prev,
                current: (prev?.current || 0) + 1,
                total: 80, // 10 threat types × 8 countries
            }));
        }
    }, [scourJob?.currentEarlySignalQuery, scourJob?.phase]);
    async function runEarlySignals() {
        if (runningEarlySignals || isScouring || !accessToken)
            return;
        setRunningEarlySignals(true);
        try {
            const res = await apiPostJson("/scour-early-signals", {}, accessToken);
            if (res.ok && res.jobId) {
                // Start polling the job status
                await startScour(accessToken, { sourceIds: [] });
            }
            else {
                alert(`Early signals failed: ${res.error || 'Unknown error'}`);
                setRunningEarlySignals(false);
            }
            // Keep runningEarlySignals=true until scour completes
        }
        catch (e) {
            console.error(`Early signals error:`, e);
            alert(`Early signals error: ${e.message}`);
            setRunningEarlySignals(false);
        }
    }
    async function forceStopScour() {
        if (!confirm("Force stop all running scour jobs?")) {
            return;
        }
        if (!accessToken) {
            alert("Not authenticated");
            return;
        }
        try {
            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clever-function/force-stop-scour`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });
            const data = await response.json().catch(() => ({}));
            if (response.ok) {
                console.log('[ForceStop] Backend cleared jobs:', data);
                stopScour();
                // Clear the early signals state immediately
                setRunningEarlySignals(false);
                setEarlySignalsProgress(null);
                alert(`✓ Force stopped: ${data.message || 'all jobs cleared'}`);
            }
            else {
                console.error('[ForceStop] Backend error:', data);
                alert(`⚠️ Error: ${data.error || 'Unknown error'}`);
            }
        }
        catch (e) {
            console.error('[ForceStop] Request failed:', e);
            alert(`❌ Error: ${e.message}`);
        }
    }
    const progressPercent = scourJob && scourJob.total > 0
        ? Math.round((scourJob.processed / scourJob.total) * 100)
        : 0;
    // Early Signals UI
    if (scourJob?.phase === 'early_signals' && runningEarlySignals) {
        return (_jsxs(_Fragment, { children: [_jsx("style", { children: spinnerStyle }), _jsxs("div", { className: "border rounded px-4 py-3 text-sm", style: {
                        backgroundColor: '#fff8f0',
                        borderColor: MAGNUS_COLORS.orange,
                        borderWidth: '3px',
                        marginBottom: '1rem',
                        boxShadow: `0 0 20px rgba(255, 140, 0, 0.3)`,
                    }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '0.5rem' }, children: [_jsx("span", { className: "early-signals-spinner", style: { fontSize: '1.5rem' }, children: "\u26A1" }), _jsx("div", { style: { color: MAGNUS_COLORS.orange, fontWeight: 'bold', fontSize: '1.1rem' }, children: "EARLY SIGNALS - WEB SEARCH IN PROGRESS" })] }), _jsxs("div", { style: { display: 'flex', gap: '0.5rem' }, children: [_jsx("button", { onClick: forceStopScour, style: {
                                                padding: '0.35rem 1rem',
                                                backgroundColor: MAGNUS_COLORS.orange,
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '0.85rem',
                                                fontWeight: 'bold',
                                            }, children: "\u2297 Force Stop" }), _jsx("button", { onClick: () => stopScour(), style: {
                                                padding: '0.35rem 1rem',
                                                backgroundColor: MAGNUS_COLORS.critical,
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '0.85rem',
                                                fontWeight: 'bold',
                                            }, children: "\u23F9 KILL SEARCH" })] })] }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(150px, 1fr))', gap: '1.5rem', marginBottom: '1rem', fontSize: '0.95rem' }, children: [_jsxs("div", { children: [_jsx("div", { style: { color: MAGNUS_COLORS.orange, fontSize: '0.9rem', marginBottom: '0.25rem' }, children: "\uD83D\uDD0D Queries Done" }), _jsx("div", { style: { fontSize: '1.5rem', color: MAGNUS_COLORS.deepGreen, fontWeight: 'bold' }, children: (earlySignalsProgress?.current || 0).toLocaleString() })] }), _jsxs("div", { children: [_jsx("div", { style: { color: MAGNUS_COLORS.orange, fontSize: '0.9rem', marginBottom: '0.25rem' }, children: "\uD83D\uDCCA Total Queries" }), _jsx("div", { style: { fontSize: '1.5rem', color: MAGNUS_COLORS.deepGreen, fontWeight: 'bold' }, children: (earlySignalsProgress?.total || 3710).toLocaleString() })] }), _jsxs("div", { children: [_jsx("div", { style: { color: MAGNUS_COLORS.orange, fontSize: '0.9rem', marginBottom: '0.25rem' }, children: "\u2713 Alerts Found" }), _jsx("div", { style: { fontSize: '1.5rem', color: MAGNUS_COLORS.deepGreen, fontWeight: 'bold' }, children: (scourJob.created || 0).toLocaleString() })] }), _jsxs("div", { children: [_jsx("div", { style: { color: MAGNUS_COLORS.orange, fontSize: '0.9rem', marginBottom: '0.25rem' }, children: "\u23F1 Progress" }), _jsxs("div", { style: { fontSize: '1.5rem', color: '#ff8c00', fontWeight: 'bold' }, children: [earlySignalsProgress?.total ? Math.round(((earlySignalsProgress?.current || 0) / earlySignalsProgress?.total) * 100) : 0, "%"] })] })] }), _jsx("div", { style: {
                                width: '100%',
                                height: '20px',
                                backgroundColor: MAGNUS_COLORS.border,
                                borderRadius: '8px',
                                overflow: 'hidden',
                                marginBottom: '1rem',
                                border: `2px solid ${MAGNUS_COLORS.orange}`,
                            }, children: _jsx("div", { style: {
                                    height: '100%',
                                    width: `${earlySignalsProgress?.total ? Math.round(((earlySignalsProgress?.current || 0) / earlySignalsProgress?.total) * 100) : 0}%`,
                                    backgroundColor: MAGNUS_COLORS.orange,
                                    transition: 'width 0.3s ease',
                                    background: `linear-gradient(90deg, ${MAGNUS_COLORS.orange}, #ff9f1c)`,
                                } }) }), scourJob.currentEarlySignalQuery && (_jsxs("div", { style: {
                                padding: '0.75rem',
                                backgroundColor: 'rgba(255, 140, 0, 0.05)',
                                border: `2px solid ${MAGNUS_COLORS.orange}`,
                                borderRadius: '4px',
                                fontSize: '0.95rem',
                                fontFamily: 'monospace',
                                color: MAGNUS_COLORS.orange,
                                fontWeight: 'bold',
                                marginBottom: '0.5rem',
                            }, children: [_jsx("div", { style: { marginBottom: '0.25rem' }, children: "\uD83C\uDF0D Current Query:" }), _jsx("div", { style: { paddingLeft: '1rem', fontSize: '0.9rem' }, children: scourJob.currentEarlySignalQuery })] })), _jsxs("div", { style: {
                                padding: '0.75rem 1rem',
                                backgroundColor: 'rgba(255, 140, 0, 0.05)',
                                borderLeft: `4px solid ${MAGNUS_COLORS.orange}`,
                                borderRadius: '4px',
                                fontSize: '0.9rem',
                                color: MAGNUS_COLORS.deepGreen,
                            }, children: [_jsx("div", { style: { marginBottom: '0.5rem', fontWeight: 'bold' }, children: "\uD83D\uDCCD Query Progress" }), _jsxs("div", { style: { marginBottom: '0.25rem' }, children: [(earlySignalsProgress?.current || 0).toLocaleString(), " of ", (earlySignalsProgress?.total || 3710).toLocaleString(), " searches completed"] }), _jsx("div", { style: { marginBottom: '0.25rem' }, children: earlySignalsProgress?.total ? `⏱ ~${Math.ceil(((earlySignalsProgress?.total - (earlySignalsProgress?.current || 0)) * 15) / 60)} minutes remaining at current rate` : 'Initializing...' }), _jsx("div", { style: { color: MAGNUS_COLORS.orange, fontWeight: 'bold' }, children: "Rate: ~1 query/second (throttled for API stability)" })] }), _jsxs("div", { style: {
                                marginTop: '1rem',
                                padding: '0.75rem',
                                backgroundColor: 'rgba(255, 140, 0, 0.03)',
                                border: `1px solid ${MAGNUS_COLORS.border}`,
                                borderRadius: '4px',
                                maxHeight: '250px',
                                overflowY: 'auto',
                                fontFamily: 'monospace',
                            }, children: [_jsxs("div", { style: { fontSize: '0.85rem', fontWeight: 'bold', color: MAGNUS_COLORS.orange, marginBottom: '0.5rem' }, children: ["\uD83D\uDCCB Activity Log (", liveLogs.length, " entries)"] }), liveLogs.length === 0 ? (_jsx("div", { style: { fontSize: '0.8rem', color: MAGNUS_COLORS.border, padding: '0.5rem' }, children: "Waiting for logs from server..." })) : (liveLogs
                                    .slice(-12)
                                    .map((log, idx) => (_jsxs("div", { style: {
                                        fontSize: '0.75rem',
                                        color: MAGNUS_COLORS.deepGreen,
                                        padding: '0.35rem 0.5rem',
                                        marginBottom: '0.25rem',
                                        backgroundColor: 'rgba(255, 140, 0, 0.05)',
                                        borderLeft: `2px solid ${MAGNUS_COLORS.orange}`,
                                        borderRadius: '2px',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                    }, children: [_jsx("span", { style: { color: MAGNUS_COLORS.orange }, children: new Date(log.time).toLocaleTimeString() }), ' ', " ", log.message] }, idx))))] })] }), _jsx("div", { className: "border rounded px-4 py-3 text-sm transition-opacity duration-200", style: {
                        backgroundColor: MAGNUS_COLORS.offWhite,
                        borderColor: MAGNUS_COLORS.border,
                        opacity: 0.6,
                    }, children: _jsxs("div", { style: { color: MAGNUS_COLORS.darkGreen, fontWeight: 'bold' }, children: ["Regular Scour: ", scourJob.processed, "/", scourJob.total] }) })] }));
    }
    return (_jsxs(_Fragment, { children: [_jsx("style", { children: spinnerStyle }), _jsxs("div", { className: "border rounded px-4 py-3 text-sm transition-opacity duration-200", style: {
                    backgroundColor: MAGNUS_COLORS.offWhite,
                    borderColor: MAGNUS_COLORS.border,
                    opacity: isScouring ? 0.5 : 1,
                    pointerEvents: 'auto'
                }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }, children: [_jsx("div", { style: { color: MAGNUS_COLORS.darkGreen, fontWeight: 'bold' }, children: isScouring ? '🔍 SCOURING IN PROGRESS (v2.1)' : '✓ SCOUR COMPLETE (v2.1)' }), _jsxs("div", { style: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }, children: [_jsx("button", { onClick: runEarlySignals, disabled: runningEarlySignals || isScouring, style: {
                                            padding: '0.25rem 0.75rem',
                                            backgroundColor: runningEarlySignals ? MAGNUS_COLORS.border : MAGNUS_COLORS.deepGreen,
                                            color: 'white',
                                            border: runningEarlySignals ? `2px solid ${MAGNUS_COLORS.deepGreen}` : 'none',
                                            borderRadius: '4px',
                                            cursor: runningEarlySignals || isScouring ? 'not-allowed' : 'pointer',
                                            fontSize: '0.85rem',
                                            fontWeight: 'bold',
                                            minWidth: '140px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 0.3s ease',
                                        }, title: runningEarlySignals ? "Early Signals searching..." : "Runs 25+ web searches for emerging threats", children: runningEarlySignals ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "early-signals-spinner", children: "\uD83D\uDD0D" }), "Searching Web..."] })) : ("⚡ Early Signals") }), _jsx("button", { onClick: forceStopScour, style: {
                                            padding: '0.25rem 0.75rem',
                                            backgroundColor: MAGNUS_COLORS.orange,
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '0.85rem',
                                            fontWeight: 'bold',
                                        }, children: "\u2297 Force Stop" }), _jsx("button", { onClick: () => stopScour(), disabled: !isScouring, style: {
                                            padding: '0.25rem 0.75rem',
                                            backgroundColor: isScouring ? MAGNUS_COLORS.critical : MAGNUS_COLORS.border,
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: isScouring ? 'pointer' : 'default',
                                            fontSize: '0.85rem',
                                            fontWeight: 'bold',
                                            opacity: isScouring ? 1 : 0.5,
                                        }, children: "\u23F9 KILL SCOUR" })] })] }), scourJob && (_jsxs("div", { style: { color: MAGNUS_COLORS.deepGreen, marginTop: '0.75rem' }, children: [_jsxs("div", { style: { marginBottom: '0.5rem' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem', gap: '1rem', flexWrap: 'wrap' }, children: [_jsx("span", { style: { fontSize: '1rem', fontWeight: 'bold' }, children: scourJob.phase === 'early_signals'
                                                    ? `⚡ Early Signals: ${earlySignalsProgress?.current || 0}/${earlySignalsProgress?.total || 80}`
                                                    : `Progress: ${scourJob.processed}/${scourJob.total} (${progressPercent}%)` }), _jsxs("div", { style: { display: 'flex', gap: '1rem', flexWrap: 'wrap' }, children: [scourJob.aiActive && (_jsxs("span", { style: { color: MAGNUS_COLORS.deepGreen, fontWeight: 'bold', display: 'flex', alignItems: 'center' }, children: [_jsx("span", { className: "early-signals-spinner", children: "\uD83E\uDD16" }), "Claude Active"] })), scourJob.phase && scourJob.phase === 'early_signals' && (_jsxs("span", { style: { color: MAGNUS_COLORS.orange, fontWeight: 'bold', display: 'flex', alignItems: 'center' }, children: [_jsx("span", { className: "early-signals-spinner", children: "\u26A1" }), "Early Signals Phase"] }))] })] }), _jsx("div", { style: {
                                            width: '100%',
                                            height: '12px',
                                            backgroundColor: MAGNUS_COLORS.border,
                                            borderRadius: '4px',
                                            overflow: 'hidden',
                                            marginBottom: '0.75rem',
                                        }, children: _jsx("div", { style: {
                                                height: '100%',
                                                width: `${scourJob.phase === 'early_signals'
                                                    ? Math.round(((earlySignalsProgress?.current || 0) / (earlySignalsProgress?.total || 80)) * 100)
                                                    : progressPercent}%`,
                                                backgroundColor: scourJob.phase === 'early_signals' ? MAGNUS_COLORS.orange : MAGNUS_COLORS.darkGreen,
                                                transition: 'width 0.3s ease',
                                            } }) })] }), _jsxs("div", { style: { marginTop: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginBottom: '0.75rem', fontSize: '0.95rem' }, children: [_jsxs("div", { style: { backgroundColor: 'rgba(0,0,0,0.02)', padding: '0.5rem', borderRadius: '3px' }, children: [_jsx("div", { style: { fontWeight: 'bold', color: MAGNUS_COLORS.deepGreen }, children: "\u2713 Alerts Created" }), _jsx("div", { style: { fontSize: '1.1rem', fontWeight: 'bold', color: MAGNUS_COLORS.darkGreen }, children: scourJob.created })] }), _jsxs("div", { style: { backgroundColor: 'rgba(0,0,0,0.02)', padding: '0.5rem', borderRadius: '3px' }, children: [_jsx("div", { style: { fontWeight: 'bold', color: MAGNUS_COLORS.deepGreen }, children: "\u23ED Skipped" }), _jsx("div", { style: { fontSize: '1.1rem', fontWeight: 'bold', color: MAGNUS_COLORS.darkGreen }, children: scourJob.duplicatesSkipped || 0 })] }), _jsxs("div", { style: { backgroundColor: 'rgba(0,0,0,0.02)', padding: '0.5rem', borderRadius: '3px' }, children: [_jsx("div", { style: { fontWeight: 'bold', color: MAGNUS_COLORS.deepGreen }, children: "Low Confidence" }), _jsx("div", { style: { fontSize: '1.1rem', fontWeight: 'bold', color: MAGNUS_COLORS.darkGreen }, children: scourJob.lowConfidenceSkipped || 0 })] }), scourJob.errorCount > 0 && (_jsxs("div", { style: { backgroundColor: 'rgba(255,0,0,0.05)', padding: '0.5rem', borderRadius: '3px' }, children: [_jsx("div", { style: { fontWeight: 'bold', color: MAGNUS_COLORS.critical }, children: "\u274C Errors" }), _jsx("div", { style: { fontSize: '1.1rem', fontWeight: 'bold', color: MAGNUS_COLORS.critical }, children: scourJob.errorCount })] }))] }), scourJob.currentQuery && scourJob.phase !== 'early_signals' && (_jsxs("div", { style: {
                                    marginTop: '0.75rem',
                                    padding: '0.75rem',
                                    backgroundColor: 'rgba(0, 0, 0, 0.03)',
                                    borderLeft: `4px solid ${MAGNUS_COLORS.deepGreen}`,
                                    borderRadius: '3px',
                                    fontSize: '0.9rem',
                                    fontFamily: 'monospace',
                                }, children: [_jsxs("div", { style: { fontWeight: 'bold', color: MAGNUS_COLORS.deepGreen, marginBottom: '0.25rem' }, children: ["\uD83D\uDD0D Current Source: ", scourJob.currentQuery] }), scourJob.currentQueryProgress && (_jsx("div", { style: { fontSize: '0.85rem', color: MAGNUS_COLORS.darkGreen }, children: scourJob.currentQueryProgress }))] })), scourJob.currentActivity && scourJob.phase !== 'early_signals' && (_jsxs("div", { style: { marginTop: '0.75rem', fontSize: '0.95rem', color: MAGNUS_COLORS.deepGreen, fontStyle: 'italic', padding: '0.5rem', backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: '3px' }, children: ["\uD83D\uDCCB Activity: ", scourJob.currentActivity] })), scourJob.errorCount > 0 && (_jsxs("div", { style: { marginTop: '0.75rem', borderRadius: '3px', overflow: 'hidden' }, children: [_jsx("button", { onClick: () => setShowErrors(!showErrors), style: {
                                            width: '100%',
                                            padding: '0.5rem',
                                            backgroundColor: 'rgba(255, 0, 0, 0.1)',
                                            border: `1px solid ${MAGNUS_COLORS.critical}`,
                                            borderRadius: '3px',
                                            cursor: 'pointer',
                                            fontWeight: 'bold',
                                            color: MAGNUS_COLORS.critical,
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                        }, children: _jsxs("span", { children: ["\u274C ", scourJob.errorCount, " Errors ", showErrors ? '▼' : '▶'] }) }), showErrors && scourJob.errors && scourJob.errors.length > 0 && (_jsx("div", { style: {
                                            marginTop: '0.25rem',
                                            padding: '0.75rem',
                                            backgroundColor: 'rgba(255, 0, 0, 0.05)',
                                            border: `1px solid ${MAGNUS_COLORS.critical}`,
                                            borderTop: 'none',
                                            borderRadius: '0 0 3px 3px',
                                            maxHeight: '300px',
                                            overflowY: 'auto',
                                            fontSize: '0.85rem',
                                            fontFamily: 'monospace',
                                        }, children: scourJob.errors.map((error, idx) => (_jsxs("div", { style: {
                                                marginBottom: '0.5rem',
                                                paddingBottom: '0.5rem',
                                                borderBottom: idx < scourJob.errors.length - 1 ? '1px solid rgba(0,0,0,0.1)' : 'none',
                                                color: MAGNUS_COLORS.critical,
                                            }, children: [_jsxs("strong", { children: ["Error ", idx + 1, ":"] }), " ", error.reason || error.sourceId || 'Unknown error'] }, idx))) }))] })), isScouring && liveLogs.length > 0 && (_jsxs("div", { style: { marginTop: '0.75rem', borderRadius: '3px', overflow: 'hidden' }, children: [_jsx("button", { onClick: () => setShowLogs(!showLogs), style: {
                                            width: '100%',
                                            padding: '0.5rem',
                                            backgroundColor: 'rgba(66, 165, 245, 0.1)',
                                            border: `1px solid rgb(66, 165, 245)`,
                                            borderRadius: '3px',
                                            cursor: 'pointer',
                                            fontWeight: 'bold',
                                            color: 'rgb(66, 165, 245)',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                        }, children: _jsxs("span", { children: ["\uD83D\uDCCB Live Logs (", liveLogs.length, ") ", showLogs ? '▼' : '▶'] }) }), showLogs && liveLogs.length > 0 && (_jsx("div", { style: {
                                            marginTop: '0.25rem',
                                            padding: '0.75rem',
                                            backgroundColor: 'rgba(66, 165, 245, 0.05)',
                                            border: `1px solid rgb(66, 165, 245)`,
                                            borderTop: 'none',
                                            borderRadius: '0 0 3px 3px',
                                            maxHeight: '400px',
                                            overflowY: 'auto',
                                            fontSize: '0.8rem',
                                            fontFamily: 'monospace',
                                            lineHeight: '1.4',
                                        }, children: liveLogs.slice(-30).map((log, idx) => (_jsxs("div", { style: {
                                                marginBottom: '0.25rem',
                                                color: 'rgb(66, 165, 245)',
                                                borderBottom: '1px solid rgba(66, 165, 245, 0.2)',
                                                paddingBottom: '0.25rem',
                                            }, children: [_jsx("span", { style: { color: 'rgba(66, 165, 245, 0.7)', marginRight: '0.5rem' }, children: log.time }), _jsx("span", { children: log.message })] }, idx))) }))] }))] }))] })] }));
}
