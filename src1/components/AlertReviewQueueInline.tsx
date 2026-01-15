import React, { useEffect, useState } from "react";
import GeoJsonPreview from "./GeoJsonPreview";

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
  permissions: PermissionSet;
};

export interface Alert {
  id: string;
  title: string;
  summary: string;
  recommendations?: string;

  location: string;
  country: string;
  region?: string;

  event_type?: string; // topic/category
  severity: "critical" | "warning" | "caution" | "informative";
  status: string;

  source_url?: string;
  article_url?: string;
  sources?: string;

  event_start_date?: string; // ISO date
  event_end_date?: string;   // ISO date

  geojson?: any;

  ai_generated?: boolean; // IMPORTANT: used by UI logic
  created_at: string;
}

/* =========================
   Config
========================= */

const API_BASE =
  "https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function";

const SEVERITY_META: Record<
  Alert["severity"],
  { emoji: string; label: string; color: string }
> = {
  critical: { emoji: "🔴", label: "CRITICAL", color: "bg-red-600" },
  warning: { emoji: "🟠", label: "WARNING", color: "bg-orange-500" },
  caution: { emoji: "🟡", label: "CAUTION", color: "bg-yellow-500" },
  informative: { emoji: "🔵", label: "INFO", color: "bg-blue-500" },
};

function formatDateRange(a: Alert) {
  const start = a.event_start_date || "";
  const end = a.event_end_date || "";
  if (start && end) return `${start} → ${end}`;
  if (start && !end) return `${start} (ongoing)`;
  if (!start && end) return `until ${end}`;
  return "Ongoing";
}

/**
 * WhatsApp format requirement:
 * Country
 * Location
 * Time and Date
 * (Severity Icon)-Topic
 * Event Summary
 * Recommendations
 * Sources
 */
function whatsappTemplate(a: Alert) {
  const s = SEVERITY_META[a.severity];
  const topic = (a.event_type || "General").trim();
  const sources = a.article_url || a.source_url || "";

  return `
${a.country}
${a.location}
${formatDateRange(a)}

${s.emoji} ${topic}

${a.summary}

${a.recommendations ? `Recommendations:\n${a.recommendations}` : ""}

${sources ? `Sources:\n${sources}` : ""}
`.trim();
}

/* =========================
   Component
========================= */

