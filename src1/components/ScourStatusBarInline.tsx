import React from "react";
import { useScour } from "./ScourContext";
import MAGNUS_COLORS from "../styles/magnus-colors";

export default function ScourStatusBarInline() {
  const { isScouring, scourJob, stopScour } = useScour();

  if (!isScouring && !scourJob) {
    return null;
  }

  const progressPercent = scourJob && scourJob.total > 0 
    ? Math.round((scourJob.processed / scourJob.total) * 100) 
    : 0;

  return (
    <div 
      className="border rounded px-4 py-3 text-sm" 
      style={{ backgroundColor: MAGNUS_COLORS.offWhite, borderColor: MAGNUS_COLORS.border }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: MAGNUS_COLORS.darkGreen, fontWeight: 'bold' }}>
          {isScouring ? '🔍 SCOURING IN PROGRESS (v2.1)' : '✓ SCOUR COMPLETE (v2.1)'}
        </div>
        {isScouring && (
          <button
            onClick={() => stopScour()}
            style={{
              padding: '0.25rem 0.75rem',
              backgroundColor: MAGNUS_COLORS.critical,
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 'bold',
            }}
          >
            ⏹ STOP
          </button>
        )}
      </div>
      
      {scourJob && (
        <div style={{ color: MAGNUS_COLORS.deepGreen, marginTop: '0.75rem' }}>
          <div style={{ marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span>Progress: {scourJob.processed}/{scourJob.total} sources ({progressPercent}%)</span>
            </div>
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: MAGNUS_COLORS.border,
              borderRadius: '4px',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${progressPercent}%`,
                backgroundColor: MAGNUS_COLORS.darkGreen,
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
          <div style={{ marginTop: '0.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>✓ Alerts: {scourJob.created}</div>
            <div>⏭ Skipped: {scourJob.duplicatesSkipped || 0}</div>
            {scourJob.errorCount > 0 && (
              <div style={{ color: MAGNUS_COLORS.critical }}>❌ Errors: {scourJob.errorCount}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
