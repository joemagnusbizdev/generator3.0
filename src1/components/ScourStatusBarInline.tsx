import React from "react";
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
  } = useScour();

  // 🚨 KEY FIX: never hide while job exists
  if (
    !isScouring &&
    !scourJob &&
    !lastResult &&
    !lastError
  ) {
    return null;
  }

  return (
    <div className="border rounded px-4 py-3 text-sm space-y-1" style={{ backgroundColor: MAGNUS_COLORS.offWhite, borderColor: MAGNUS_COLORS.border }}>
      <div className="font-semibold" style={{ color: MAGNUS_COLORS.darkGreen }}>
        🔍 AI Scour Status
      </div>

      {isScouring && scourJob && (
        <div style={{ color: MAGNUS_COLORS.deepGreen }}>
          🔄 Scouring in progress: {scourJob.processed}/{scourJob.total} sources
          {scourJob.total > 0 && (
            <span style={{ marginLeft: '8px', fontWeight: '600' }}>
              ({Math.round((scourJob.processed / scourJob.total) * 100)}%)
            </span>
          )}
        </div>
      )}

      {!isScouring && lastResult && (
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
