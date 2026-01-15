import React, { useEffect, useState, useCallback } from "react";

/* ... Types (Unchanged) ... */

export default function AlertReviewQueueInline({ permissions }: Props) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, Partial<Alert>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/alerts/review`);
      if (!res.ok) throw new Error("Failed to load alerts");
      const data = await res.json();
      setAlerts(data.alerts || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (permissions.canReview) loadAlerts();
  }, [permissions.canReview, loadAlerts]);

  /* =========================
     Single actions
  ========================= */

  const approve = async (id: string) => {
    await fetch(`${API_BASE}/alerts/${id}/approve`, { method: "POST" });
    setAlerts(prev => prev.filter(x => x.id !== id));
  };

  const copyWhatsApp = (alertData: Alert) => {
    navigator.clipboard.writeText(whatsappTemplate(alertData));
    window.alert("Copied to clipboard"); // Explicitly use window.alert
  };

  /* =========================
     Batch actions (Optimized)
  ========================= */

  const batchDismiss = async () => {
    if (!selected.size || !window.confirm(`Dismiss ${selected.size} alerts?`)) return;
    const ids = Array.from(selected);
    await Promise.all(ids.map(id => fetch(`${API_BASE}/alerts/${id}/dismiss`, { method: "POST" })));
    setAlerts(a => a.filter(x => !selected.has(x.id)));
    setSelected(new Set());
  };

  /* =========================
     Render
  ========================= */

  if (!permissions.canReview) return <div className="p-4 text-gray-500">No review permissions.</div>;
  if (loading) return <div className="p-6">Loading alerts…</div>;

  return (
    <div className="space-y-4">
      {selected.size > 0 && (
        <div className="flex gap-3 p-3 border rounded bg-gray-50 sticky top-0 z-10 shadow-md">
          <span className="font-bold">{selected.size} selected</span>
          <button onClick={batchDismiss} className="px-3 py-1 bg-yellow-600 text-white rounded text-sm">Batch Dismiss</button>
        </div>
      )}

      {alerts.map(item => {
        const meta = SEVERITY_META[item.severity];
        const isOpen = expanded[item.id];
        const isEditing = editing[item.id];
        const draft = drafts[item.id] || item;

        return (
          <div key={item.id} className="border rounded bg-white shadow-sm overflow-hidden">
            {/* Header: Clickable only on non-interactive areas */}
            <div className="flex items-center gap-3 p-4">
              <input
                type="checkbox"
                checked={selected.has(item.id)}
                onChange={(e) => {
                  e.stopPropagation(); // Prevents expanding row when clicking checkbox
                  setSelected(s => {
                    const n = new Set(s);
                    n.has(item.id) ? n.delete(item.id) : n.add(item.id);
                    return n;
                  });
                }}
              />

              <div 
                className="flex-1 cursor-pointer flex items-center gap-3"
                onClick={() => setExpanded(e => ({ ...e, [item.id]: !isOpen }))}
              >
                {isEditing ? (
                  <select
                    className="border rounded px-2 py-1 text-sm"
                    value={draft.severity}
                    onClick={(e) => e.stopPropagation()} // Stop bubble to expansion
                    onChange={e => setDrafts(d => ({
                        ...d,
                        [item.id]: { ...draft, severity: e.target.value as Alert["severity"] },
                    }))}
                  >
                    <option value="critical">🔴 Critical</option>
                    <option value="warning">🟠 Warning</option>
                    <option value="caution">🟡 Caution</option>
                    <option value="informative">🔵 Informative</option>
                  </select>
                ) : (
                  <span className={`text-xs text-white px-2 py-1 rounded ${meta.color}`}>
                    {meta.emoji} {meta.label}
                  </span>
                )}
                <span className="font-medium text-sm truncate">{item.title}</span>
              </div>
              
              <div className="flex gap-2">
                 <button onClick={() => approve(item.id)} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Approve</button>
                 <button onClick={() => copyWhatsApp(item)} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Copy</button>
              </div>
            </div>

            {/* Expanded Content */}
            {isOpen && (
              <div className="px-11 pb-4 space-y-3 text-sm border-t pt-3">
                {isEditing ? (
                  <textarea
                    className="w-full border rounded p-2 min-h-[100px]"
                    value={draft.summary || ""}
                    onChange={e => setDrafts(d => ({
                        ...d,
                        [item.id]: { ...draft, summary: e.target.value },
                    }))}
                  />
                ) : (
                  <div className="text-gray-700 leading-relaxed">{item.summary}</div>
                )}

                <div className="flex gap-2">
                  {isEditing ? (
                    <>
                      <button onClick={() => saveEdit(item.id)} className="px-3 py-1 bg-green-600 text-white rounded">Save</button>
                      <button onClick={() => cancelEdit(item.id)} className="px-3 py-1 bg-gray-300 rounded">Cancel</button>
                    </>
                  ) : (
                    permissions.canEditAlerts && (
                      <button onClick={() => startEdit(item)} className="px-3 py-1 border rounded hover:bg-gray-50">Edit</button>
                    )
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
