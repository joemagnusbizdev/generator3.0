import React, { useEffect, useRef } from "react";
import { useScour } from "./ScourContext";
import MAGNUS_COLORS from "../styles/magnus-colors";

export default function ScourStatusBarInline() {
  const {
    isScouring,
    scourJob,
    lastResult,
    lastError,
    lastStartedAt,
    lastFinishedAt,
    stopScour,
  } = useScour();

  const activityLogRef = useRef<HTMLDivElement>(null);

  // Auto-scroll activity log to bottom when new entries appear
  useEffect(() => {
    if (activityLogRef.current) {
      activityLogRef.current.scrollTop = activityLogRef.current.scrollHeight;
    }
  }, [scourJob?.activityLog]);

  // 🚨 KEY FIX: never hide while job exists
  if (
    !isScouring &&
    !scourJob &&
    !lastResult &&
    !lastError
  ) {
    return null;
  }
  
  // Calculate completion percentage more accurately
  const isComplete = !isScouring && scourJob?.status === 'done';
  const progress = scourJob && scourJob.total > 0 
    ? (scourJob.processed / scourJob.total) * 100 
    : isComplete ? 100 : 0;

  return (
    <div className="border rounded px-4 py-3 text-sm space-y-1" style={{ backgroundColor: MAGNUS_COLORS.offWhite, borderColor: MAGNUS_COLORS.border }}>
      <div className="flex items-center justify-between">
        <div className="font-semibold" style={{ color: MAGNUS_COLORS.darkGreen }}>
          🔍 AI Scour Status
        </div>
        {isScouring && (
          <button
            onClick={stopScour}
            className="px-3 py-1 rounded text-white font-semibold text-xs transition hover:opacity-90"
            style={{ backgroundColor: MAGNUS_COLORS.orange }}
          >
            ⊘ Stop Scour
          </button>
        )}
      </div>

      {isScouring && scourJob && (
        <div style={{ color: MAGNUS_COLORS.deepGreen }}>
          {scourJob.total === 0 ? (
            <div style={{ color: MAGNUS_COLORS.critical }}>
              ⚠️  No sources to scour - create and enable sources first
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span>🔄 Scouring in progress:</span>
                  <strong>{scourJob.processed}/{scourJob.total}</strong>
                  {scourJob.total > 0 && (
                    <span style={{ fontWeight: '700', fontSize: '1.1em' }}>
                      {Math.round(progress)}%
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.85em', color: MAGNUS_COLORS.secondaryText, whiteSpace: 'nowrap' }}>
                  {scourJob.processed === scourJob.total ? '✅ Finalizing...' : `${scourJob.total - scourJob.processed} remaining`}
                </div>
              </div>
              {scourJob.currentSource && (
                <div style={{ fontSize: '0.9em', color: MAGNUS_COLORS.secondaryText, fontStyle: 'italic' }}>
                  📰 Current: {scourJob.currentSource}
                </div>
              )}
              {scourJob.currentActivity && (
                <div style={{ fontSize: '0.9em', fontWeight: '500', color: MAGNUS_COLORS.deepGreen }}>
                  ⚙️ {scourJob.currentActivity}
                </div>
              )}
              {/* Real-time activity log */}
              {scourJob.activityLog && scourJob.activityLog.length > 0 && (
                <div 
                  ref={activityLogRef}
                  style={{ 
                    maxHeight: '120px', 
                    overflowY: 'auto',
                    fontSize: '0.85em',
                    color: MAGNUS_COLORS.secondaryText,
                    backgroundColor: MAGNUS_COLORS.border,
                    borderRadius: '4px',
                    padding: '8px',
                    fontFamily: 'monospace',
                    border: `1px solid ${MAGNUS_COLORS.darkGreen}20`,
                  }}
                >
                  {scourJob.activityLog.map((entry, idx) => {
                    const time = new Date(entry.time).toLocaleTimeString('en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit', 
                      second: '2-digit' 
                    });
                    return (
                      <div key={idx} style={{ marginBottom: '2px', display: 'flex', gap: '8px' }}>
                        <span style={{ color: MAGNUS_COLORS.secondaryText, opacity: 0.6 }}>{time}</span>
                        <span style={{ color: MAGNUS_COLORS.deepGreen }}>{entry.message}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Progress bar - now reaches 100% when complete */}
              <div style={{ height: '6px', backgroundColor: MAGNUS_COLORS.border, borderRadius: '3px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(progress, 100)}%`,
                    backgroundColor: MAGNUS_COLORS.deepGreen,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {!isScouring && scourJob && isComplete && (
        <div style={{ color: MAGNUS_COLORS.deepGreen }}>
          <div className="flex items-center justify-between">
            <div>
              ✅ <strong>Scour Complete!</strong> {scourJob.created} alerts created · {scourJob.duplicatesSkipped || 0} duplicates skipped
            </div>
            <div style={{ fontSize: '0.85em', color: MAGNUS_COLORS.secondaryText }}>
              {lastFinishedAt && new Date(lastFinishedAt).toLocaleTimeString()}
            </div>
          </div>
          {/* Show final activity log on completion */}
          {scourJob.activityLog && scourJob.activityLog.length > 0 && (
            <div 
              style={{ 
                maxHeight: '100px', 
                overflowY: 'auto',
                fontSize: '0.8em',
                color: MAGNUS_COLORS.secondaryText,
                backgroundColor: MAGNUS_COLORS.border,
                borderRadius: '4px',
                padding: '6px',
                marginTop: '8px',
                fontFamily: 'monospace',
                border: `1px solid ${MAGNUS_COLORS.darkGreen}20`,
              }}
            >
              {scourJob.activityLog.slice(-5).map((entry, idx) => {
                const time = new Date(entry.time).toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit', 
                  second: '2-digit' 
                });
                return (
                  <div key={idx} style={{ marginBottom: '2px', display: 'flex', gap: '8px' }}>
                    <span style={{ color: MAGNUS_COLORS.secondaryText, opacity: 0.6 }}>{time}</span>
                    <span style={{ color: MAGNUS_COLORS.deepGreen }}>{entry.message}</span>
                  </div>
                );
              })}
            </div>
          )}
          {/* Full completion bar */}
          <div style={{ height: '6px', backgroundColor: MAGNUS_COLORS.border, borderRadius: '3px', overflow: 'hidden', marginTop: '0.5rem' }}>
            <div
              style={{
                height: '100%',
                width: '100%',
                backgroundColor: MAGNUS_COLORS.deepGreen,
              }}
            />
          </div>
        </div>
      )}

      {!isScouring && lastResult && scourJob?.status !== 'done' && (
        <div style={{ color: MAGNUS_COLORS.caution }}>
          ✅ Completed — {lastResult.created} alerts created ·{" "}
          {lastResult.duplicatesSkipped} duplicates skipped
        </div>
      )}

      {lastError && (
        <div style={{ color: MAGNUS_COLORS.critical }}>
          ❌ {lastError}
        </div>
      )}

      {lastStartedAt && (
        <div className="text-xs" style={{ color: MAGNUS_COLORS.secondaryText }}>
          Started: {new Date(lastStartedAt).toLocaleString()}
        </div>
      )}

      {lastFinishedAt && (
        <div className="text-xs" style={{ color: MAGNUS_COLORS.secondaryText }}>
          Finished: {new Date(lastFinishedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}
