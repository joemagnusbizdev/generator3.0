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
  event_type?: string;
  severity: "critical" | "warning" | "caution" | "informative";
  status: string;
  source_url?: string;
  article_url?: string;
  sources?: string;
  event_start_date?: string;
  event_end_date?: string;
  geojson?: any;
  created_at: string;
}

/* =========================
   Config
========================= */

const API_BASE =
  "https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function";

const SEVERITY_META = {
  critical: { emoji: "🔴", label: "CRITICAL", color: "bg-red-600" },
  warning: { emoji: "🟠", label: "WARNING", color: "bg-orange-500" },
  caution: { emoji: "🟡", label: "CAUTION", color: "bg-yellow-500" },
  informative: { emoji: "🔵", label: "INFO", color: "bg-blue-500" },
};

function whatsappTemplate(a: Alert) {
  const s = SEVERITY_META[a.severity];
  return `
${s.emoji} *${s.label}*

*${a.title}*

📍 ${a.location}, ${a.country}
🗓️ ${a.event_start_date || "Ongoing"}${a.event_end_date ? " → " + a.event_end_date : ""}

${a.summary}

${a.recommendations ? "\n🧭 Recommendations:\n" + a.recommendations : ""}

🔗 ${a.article_url || a.source_url || "—"}
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

  useEffect(() => {
    if (!permissions.canReview) return;
    loadAlerts();
  }, [permissions.canReview]);

  async function loadAlerts() {
    setLoading(true);
    const res = await fetch(`${API_BASE}/alerts/review`);
    const data = await res.json();
    setAlerts(data.alerts || []);
    setLoading(false);
  }

  /* =========================
     Actions
  ========================= */

  async function approve(id: string) {
    await fetch(`${API_BASE}/alerts/${id}/approve`, { method: "POST" });
    setAlerts(a => a.filter(x => x.id !== id));
  }

  async function dismiss(id: string) {
    await fetch(`${API_BASE}/alerts/${id}/dismiss`, { method: "POST" });
    setAlerts(a => a.filter(x => x.id !== id));
  }

  async function del(id: string) {
    if (!window.confirm("Delete alert permanently?")) return;
    await fetch(`${API_BASE}/alerts/${id}`, { method: "DELETE" });
    setAlerts(a => a.filter(x => x.id !== id));
  }

  async function saveEdit(id: string) {
    const patch = drafts[id];
    await fetch(`${API_BASE}/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setAlerts(a =>
      a.map(x => (x.id === id ? { ...x, ...patch } : x))
    );
    setEditing(e => ({ ...e, [id]: false }));
  }

  /* =========================
     Batch
  ========================= */

  async function batchDismiss() {
    if (!selected.size) return;
    if (!window.confirm(`Dismiss ${selected.size} alerts?`)) return;
    await Promise.all(
      [...selected].map(id =>
        fetch(`${API_BASE}/alerts/${id}/dismiss`, { method: "POST" })
      )
    );
    setAlerts(a => a.filter(x => !selected.has(x.id)));
    setSelected(new Set());
  }

  async function batchDelete() {
    if (!selected.size) return;
    if (!window.confirm(`DELETE ${selected.size} alerts?`)) return;
    await Promise.all(
      [...selected].map(id =>
        fetch(`${API_BASE}/alerts/${id}`, { method: "DELETE" })
      )
    );
    setAlerts(a => a.filter(x => !selected.has(x.id)));
    setSelected(new Set());
  }

  /* =========================
     Render
  ========================= */

  if (!permissions.canReview)
    return <div className="p-4 text-gray-500">No review permissions</div>;

  if (loading) return <div className="p-6">Loading alerts…</div>;

  return (
    <div className="space-y-4">
      {selected.size > 0 && (
        <div className="sticky top-0 z-10 p-3 bg-gray-50 border rounded flex gap-3">
          <strong>{selected.size} selected</strong>
          <button onClick={batchDismiss} className="bg-yellow-600 text-white px-3 py-1 rounded">
            Batch Dismiss
          </button>
          <button onClick={batchDelete} className="bg-red-600 text-white px-3 py-1 rounded">
            Batch Delete
          </button>
        </div>
      )}

      {alerts.map(a => {
        const meta = SEVERITY_META[a.severity];
        const open = expanded[a.id];
        const edit = editing[a.id];
        const d = drafts[a.id] || a;

        return (
          <div key={a.id} className="border rounded bg-white shadow-sm">
            {/* Header */}
            <div className="flex items-center gap-3 p-4">
              <input
                type="checkbox"
                checked={selected.has(a.id)}
                onChange={() =>
                  setSelected(s => {
                    const n = new Set(s);
                    n.has(a.id) ? n.delete(a.id) : n.add(a.id);
                    return n;
                  })
                }
              />

              <button
                className="text-xs underline"
                onClick={() =>
                  setExpanded(e => ({ ...e, [a.id]: !open }))
                }
              >
                {open ? "Collapse" : "Expand"}
              </button>

              {edit ? (
                <input
                  className="flex-1 border px-2 py-1"
                  value={d.title}
                  onChange={e =>
                    setDrafts(ds => ({
                      ...ds,
                      [a.id]: { ...d, title: e.target.value },
                    }))
                  }
                />
              ) : (
                <div className="flex-1 font-semibold">{a.title}</div>
              )}

              <span className={`text-xs text-white px-2 py-1 rounded ${meta.color}`}>
                {meta.emoji} {meta.label}
              </span>
            </div>

            {/* Expanded */}
            {open && (
              <div className="px-6 pb-4 space-y-3 text-sm">
                {/* Location / Severity / Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <input
                    disabled={!edit}
                    className="border p-1"
                    value={d.location}
                    onChange={e => setDrafts(ds => ({ ...ds, [a.id]: { ...d, location: e.target.value } }))}
                  />
                  <select
                    disabled={!edit}
                    className="border p-1"
                    value={d.severity}
                    onChange={e =>
                      setDrafts(ds => ({
                        ...ds,
                        [a.id]: { ...d, severity: e.target.value as any },
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
                    value={d.event_start_date || ""}
                    onChange={e =>
                      setDrafts(ds => ({
                        ...ds,
                        [a.id]: { ...d, event_start_date: e.target.value },
                      }))
                    }
                  />
                  <input
                    type="date"
                    disabled={!edit}
                    value={d.event_end_date || ""}
                    onChange={e =>
                      setDrafts(ds => ({
                        ...ds,
                        [a.id]: { ...d, event_end_date: e.target.value },
                      }))
                    }
                  />
                </div>

                {/* Summary */}
                <textarea
                  disabled={!edit}
                  className="w-full border p-2 min-h-[120px]"
                  value={d.summary}
                  onChange={e =>
                    setDrafts(ds => ({
                      ...ds,
                      [a.id]: { ...d, summary: e.target.value },
                    }))
                  }
                />

                {/* Sources */}
                <div className="text-xs text-gray-600">
                  {a.sources && <div><strong>Sources:</strong> {a.sources}</div>}
                  {(a.article_url || a.source_url) && (
                    <a href={a.article_url || a.source_url} target="_blank" rel="noreferrer" className="underline">
                      View article →
                    </a>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-wrap pt-2">
                  {edit ? (
                    <>
                      <button onClick={() => saveEdit(a.id)} className="bg-green-600 text-white px-3 py-1 rounded">
                        Save
                      </button>
                      <button onClick={() => setEditing(e => ({ ...e, [a.id]: false }))}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      {permissions.canEditAlerts && (
                        <button onClick={() => setEditing(e => ({ ...e, [a.id]: true }))}>
                          Edit
                        </button>
                      )}
                      {permissions.canApproveAndPost && (
                        <button onClick={() => approve(a.id)} className="bg-green-600 text-white px-3 py-1 rounded">
                          Approve & Post
                        </button>
                      )}
                      {permissions.canDismiss && (
                        <button onClick={() => dismiss(a.id)} className="bg-yellow-600 text-white px-3 py-1 rounded">
                          Dismiss
                        </button>
                      )}
                      <button onClick={() => navigator.clipboard.writeText(whatsappTemplate(a))}>
                        Copy WhatsApp
                      </button>
                      {permissions.canDelete && (
                        <button onClick={() => del(a.id)} className="bg-red-600 text-white px-3 py-1 rounded">
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
