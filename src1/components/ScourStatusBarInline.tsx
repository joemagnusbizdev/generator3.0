import React from "react";
import { useScour } from "./ScourContext";

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
    <div className="border rounded bg-slate-50 px-4 py-3 text-sm space-y-1">
      <div className="font-semibold">
        🔍 AI Scour Status
      </div>

      {isScouring && scourJob && (
        <div>
          Running… {scourJob.processed}/{scourJob.total} sources processed
        </div>
      )}

      {!isScouring && lastResult && (
        <div className="text-green-700">
          ✅ Completed — {lastResult.created} alerts created ·{" "}
          {lastResult.duplicatesSkipped} duplicates skipped
        </div>
      )}

      {lastError && (
        <div className="text-red-700">
          ❌ {lastError}
        </div>
      )}

      {lastStartedAt && (
        <div className="text-xs text-gray-500">
          Started: {new Date(lastStartedAt).toLocaleString()}
        </div>
      )}

      {lastFinishedAt && (
        <div className="text-xs text-gray-500">
          Finished: {new Date(lastFinishedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}

}