export default function AlertReviewQueueInline({ permissions }: Props) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, Partial<Alert>>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (permissions.canReview) void loadAlerts();
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
    } catch (e: any) {
      setError(e?.message || "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }

  /* =========================
     Editing
  ========================= */

  function startEdit(a: Alert) {
    setEditing((e) => ({ ...e, [a.id]: true }));
    setDrafts((ds) => ({ ...ds, [a.id]: { ...a } }));
  }

  function cancelEdit(id: string) {
    setEditing((e) => ({ ...e, [id]: false }));
    // Keep draft around (optional). If you want to drop it:
    // setDrafts(ds => { const n = { ...ds }; delete n[id]; return n; });
  }

  async function saveEdit(id: string) {
    const patch = drafts[id];
    if (!patch) return;

    // basic sanity: end >= start
    if (
      patch.event_start_date &&
      patch.event_end_date &&
      patch.event_end_date < patch.event_start_date
    ) {
      window.alert("End date cannot be before start date.");
      return;
    }

    await fetch(`${API_BASE}/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });

    setAlerts((a) => a.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    setEditing((e) => ({ ...e, [id]: false }));
  }

  /* =========================
     Actions
  ========================= */

  async function approve(id: string) {
    await fetch(`${API_BASE}/alerts/${id}/approve`, { method: "POST" });
    setAlerts((a) => a.filter((x) => x.id !== id));
  }

  async function dismiss(id: string) {
    await fetch(`${API_BASE}/alerts/${id}/dismiss`, { method: "POST" });
    setAlerts((a) => a.filter((x) => x.id !== id));
  }

  async function del(id: string) {
    if (!window.confirm("Delete alert permanently?")) return;
    await fetch(`${API_BASE}/alerts/${id}`, { method: "DELETE" });
    setAlerts((a) => a.filter((x) => x.id !== id));
  }

  /* =========================
     Batch
  ========================= */

  async function batchDismiss() {
    if (!selected.size) return;
    if (!window.confirm(`Dismiss ${selected.size} alerts?`)) return;
    await Promise.all(
      [...selected].map((id) =>
        fetch(`${API_BASE}/alerts/${id}/dismiss`, { method: "POST" })
      )
    );
    setAlerts((a) => a.filter((x) => !selected.has(x.id)));
    setSelected(new Set());
  }

  async function batchDelete() {
    if (!selected.size) return;
    if (!window.confirm(`DELETE ${selected.size} alerts?`)) return;
    await Promise.all(
      [...selected].map((id) => fetch(`${API_BASE}/alerts/${id}`, { method: "DELETE" }))
    );
    setAlerts((a) => a.filter((x) => !selected.has(x.id)));
    setSelected(new Set());
  }

  /* =========================
     Render
  ========================= */

  if (!permissions.canReview) {
    return <div className="p-4 text-gray-500">No review permissions</div>;
  }

  if (loading) return <div className="p-6">Loading alerts…</div>;

  if (error) {
    return (
      <div className="p-4 border border-red-300 bg-red-50 rounded">
        <div className="text-red-700 mb-2">{error}</div>
        <button
          className="px-3 py-1 bg-red-600 text-white rounded"
          onClick={() => void loadAlerts()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {selected.size > 0 && (
        <div className="sticky top-0 z-10 p-3 bg-gray-50 border rounded flex gap-3">
          <strong>{selected.size} selected</strong>
          <button
            onClick={() => void batchDismiss()}
            className="bg-yellow-600 text-white px-3 py-1 rounded"
          >
            Batch Dismiss
          </button>
          <button
            onClick={() => void batchDelete()}
            className="bg-red-600 text-white px-3 py-1 rounded"
          >
            Batch Delete
          </button>
        </div>
      )}

      {alerts.map((a) => {
        const meta = SEVERITY_META[a.severity];
        const open = !!expanded[a.id];
        const edit = !!editing[a.id];
        const d = (drafts[a.id] || a) as Alert;

        return (
          <div key={a.id} className="border rounded bg-white shadow-sm">
            {/* Header */}
            <div className="flex items-center gap-3 p-4">
              <input
                type="checkbox"
                checked={selected.has(a.id)}
                onChange={() =>
                  setSelected((s) => {
                    const n = new Set(s);
                    n.has(a.id) ? n.delete(a.id) : n.add(a.id);
                    return n;
                  })
                }
              />

              <button
                className="text-xs underline"
                onClick={() => setExpanded((e) => ({ ...e, [a.id]: !open }))}
              >
                {open ? "Collapse" : "Expand"}
              </button>

              <div className="flex-1">
                {edit ? (
                  <input
                    className="w-full border px-2 py-1 rounded"
                    value={d.title}
                    onChange={(e) =>
                      setDrafts((ds) => ({
                        ...ds,
                        [a.id]: { ...d, title: e.target.value },
                      }))
                    }
                  />
                ) : (
                  <div className="font-semibold">{a.title}</div>
                )}
              </div>

              <span className={`text-xs text-white px-2 py-1 rounded ${meta.color}`}>
                {meta.emoji} {meta.label}
              </span>
            </div>

            {/* Expanded */}
            {open && (
              <div className="px-6 pb-4 space-y-4 text-sm">
                {/* Meta */}
                <div className="grid grid-cols-2 gap-3">
                  <input
                    disabled={!edit}
                    className="border p-1 rounded"
                    value={d.location}
                    onChange={(e) =>
                      setDrafts((ds) => ({
                        ...ds,
                        [a.id]: { ...d, location: e.target.value },
                      }))
                    }
                  />

                  <select
                    disabled={!edit}
                    className="border p-1 rounded"
                    value={d.severity}
                    onChange={(e) =>
                      setDrafts((ds) => ({
                        ...ds,
                        [a.id]: { ...d, severity: e.target.value as Alert["severity"] },
                      }))
                    }
                  >
                    <option value="critical">🔴 Critical</option>
                    <option value="warning">🟠 Warning</option>
                    <option value="caution">🟡 Caution</option>
                    <option value="informative">🔵 Informative</option>
                  </select>

                  <input
                    type="date"
                    disabled={!edit}
                    className="border p-1 rounded"
                    value={d.event_start_date || ""}
                    onChange={(e) =>
                      setDrafts((ds) => ({
                        ...ds,
                        [a.id]: { ...d, event_start_date: e.target.value },
                      }))
                    }
                  />

                  <input
                    type="date"
                    disabled={!edit}
                    className="border p-1 rounded"
                    value={d.event_end_date || ""}
                    onChange={(e) =>
                      setDrafts((ds) => ({
                        ...ds,
                        [a.id]: { ...d, event_end_date: e.target.value },
                      }))
                    }
                  />
                </div>

                {/* Topic */}
                <div className="text-xs text-gray-600">
                  <strong>Topic:</strong> {a.event_type || "General"}{" "}
                  • <strong>When:</strong> {formatDateRange(a)}
                </div>

                {/* Summary */}
                <textarea
                  disabled={!edit}
                  className="w-full border p-2 min-h-[120px] rounded"
                  value={d.summary}
                  onChange={(e) =>
                    setDrafts((ds) => ({
                      ...ds,
                      [a.id]: { ...d, summary: e.target.value },
                    }))
                  }
                />

                {/* Recommendations */}
                <div>
                  <div className="font-semibold mb-1">Recommendations</div>
                  <textarea
                    disabled={!edit}
                    className="w-full border p-2 min-h-[80px] rounded"
                    value={d.recommendations || ""}
                    onChange={(e) =>
                      setDrafts((ds) => ({
                        ...ds,
                        [a.id]: { ...d, recommendations: e.target.value },
                      }))
                    }
                  />
                </div>

                {/* GeoJSON */}
                {a.geojson && (
                  <div>
                    <div className="font-semibold mb-1">Affected Area</div>
                    <GeoJsonPreview geojson={a.geojson} />
                  </div>
                )}

                {/* Sources */}
                <div className="text-xs text-gray-600 space-y-1">
                  {a.sources && (
                    <div>
                      <strong>Sources:</strong> {a.sources}
                    </div>
                  )}
                  {(a.article_url || a.source_url) && (
                    <a
                      href={a.article_url || a.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      View article →
                    </a>
                  )}
                </div>

                {/* Create-tab-only: generate recommendations (manual alerts only) */}
                {!a.ai_generated && (
                  <button
                    onClick={async () => {
                      const res = await fetch(
                        `${API_BASE}/alerts/${a.id}/generate-recommendations`,
                        { method: "POST" }
                      );
                      const data = await res.json();
                      setAlerts((prev) =>
                        prev.map((x) =>
                          x.id === a.id ? { ...x, recommendations: data.recommendations } : x
                        )
                      );
                    }}
                    className="px-3 py-1 border rounded"
                  >
                    Generate Recommendations
                  </button>
                )}

                {/* Actions */}
                <div className="flex gap-2 flex-wrap pt-2">
                  {edit ? (
                    <>
                      <button
                        onClick={() => void saveEdit(a.id)}
                        className="bg-green-600 text-white px-3 py-1 rounded"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => cancelEdit(a.id)}
                        className="px-3 py-1 border rounded"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      {permissions.canEditAlerts && (
                        <button
                          onClick={() => startEdit(a)}
                          className="px-3 py-1 border rounded"
                        >
                          Edit
                        </button>
                      )}

                      {permissions.canApproveAndPost && (
                        <button
                          onClick={() => void approve(a.id)}
                          className="bg-green-600 text-white px-3 py-1 rounded"
                        >
                          Approve & Post
                        </button>
                      )}

                      {permissions.canDismiss && (
                        <button
                          onClick={() => void dismiss(a.id)}
                          className="bg-yellow-600 text-white px-3 py-1 rounded"
                        >
                          Dismiss
                        </button>
                      )}

                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(whatsappTemplate(a));
                          window.alert("Copied WhatsApp alert");
                        }}
                        className="px-3 py-1 border rounded"
                      >
                        Copy WhatsApp
                      </button>

                      {permissions.canDelete && (
                        <button
                          onClick={() => void del(a.id)}
                          className="bg-red-600 text-white px-3 py-1 rounded"
                        >
                          Delete
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
