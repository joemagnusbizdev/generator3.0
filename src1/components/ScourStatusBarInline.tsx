import React from "react";
import { useScour } from "./ScourContext";
import MAGNUS_COLORS from "../styles/magnus-colors";

export default function ScourStatusBarInline() {
  const { isScouring, scourJob } = useScour();

  if (!isScouring && !scourJob) {
    return null;
  }

  return (
    <div 
      className="border rounded px-4 py-3 text-sm" 
      style={{ backgroundColor: MAGNUS_COLORS.offWhite, borderColor: MAGNUS_COLORS.border }}
    >
      <div style={{ color: MAGNUS_COLORS.darkGreen, fontWeight: 'bold' }}>
        {isScouring ? '🔍 SCOURING IN PROGRESS' : '✓ SCOUR COMPLETE'}
      </div>
      
      {scourJob && (
        <div style={{ color: MAGNUS_COLORS.deepGreen, marginTop: '0.5rem' }}>
          <div>Sources: {scourJob.processed}/{scourJob.total}</div>
          <div>Alerts Created: {scourJob.created}</div>
          {scourJob.errorCount > 0 && (
            <div style={{ color: MAGNUS_COLORS.critical }}>Errors: {scourJob.errorCount}</div>
          )}
        </div>
      )}
    </div>
  );
}
