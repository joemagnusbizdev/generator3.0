/**
 * AlertReviewQueueInline - Main component for reviewing alerts
 * Matches original component API with corrected import paths
 */
import React, { useEffect, useState } from "react";
import EnhancedAlertCard from "./EnhancedAlertCard";
import { deleteAlert, apiFetchJson } from "../lib/utils/api";
import { useScour } from "./ScourContext";

// ============================================================================
// Types
// ============================================================================

export type Alert = {
  id: string;
  title: string;
  location: string;
  severity: string;
  sourceUrl?: string;
  articleUrl?: string;
};

interface ReviewPermissions {
  canReview?: boolean;
  canScour?: boolean;
  canApproveAndPost?: boolean;
  canDismiss?: boolean;
  canDelete?: boolean;
  canEditAlerts?: boolean;
}

interface Props {
  sessionToken: string;
  permissions: ReviewPermissions;
}

// ============================================================================
// Component
// ============================================================================

export default function AlertReviewQueueInline({
  sessionToken,
  permissions,
}: Props) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Uses scourJobId and runScour (aliases provided by ScourContext)
  const { scourJobId, runScour } = useScour();

  useEffect(() => {
    // Use the API helper with proper Supabase endpoint
    apiFetchJson<Alert[]>("/alerts/review", sessionToken)
      .then((data) => setAlerts(Array.isArray(data) ? data : []))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [sessionToken]);

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      await deleteAlert(id, sessionToken);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      console.error("Delete failed", e);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      {permissions.canScour && (
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => runScour()} disabled={!!scourJobId}>
            {scourJobId ? "Scouring..." : "Run Scour"}
          </button>
        </div>
      )}

      {err && <div style={{ color: "red" }}>Error: {err}</div>}

      {loading ? (
        <div>Loading...</div>
      ) : (
        alerts.map((alert) => (
          <EnhancedAlertCard
            key={alert.id}
            alert={alert}
            onDelete={handleDelete}
            busy={busyId === alert.id}
          />
        ))
      )}
    </div>
  );
}

// Also export as named export for flexibility
export { AlertReviewQueueInline };
