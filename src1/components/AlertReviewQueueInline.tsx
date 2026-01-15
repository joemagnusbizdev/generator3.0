import React, { useEffect, useState } from "react";

/* =========================
   Types
========================= */

export type PermissionSet = {
  canReview: boolean;
  canScour: boolean;
  canApproveAndPost: boolean;
  canDismiss: boolean;
  canDelete: boolean;
  canEditAlerts: boolean;
};

type Props = {
  sessionToken: string; // kept for compatibility, not used
  permissions: PermissionSet;
};

interface Alert {
  id: string;
  title: string;
  summary: string;
  location: string;
  country: string;
  region?: string;
  event_type: string;
  severity: "critical" | "warning" | "caution" | "informative";
  status: string;
  source_url?: string;
  article_url?: string;
  sources?: string;
  event_start_date?: string;
  event_end_date?: string;
  ai_generated: boolean;
  ai_model?: string;
  ai_confidence?: number;
  created_at: string;
}

/* =========================
   Helpers
========================= */

const API_BASE =
  "https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function";

function severityColor(sev: Alert["severity"]) {
  switch (sev) {
    case "critical":
      return "bg-red-600";
    case "warning":
      return "bg-orange-500";
    case "caution":
      return "bg-yellow-500";
    default:
      return "bg-blue-500";
  }
}

/* =========================
   Component
========================= */

export default function AlertReviewQueueInline({
  permissions,
}: Props) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (permissions.canReview) {
      loadAlerts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissions.canReview]);

  async function loadAlerts() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_BASE}/alerts/review`);
      if (!res.ok) throw new Error(`Failed to load alerts (${res.status})`);

      const data = await res.json();
      setAlerts(Array.isArray(data.alerts) ? data.alerts : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }

  async function approveAlert(id: string) {
    await fetch(`${API_BASE}/alerts/${id}/approve`, { method: "POST" });
    loadAlerts();
  }

  async function dismissAlert(id: string) {
    await fetch(`${API_BASE}/alerts/${id}/dismiss`, { method: "POST" });
    loadAlerts();
  }

  async function deleteAlert(id: string) {
    if (!confirm("Delete this alert?")) return;
    await fetch(`${API_BASE}/alerts/${id}`, { method: "DELETE" });
    loadAlerts();
  }

  function copyWhatsApp(alert: Alert) {
    const text = `
🟠 ${alert.title}

📍 ${alert.location}, ${alert.country}

${alert.summary}

Source:
${alert.source_url || "—"}
`.trim();

    navigator.clipboard.writeText(text);
    alert("Copied to clipboard");
  }

  if (!permissions.canReview) {
    return <div className="p-4 text-gray-500">No review permissions.</div>;
  }

  if (loading) {
    return <div className="p-6">Loading alerts…</div>;
  }

  if (error) {
    return (
      <div className="p-4 border border-red-300 bg-red-50 rounded">
        <p className="text-red-700 mb-2">{error}</p>
        <button
          onClick={loadAlerts}
          className="px-3 py-1 bg-red-600 text-white rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  if (alerts.length === 0) {
    return <div className="p-6 text-gray-600">No alerts available.</div>;
  }

  return (
    <div className="space-y-4">
      {alerts.map((alert) => {
        const open = expanded[alert.id];

        return (
          <div
            key={alert.id}
            className="border rounded bg-white shadow-sm overflow-hidden"
          >
            {/* HEADER */}
            <div
              className="p-4 cursor-pointer flex justify-between items-start"
              onClick={() =>
                setExpanded((e) => ({ ...e, [alert.id]: !open }))
              }
            >
              <div>
                <h3 className="font-semibold">{alert.title}</h3>
                <div className="text-sm text-gray-600">
                  {alert.location}, {alert.country}
                </div>
              </div>

              <span
                className={`text-xs text-white px-2 py-1 rounded ${severityColor(
                  alert.severity
                )}`}
              >
                {alert.severity.toUpperCase()}
              </span>
            </div>

            {/* EXPANDED */}
            {open && (
              <div className="px-4 pb-4 space-y-3 text-sm">
                <div>
                  <strong>Summary</strong>
                  <p className="mt-1">{alert.summary}</p>
                </div>

                {alert.sources && (
                  <div>
                    <strong>Sources</strong>
                    <p>{alert.sources}</p>
                  </div>
                )}

                {alert.source_url && (
                  <div>
                    <strong>Article</strong>{" "}
                    <a
                      href={alert.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 underline"
                    >
                      Open link
                    </a>
                  </div>
                )}

                {/* ACTIONS */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    onClick={() => approveAlert(alert.id)}
                    className="px-3 py-1 bg-green-600 text-white rounded"
                  >
                    Approve & Post
                  </button>

                  <button
                    onClick={() => dismissAlert(alert.id)}
                    className="px-3 py-1 bg-yellow-600 text-white rounded"
                  >
                    Dismiss → Trends
                  </button>

                  <button
                    onClick={() => copyWhatsApp(alert)}
                    className="px-3 py-1 bg-gray-200 rounded"
                  >
                    Copy WhatsApp
                  </button>

                  <button
                    onClick={() => deleteAlert(alert.id)}
                    className="px-3 py-1 bg-red-600 text-white rounded"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
