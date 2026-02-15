import React, { useState, useEffect } from "react";
import { useScour } from "./ScourContext";
import { apiPostJson } from "../lib/utils/api";
import MAGNUS_COLORS from "../styles/magnus-colors";

interface Props {
  accessToken?: string;
}

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

export default function ScourStatusBarInline({ accessToken }: Props) {
  const { isScouring, scourJob, stopScour, startScour } = useScour();
  const [runningEarlySignals, setRunningEarlySignals] = useState(false);
  const [earlySignalsProgress, setEarlySignalsProgress] = useState<{ current: number; total: number } | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [liveLogs, setLiveLogs] = useState<Array<{ time: string; message: string }>>([]);

  // Reset early signals flag when scour completes
  useEffect(() => {
    if (!isScouring && scourJob?.status === "done" && runningEarlySignals) {
      setRunningEarlySignals(false);
      setEarlySignalsProgress(null);
    }
  }, [isScouring, scourJob?.status, runningEarlySignals]);

  // Fetch live logs from server and parse Early Signals progress
  // Also try to use activityLog from scourJob directly if available
  useEffect(() => {
    if (!scourJob?.id || !isScouring) return;

    // First, use activityLog from scourJob if available (already polled every 400ms)
    if (scourJob.activityLog && Array.isArray(scourJob.activityLog) && scourJob.activityLog.length > 0) {
      console.log(`[EarlySignals] Using activityLog from scourJob: ${scourJob.activityLog.length} entries`);
      console.log(`[EarlySignals] First log:`, scourJob.activityLog[0]);
      console.log(`[EarlySignals] Last log:`, scourJob.activityLog[scourJob.activityLog.length - 1]);
      setLiveLogs(scourJob.activityLog);
      
      // Parse Early Signals progress from logs using progress bar pattern
      // Format: [████████...░░░░░] 1234/3710 (33%) - query text
      const progressLogs = scourJob.activityLog.filter((log: any) => 
        log.message?.includes('/') && log.message?.includes('%') && log.message?.includes('[')
      );
      
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
    } else {
      console.log(`[EarlySignals] scourJob.activityLog not available or empty`, { 
        hasActivityLog: !!scourJob?.activityLog, 
        isArray: Array.isArray(scourJob?.activityLog),
        length: scourJob?.activityLog?.length 
      });
    }

    // Fallback: Fetch from logs endpoint if not in scourJob
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clever-function/scour/logs?jobId=${scourJob.id}&limit=300`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        ).then(r => r.json());

        if (res.ok && res.logs) {
          console.log(`[EarlySignals] Fetched ${res.logs.length} logs from server endpoint`);
          setLiveLogs(res.logs);
          
          // Parse Early Signals progress from logs using progress bar pattern
          // Format: [████████...░░░░░] 1234/3710 (33%) - query text
          const progressLogs = res.logs.filter((log: any) => 
            log.message?.includes('/') && log.message?.includes('%') && log.message?.includes('[')
          );
          
          if (progressLogs.length > 0) {
            const lastLog = progressLogs[progressLogs.length - 1].message;
            const match = lastLog.match(/(\d+)\/(\d+)\s+\((\d+)%\)/);
            if (match) {
              const current = parseInt(match[1]);
              const total = parseInt(match[2]);
              setEarlySignalsProgress({ current, total });
            }
          }
        } else {
          console.log(`[EarlySignals] No logs in response or response not ok:`, res);
        }
      } catch (e) {
        console.error('[EarlySignals] Error fetching logs:', e);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [scourJob?.id, scourJob?.activityLog, isScouring, accessToken]);

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
    if (runningEarlySignals || isScouring || !accessToken) return;
    setRunningEarlySignals(true);
    try {
      const res = await apiPostJson<{ ok: boolean; jobId?: string; error?: string; message?: string }>(
        "/scour-early-signals",
        {},
        accessToken
      );

      if (res.ok && res.jobId) {
        // Start polling the job status
        await startScour(accessToken, { sourceIds: [] });
      } else {
        alert(`Early signals failed: ${res.error || 'Unknown error'}`);
        setRunningEarlySignals(false);
      }
      // Keep runningEarlySignals=true until scour completes
    } catch (e: any) {
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
      } else {
        console.error('[ForceStop] Backend error:', data);
        alert(`⚠️ Error: ${data.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      console.error('[ForceStop] Request failed:', e);
      alert(`❌ Error: ${e.message}`);
    }
  }

  const progressPercent = scourJob && scourJob.total > 0 
    ? Math.round((scourJob.processed / scourJob.total) * 100) 
    : 0;

  // Early Signals UI
  if (scourJob?.phase === 'early_signals' && runningEarlySignals) {
    return (
      <>
        <style>{spinnerStyle}</style>
        
        {/* Early Signals Prominent Display */}
        <div 
          className="border rounded px-4 py-3 text-sm" 
          style={{ 
            backgroundColor: '#fff8f0',
            borderColor: MAGNUS_COLORS.orange,
            borderWidth: '3px',
            marginBottom: '1rem',
            boxShadow: `0 0 20px rgba(255, 140, 0, 0.3)`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="early-signals-spinner" style={{ fontSize: '1.5rem' }}>⚡</span>
              <div style={{ color: MAGNUS_COLORS.orange, fontWeight: 'bold', fontSize: '1.1rem' }}>
                EARLY SIGNALS - WEB SEARCH IN PROGRESS
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={forceStopScour}
                style={{
                  padding: '0.35rem 1rem',
                  backgroundColor: MAGNUS_COLORS.orange,
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                }}
              >
                ⊗ Force Stop
              </button>
              <button
                onClick={() => stopScour()}
                style={{
                  padding: '0.35rem 1rem',
                  backgroundColor: MAGNUS_COLORS.critical,
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                }}
              >
                ⏹ KILL SEARCH
              </button>
            </div>
          </div>

          {/* Progress Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(150px, 1fr))', gap: '1.5rem', marginBottom: '1rem', fontSize: '0.95rem' }}>
            <div>
              <div style={{ color: MAGNUS_COLORS.orange, fontSize: '0.9rem', marginBottom: '0.25rem' }}>🔍 Queries Done</div>
              <div style={{ fontSize: '1.5rem', color: MAGNUS_COLORS.deepGreen, fontWeight: 'bold' }}>
                {(earlySignalsProgress?.current || 0).toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ color: MAGNUS_COLORS.orange, fontSize: '0.9rem', marginBottom: '0.25rem' }}>📊 Total Queries</div>
              <div style={{ fontSize: '1.5rem', color: MAGNUS_COLORS.deepGreen, fontWeight: 'bold' }}>
                {(earlySignalsProgress?.total || 3710).toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ color: MAGNUS_COLORS.orange, fontSize: '0.9rem', marginBottom: '0.25rem' }}>✓ Alerts Found</div>
              <div style={{ fontSize: '1.5rem', color: MAGNUS_COLORS.deepGreen, fontWeight: 'bold' }}>
                {(scourJob.created || 0).toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ color: MAGNUS_COLORS.orange, fontSize: '0.9rem', marginBottom: '0.25rem' }}>⏱ Progress</div>
              <div style={{ fontSize: '1.5rem', color: '#ff8c00', fontWeight: 'bold' }}>
                {earlySignalsProgress?.total ? Math.round(((earlySignalsProgress?.current || 0) / earlySignalsProgress?.total) * 100) : 0}%
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{
            width: '100%',
            height: '20px',
            backgroundColor: MAGNUS_COLORS.border,
            borderRadius: '8px',
            overflow: 'hidden',
            marginBottom: '1rem',
            border: `2px solid ${MAGNUS_COLORS.orange}`,
          }}>
            <div style={{
              height: '100%',
              width: `${earlySignalsProgress?.total ? Math.round(((earlySignalsProgress?.current || 0) / earlySignalsProgress?.total) * 100) : 0}%`,
              backgroundColor: MAGNUS_COLORS.orange,
              transition: 'width 0.3s ease',
              background: `linear-gradient(90deg, ${MAGNUS_COLORS.orange}, #ff9f1c)`,
            }} />
          </div>

          {/* Current Query */}
          {scourJob.currentEarlySignalQuery && (
            <div style={{ 
              padding: '0.75rem', 
              backgroundColor: 'rgba(255, 140, 0, 0.05)',
              border: `2px solid ${MAGNUS_COLORS.orange}`,
              borderRadius: '4px',
              fontSize: '0.95rem',
              fontFamily: 'monospace',
              color: MAGNUS_COLORS.orange,
              fontWeight: 'bold',
              marginBottom: '0.5rem',
            }}>
              <div style={{ marginBottom: '0.25rem' }}>🌍 Current Query:</div>
              <div style={{ paddingLeft: '1rem', fontSize: '0.9rem' }}>{scourJob.currentEarlySignalQuery}</div>
            </div>
          )}

          {/* Query Stats */}
          <div style={{
            padding: '0.75rem 1rem',
            backgroundColor: 'rgba(255, 140, 0, 0.05)',
            borderLeft: `4px solid ${MAGNUS_COLORS.orange}`,
            borderRadius: '4px',
            fontSize: '0.9rem',
            color: MAGNUS_COLORS.deepGreen,
          }}>
            <div style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>📍 Query Progress</div>
            <div style={{ marginBottom: '0.25rem' }}>
              {(earlySignalsProgress?.current || 0).toLocaleString()} of {(earlySignalsProgress?.total || 3710).toLocaleString()} searches completed
            </div>
            <div style={{ marginBottom: '0.25rem' }}>
              {earlySignalsProgress?.total ? `⏱ ~${Math.ceil(((earlySignalsProgress?.total - (earlySignalsProgress?.current || 0)) * 15) / 60)} minutes remaining at current rate` : 'Initializing...'}
            </div>
            <div style={{ color: MAGNUS_COLORS.orange, fontWeight: 'bold' }}>
              Rate: ~1 query/second (throttled for API stability)
            </div>
          </div>

          {/* Live Activity Log Display */}
          <div style={{ 
            marginTop: '1rem',
            padding: '0.75rem',
            backgroundColor: 'rgba(255, 140, 0, 0.03)',
            border: `1px solid ${MAGNUS_COLORS.border}`,
            borderRadius: '4px',
            maxHeight: '250px',
            overflowY: 'auto',
            fontFamily: 'monospace',
          }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: MAGNUS_COLORS.orange, marginBottom: '0.5rem' }}>
              📋 Activity Log ({liveLogs.length} entries)
            </div>
            {liveLogs.length === 0 ? (
              <div style={{ fontSize: '0.8rem', color: MAGNUS_COLORS.border, padding: '0.5rem' }}>
                Waiting for logs from server...
              </div>
            ) : (
              liveLogs
                .slice(-12)
                .map((log, idx) => (
                  <div key={idx} style={{ 
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
                  }}>
                    <span style={{ color: MAGNUS_COLORS.orange }}>
                      {new Date(log.time).toLocaleTimeString()}
                    </span>
                    {' '} {log.message}
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Regular Scour Status Below (if also running) */}
        <div 
          className="border rounded px-4 py-3 text-sm transition-opacity duration-200" 
          style={{ 
            backgroundColor: MAGNUS_COLORS.offWhite, 
            borderColor: MAGNUS_COLORS.border,
            opacity: 0.6,
          }}
        >
          <div style={{ color: MAGNUS_COLORS.darkGreen, fontWeight: 'bold' }}>
            Regular Scour: {scourJob.processed}/{scourJob.total}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{spinnerStyle}</style>
      <div 
      className="border rounded px-4 py-3 text-sm transition-opacity duration-200" 
      style={{ 
        backgroundColor: MAGNUS_COLORS.offWhite, 
        borderColor: MAGNUS_COLORS.border,
        opacity: isScouring ? 0.5 : 1,
        pointerEvents: 'auto'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ color: MAGNUS_COLORS.darkGreen, fontWeight: 'bold' }}>
          {isScouring ? '🔍 SCOURING IN PROGRESS (v2.1)' : '✓ SCOUR COMPLETE (v2.1)'}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={runEarlySignals}
            disabled={runningEarlySignals || isScouring}
            style={{
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
            }}
            title={runningEarlySignals ? "Early Signals searching..." : "Runs 25+ web searches for emerging threats"}
          >
            {runningEarlySignals ? (
              <>
                <span className="early-signals-spinner">🔍</span>
                Searching Web...
              </>
            ) : (
              "⚡ Early Signals"
            )}
          </button>
          <button
            onClick={forceStopScour}
            style={{
              padding: '0.25rem 0.75rem',
              backgroundColor: MAGNUS_COLORS.orange,
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 'bold',
            }}
          >
            ⊗ Force Stop
          </button>
          <button
            onClick={() => stopScour()}
            disabled={!isScouring}
            style={{
              padding: '0.25rem 0.75rem',
              backgroundColor: isScouring ? MAGNUS_COLORS.critical : MAGNUS_COLORS.border,
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isScouring ? 'pointer' : 'default',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              opacity: isScouring ? 1 : 0.5,
            }}
          >
            ⏹ KILL SCOUR
          </button>
        </div>
      </div>
      
      {scourJob && (
        <div style={{ color: MAGNUS_COLORS.deepGreen, marginTop: '0.75rem' }}>
          <div style={{ marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem', gap: '1rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1rem', fontWeight: 'bold' }}>
                {scourJob.phase === 'early_signals' 
                  ? `⚡ Early Signals: ${earlySignalsProgress?.current || 0}/${earlySignalsProgress?.total || 80}`
                  : `Progress: ${scourJob.processed}/${scourJob.total} (${progressPercent}%)`
                }
              </span>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {scourJob.aiActive && (
                  <span style={{ color: MAGNUS_COLORS.deepGreen, fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                    <span className="early-signals-spinner">🤖</span>Claude Active
                  </span>
                )}
                {scourJob.phase && scourJob.phase === 'early_signals' && (
                  <span style={{ color: MAGNUS_COLORS.orange, fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                    <span className="early-signals-spinner">⚡</span>Early Signals Phase
                  </span>
                )}
              </div>
            </div>
            <div style={{
              width: '100%',
              height: '12px',
              backgroundColor: MAGNUS_COLORS.border,
              borderRadius: '4px',
              overflow: 'hidden',
              marginBottom: '0.75rem',
            }}>
              <div style={{
                height: '100%',
                width: `${scourJob.phase === 'early_signals' 
                  ? Math.round(((earlySignalsProgress?.current || 0) / (earlySignalsProgress?.total || 80)) * 100)
                  : progressPercent
                }%`,
                backgroundColor: scourJob.phase === 'early_signals' ? MAGNUS_COLORS.orange : MAGNUS_COLORS.darkGreen,
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
          
          {/* Stats Grid - Always Visible */}
          <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginBottom: '0.75rem', fontSize: '0.95rem' }}>
            <div style={{ backgroundColor: 'rgba(0,0,0,0.02)', padding: '0.5rem', borderRadius: '3px' }}>
              <div style={{ fontWeight: 'bold', color: MAGNUS_COLORS.deepGreen }}>✓ Alerts Created</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: MAGNUS_COLORS.darkGreen }}>{scourJob.created}</div>
            </div>
            <div style={{ backgroundColor: 'rgba(0,0,0,0.02)', padding: '0.5rem', borderRadius: '3px' }}>
              <div style={{ fontWeight: 'bold', color: MAGNUS_COLORS.deepGreen }}>⏭ Skipped</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: MAGNUS_COLORS.darkGreen }}>{scourJob.duplicatesSkipped || 0}</div>
            </div>
            <div style={{ backgroundColor: 'rgba(0,0,0,0.02)', padding: '0.5rem', borderRadius: '3px' }}>
              <div style={{ fontWeight: 'bold', color: MAGNUS_COLORS.deepGreen }}>Low Confidence</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: MAGNUS_COLORS.darkGreen }}>{scourJob.lowConfidenceSkipped || 0}</div>
            </div>
            {scourJob.errorCount > 0 && (
              <div style={{ backgroundColor: 'rgba(255,0,0,0.05)', padding: '0.5rem', borderRadius: '3px' }}>
                <div style={{ fontWeight: 'bold', color: MAGNUS_COLORS.critical }}>❌ Errors</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: MAGNUS_COLORS.critical }}>{scourJob.errorCount}</div>
              </div>
            )}
          </div>
          
          {/* Regular Query Display (when not in early signals) */}
          {scourJob.currentQuery && scourJob.phase !== 'early_signals' && (
            <div style={{ 
              marginTop: '0.75rem', 
              padding: '0.75rem', 
              backgroundColor: 'rgba(0, 0, 0, 0.03)',
              borderLeft: `4px solid ${MAGNUS_COLORS.deepGreen}`,
              borderRadius: '3px',
              fontSize: '0.9rem',
              fontFamily: 'monospace',
            }}>
              <div style={{ fontWeight: 'bold', color: MAGNUS_COLORS.deepGreen, marginBottom: '0.25rem' }}>
                🔍 Current Source: {scourJob.currentQuery}
              </div>
              {scourJob.currentQueryProgress && (
                <div style={{ fontSize: '0.85rem', color: MAGNUS_COLORS.darkGreen }}>
                  {scourJob.currentQueryProgress}
                </div>
              )}
            </div>
          )}
          
          {/* Current Activity */}
          {scourJob.currentActivity && scourJob.phase !== 'early_signals' && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.95rem', color: MAGNUS_COLORS.deepGreen, fontStyle: 'italic', padding: '0.5rem', backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: '3px' }}>
              📋 Activity: {scourJob.currentActivity}
            </div>
          )}

          {/* Error Log - Expandable */}
          {scourJob.errorCount > 0 && (
            <div style={{ marginTop: '0.75rem', borderRadius: '3px', overflow: 'hidden' }}>
              <button
                onClick={() => setShowErrors(!showErrors)}
                style={{
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
                }}
              >
                <span>❌ {scourJob.errorCount} Errors {showErrors ? '▼' : '▶'}</span>
              </button>
              {showErrors && scourJob.errors && scourJob.errors.length > 0 && (
                <div style={{
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
                }}>
                  {scourJob.errors.map((error, idx) => (
                    <div key={idx} style={{ 
                      marginBottom: '0.5rem', 
                      paddingBottom: '0.5rem',
                      borderBottom: idx < scourJob.errors!.length - 1 ? '1px solid rgba(0,0,0,0.1)' : 'none',
                      color: MAGNUS_COLORS.critical,
                    }}>
                      <strong>Error {idx + 1}:</strong> {error.reason || error.sourceId || 'Unknown error'}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Live Logs - Expandable */}
          {isScouring && liveLogs.length > 0 && (
            <div style={{ marginTop: '0.75rem', borderRadius: '3px', overflow: 'hidden' }}>
              <button
                onClick={() => setShowLogs(!showLogs)}
                style={{
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
                }}
              >
                <span>📋 Live Logs ({liveLogs.length}) {showLogs ? '▼' : '▶'}</span>
              </button>
              {showLogs && liveLogs.length > 0 && (
                <div style={{
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
                }}>
                  {liveLogs.slice(-30).map((log, idx) => (
                    <div key={idx} style={{ 
                      marginBottom: '0.25rem',
                      color: 'rgb(66, 165, 245)',
                      borderBottom: '1px solid rgba(66, 165, 245, 0.2)',
                      paddingBottom: '0.25rem',
                    }}>
                      <span style={{ color: 'rgba(66, 165, 245, 0.7)', marginRight: '0.5rem' }}>
                        {log.time}
                      </span>
                      <span>{log.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      </div>
    </>
  );
}
