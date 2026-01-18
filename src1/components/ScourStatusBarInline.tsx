import React from "react";
import { useScour } from "./ScourContext";

export default function ScourStatusBarInline() {
  const { isScouring, scourJob, lastResult, lastError } = useScour();

  if (!isScouring && !scourJob && !lastResult && !lastError) return null;

  return (
    <div className="p-3 rounded border bg-gray-50 text-sm">
      {isScouring && scourJob && (
        <div>
          <strong>Scouring:</strong>{" "}
          {scourJob.processed}/{scourJob.total} processed
        </div>
      )}

      {lastResult && (
        <div>
          <strong>Scour complete:</strong>{" "}
          {lastResult.created} created ·{" "}
          {lastResult.duplicatesSkipped} duplicates
        </div>
      )}

      {lastError && (
        <div className="text-red-600">
          <strong>Error:</strong> {lastError}
        </div>
      )}
    </div>
  );
}
