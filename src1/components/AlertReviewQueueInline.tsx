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

  event_type?: string;
  severity: "critical" | "warning" | "caution" | "informative";
  status: string;

  source_url?: string;
  article_url?: string;
  sources?: string;

  event_start_date?: string;
  event_end_date?: string;

  geojson?: any;

  ai_generated?: boolean;
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
  critical: { emoji: "Ã°Å¸â€Â´", label: "CRITICAL", color: "bg-red-600" },
  warning: { emoji: "Ã°Å¸Å¸Â ", label: "WARNING", color: "bg-orange-500" },
  caution: { emoji: "Ã°Å¸Å¸Â¡", label: "CAUTION", color: "bg-yellow-500" },
  informative: { emoji: "Ã°Å¸â€Âµ", label: "INFO", color: "bg-blue-500" },
};

function formatDateRange(a: Alert) {
  const start = a.event_start_date || "";
  const end = a.event_end_date || "";
  if (start && end) return `${start} Ã¢â€ â€™ ${end}`;
  if (start && !end) return `${start} (ongoing)`;
  if (!start && end) return `until ${end}`;
  return "Ongoing";
}

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

  function startEdit(a: Alert) {
    setEditing((e) => ({ ...e, [a.id]: true }));
    setDrafts((ds) => ({ ...ds, [a.id]: { ...a } }));
  }

  function cancelEdit(id: string) {
    setEditing((e) => ({ ...e, [id]: false }));
  }

  async function saveEdit(id: string) {
    const patch = drafts[id];
    if (!patch) return;

    await fetch(`${API_BASE}/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });

    setAlerts((a) => a.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    setEditing((e) => ({ ...e, [id]: false }));
  }

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
      [...selected].map((id) =>
        fetch(`${API_BASE}/alerts/${id}`, { method: "DELETE" })
      )
    );

    setAlerts((a) => a.filter((x) => !selected.has(x.id)));
    setSelected(new Set());
  }

  if (!permissions.canReview) {
    return <div className="p-4 text-gray-500">No review permissions</div>;
  }

  if (loading) return <div className="p-6">Loading alertsÃ¢â‚¬Â¦</div>;

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
    {permissions.canScour && (
      <div className="flex justify-end">
        <button
          className="px-4 py-2 bg-indigo-600 text-white rounded"
          onClick={() => fetch(`${API_BASE}/scour-sources`, { method: "POST" })}
        >
          Run Scour
        </button>
      </div>
    )}
      {permissions.canScour && (
        <div className="flex justify-end mb-3">
          <button
            onClick={async () => {
              await fetch(`${API_BASE}/scour-sources`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
              });
              window.alert("Scour started");
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded"
          >
            Run Scour
          </button>
        </div>
      )}

      {selected.size > 0 && (
        <div className="sticky top-0 z-10 p-3 bg-gray-50 border rounded flex gap-3">
          <strong>{selected.size} selected</strong>
          <button
            onClick={batchDismiss}
            className="bg-yellow-600 text-white px-3 py-1 rounded"
          >
            Batch Dismiss
          </button>
          <button
            onClick={batchDelete}
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
                onClick={() =>
                  setExpanded((e) => ({ ...e, [a.id]: !open }))
                }
              >
                {open ? "Collapse" : "Expand"}
              </button>

              <div className="flex-1 font-semibold">{a.title}</div>

              <span
                className={`text-xs text-white px-2 py-1 rounded ${meta.color}`}
              >
                {meta.emoji} {meta.label}
              </span>
            </div>

            {open && (
              <div className="px-6 pb-4 space-y-4 text-sm">
                <div>{a.summary}</div>

                {a.geojson && <GeoJsonPreview geojson={a.geojson} />}

                <div className="flex gap-2 flex-wrap">
                  {permissions.canApproveAndPost && (
                    <button
                      onClick={() => approve(a.id)}
                      className="bg-green-600 text-white px-3 py-1 rounded"
                    >
                      Approve & Post
                    </button>
                  )}

                  {permissions.canDismiss && (
                    <button
                      onClick={() => dismiss(a.id)}
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
                      onClick={() => del(a.id)}
                      className="bg-red-600 text-white px-3 py-1 rounded"
                    >
                      Delete
                    </button>
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




