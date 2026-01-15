import React, { useEffect, useState, useCallback } from "react";

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
  sources?: string;
  event_start_date?: string;
  event_end_date?: string;
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

const todayISO = () => new Date().toISOString().slice(0, 10);

/* =========================
   Component
========================= */

export default function AlertReviewQueueInline({ permissions }: Props) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, Partial<Alert>>>({});
  const [loading, setLoading] = useState(true);

  /* =========================
     Load
  ========================= */

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`${API_BASE}/alerts/review`);
    const data = await res.json();
    setAlerts(data.alerts || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (permissions.canReview) loadAlerts();
  }, [permissions.canReview, loadAlerts]);

  /* =========================
     Editing helpers
  ========================= */

  const startEdit = (alert: Alert) => {
    setEditing(e => ({ ...e, [alert.id]: true }));
    setDrafts(d => ({ ...d, [alert.id]: { ...alert } }));
  };

  const cancelEdit = (id: string) =>
    setEditing(e => ({ ...e, [id]: false }));

  const saveEdit = async (id: string) => {
    const payload = drafts[id];
    if (!payload) return;

    if (
      payload.event_start_date &&
      payload.event_end_date &&
      payload.event_end_date < payload.event_start_date
    ) {
      window.alert("End date cannot be before start date");
      return;
    }

    await fetch(`${API_BASE}/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setAlerts(a =>
      a.map(alert => (alert.id === id ? { ...alert, ...payload } : alert))
    );
    setEditing(e => ({ ...e, [id]: false }));
  };

  /* =========================
     Batch dismiss
  ========================= */

  const batchDismiss = async () => {
    if (!selected.size || !window.confirm(`Dismiss ${selected.size} alerts?`))
      return;

    await Promise.all(
      Array.from(selected).map(id =>
        fetch(`${API_BASE}/alerts/${id}/dismiss`, { method: "POST" })
      )
    );

    setAlerts(a => a.filter(x => !selected.has(x.id)));
    setSelected(new Set());
  };

  /* =========================
     Render
  ========================= */

  if (!permissions.canReview)
    return <div className="p-4 text-gray-500">No review permissions.</div>;

  if (loading) return <div className="p-6">Loading alerts…</div>;

  return (
    <div className="space-y-4">
      {selected.size > 0 && (
        <div className="sticky top-0 z-10 flex gap-3 p-3 bg-gray-50 border rounded shadow">
          <strong>{selected.size} selected</strong>
          <button
            onClick={batchDismiss}
            className="px-3 py-1 bg-yellow-600 text-white rounded text-sm"
          >
            Batch Dismiss
          </button>
        </div>
      )}

      {alerts.map(item => {
        const isOpen = expanded[item.id];
        const isEditing = editing[item.id];
        const draft = drafts[item.id] || item;
        const meta = SEVERITY_META[item.severity];

        return (
          <div key={item.id} className="border rounded bg-white shadow-sm">
            {/* HEADER */}
            <div className="flex items-center gap-3 p-4">
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={selected.has(item.id)}
                onChange={() =>
                  setSelected(s => {
                    const n = new Set(s);
                    n.has(item.id) ? n.delete(item.id) : n.add(item.id);
                    return n;
                  })
                }
              />

              {/* Severity */}
              {isEditing ? (
                <select
                  className="border rounded px-2 py-1 text-sm"
                  value={draft.severity}
                  onChange={e =>
                    setDrafts(d => ({
                      ...d,
                      [item.id]: {
                        ...draft,
                        severity: e.target.value as Alert["severity"],
                      },
                    }))
                  }
                >
                  <option value="critical">🔴 Critical</option>
                  <option value="warning">🟠 Warning</option>
                  <option value="caution">🟡 Caution</option>
                  <option value="informative">🔵 Informative</option>
                </select>
              ) : (
                <span
                  className={`text-xs text-white px-2 py-1 rounded ${meta.color}`}
                >
                  {meta.emoji} {meta.label}
                </span>
              )}

              {/* Title + Location */}
              <div className="flex-1">
                {isEditing ? (
                  <>
                    <input
                      className="w-full border rounded px-2 py-1 text-sm mb-1"
                      value={draft.title || ""}
                      onChange={e =>
                        setDrafts(d => ({
                          ...d,
                          [item.id]: { ...draft, title: e.target.value },
                        }))
                      }
                    />
                    <div className="flex gap-2">
                      <input
                        className="border rounded px-2 py-1 text-xs w-1/2"
                        value={draft.location || ""}
                        placeholder="Location"
                        onChange={e =>
                          setDrafts(d => ({
                            ...d,
                            [item.id]: {
                              ...draft,
                              location: e.target.value,
                            },
                          }))
                        }
                      />
                      <input
                        className="border rounded px-2 py-1 text-xs w-1/2"
                        value={draft.country || ""}
                        placeholder="Country"
                        onChange={e =>
                          setDrafts(d => ({
                            ...d,
                            [item.id]: {
                              ...draft,
                              country: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="font-medium text-sm">{item.title}</div>
                    <div className="text-xs text-gray-600">
                      {item.location}, {item.country}
                    </div>
                  </>
                )}
              </div>

              {/* EXPAND BUTTON */}
              <button
                onClick={() =>
                  setExpanded(e => ({ ...e, [item.id]: !isOpen }))
                }
                className="text-xs border rounded px-2 py-1 hover:bg-gray-100"
              >
                {isOpen ? "▲" : "▼"}
              </button>
            </div>

            {/* EXPANDED CONTENT */}
            {isOpen && (
              <div className="px-11 pb-4 space-y-3 text-sm border-t pt-3">
                {isEditing ? (
                  <>
                    <textarea
                      className="w-full border rounded p-2 min-h-[100px]"
                      value={draft.summary || ""}
                      onChange={e =>
                        setDrafts(d => ({
                          ...d,
                          [item.id]: { ...draft, summary: e.target.value },
                        }))
                      }
                    />

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <input
                        type="date"
                        className="border rounded px-2 py-1"
                        value={draft.event_start_date || ""}
                        onChange={e =>
                          setDrafts(d => ({
                            ...d,
                            [item.id]: {
                              ...draft,
                              event_start_date: e.target.value,
                            },
                          }))
                        }
                      />
                      <input
                        type="date"
                        className="border rounded px-2 py-1"
                        value={draft.event_end_date || ""}
                        onChange={e =>
                          setDrafts(d => ({
                            ...d,
                            [item.id]: {
                              ...draft,
                              event_end_date: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>

                    {/* Presets */}
                    <div className="flex gap-2 text-xs">
                      <button
                        onClick={() =>
                          setDrafts(d => ({
                            ...d,
                            [item.id]: {
                              ...draft,
                              event_start_date: todayISO(),
                              event_end_date: null,
                            },
                          }))
                        }
                        className="px-2 py-1 border rounded"
                      >
                        Today
                      </button>
                      <button
                        onClick={() =>
                          setDrafts(d => ({
                            ...d,
                            [item.id]: {
                              ...draft,
                              event_start_date: todayISO(),
                              event_end_date: null,
                            },
                          }))
                        }
                        className="px-2 py-1 border rounded"
                      >
                        Ongoing
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(item.id)}
                        className="px-3 py-1 bg-green-600 text-white rounded"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => cancelEdit(item.id)}
                        className="px-3 py-1 bg-gray-300 rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  permissions.canEditAlerts && (
                    <button
                      onClick={() => startEdit(item)}
                      className="px-3 py-1 border rounded hover:bg-gray-50"
                    >
                      Edit
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
