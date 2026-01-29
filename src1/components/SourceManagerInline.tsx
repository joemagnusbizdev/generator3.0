import React, { useEffect, useMemo, useState } from "react";
import { apiFetchJson, apiPatchJson, apiPostJson } from "../lib/utils/api";
import { useScour } from "./ScourContext";
import { SourceBulkUpload } from "./SourceBulkUpload";
import { OPMLImport } from "./OPMLImport";
import ScourStatusBarInline from "./ScourStatusBarInline";
import { AutoScourSettings } from "./AutoScourSettings";
import MAGNUS_COLORS from "../styles/magnus-colors";

/* =========================
   Types
========================= */

interface Source {
  id: string;
  name: string;
  url: string;
  country?: string;
  enabled: boolean;
  created_at: string;
  alertCount?: number;
  lastAlertDate?: string | null;
  reachable?: boolean;
  underperforming?: boolean;
}

interface Props {
  accessToken: string;
  permissions?: {
    canManageSources?: boolean;
    canScour?: boolean;
  };
}

/* =========================
   Component
========================= */

const SourceManagerInline: React.FC<Props> = ({
  accessToken,
  permissions,
}) => {
  const [sources, setSources] = useState<Source[]>([]);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Source>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [enabledTotal, setEnabledTotal] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSource, setNewSource] = useState({ name: "", url: "", country: "" });
  const [addingSource, setAddingSource] = useState(false);

  const { isScouring, startScour, stopScour } = useScour();

  const canManage = permissions?.canManageSources !== false;
  const canScour = permissions?.canScour !== false;

  /* =========================
     Load Sources
  ========================= */

  async function loadSources() {
    try {
      setLoading(true);
      const searchParam = search.trim() ? `&search=${encodeURIComponent(search.trim())}` : '';
      const res = await apiFetchJson<{ ok: boolean; sources: Source[]; total: number; page: number; pageSize: number }>(
        `/analytics/sources?page=${page}&pageSize=${pageSize}${searchParam}`,
        accessToken
      );
      if (res.ok) {
        setSources(res.sources || []);
        setTotal(res.total || 0);
        setEnabledTotal((res as any).stats?.enabled || 0);
      } else {
        setSources([]);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load sources");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSources();
  }, [accessToken, page, pageSize, search]);

  // Reset to page 1 when search changes
  useEffect(() => {
    if (search.trim()) {
      setPage(1);
    }
  }, [search]);

  /* =========================
     Search / Filter
  ========================= */

  // Remove client-side filtering since search is now server-side
  const filteredSources = sources;

  /* =========================
     Scour
  ========================= */

  async function runScour() {
    // Use global enabledTotal to reflect all enabled sources, not just filtered
    if (enabledTotal === 0) {
      alert("No enabled sources available to scour");
      return;
    }

    // Start scour with no sourceIds to use all enabled sources globally
    await startScour(accessToken, {
      daysBack: 14,
    });
  }

  // Force stop: Kill all scour jobs in database
  async function forceStopScour() {
    if (!confirm("Force stop all running scour jobs? This will clear all job data.")) {
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/app_kv?key=like.scour_job:*`, {
        method: 'DELETE',
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        console.log('[ForceStop] All scour jobs cleared');
        stopScour(); // Also stop local polling
        alert('All scour jobs force stopped');
      } else {
        console.error('[ForceStop] Failed:', response.status);
        alert('Failed to force stop scour jobs');
      }
    } catch (e: any) {
      console.error('[ForceStop] Error:', e);
      alert(`Error: ${e.message}`);
    }
  }

  /* =========================
     Edit / Delete
  ========================= */

  function startEdit(source: Source) {
    setEditingId(source.id);
    setDraft({
      name: source.name,
      url: source.url,
      country: source.country,
      enabled: source.enabled,
    });
  }

  async function saveEdit() {
    if (!editingId) return;

    await apiPatchJson(`/sources/${editingId}`, draft, accessToken);

    setEditingId(null);
    setDraft({});
    loadSources();
  }

  async function deleteSource(id: string) {
    if (!confirm("Delete this source?")) return;

    await apiFetchJson(`/sources/${id}`, accessToken, {
      method: "DELETE",
    });

    loadSources();
  }

  async function addSingleSource() {
    if (!newSource.url.trim()) {
      alert("URL is required");
      return;
    }

    setAddingSource(true);
    try {
      const res = await apiPostJson("/sources", newSource, accessToken) as any;
      if (res.ok) {
        setNewSource({ name: "", url: "", country: "" });
        setShowAddForm(false);
        loadSources();
        alert(`Source ${res.action === 'updated' ? 'updated' : 'added'} successfully!`);
      } else {
        alert(`Error: ${res.error || 'Failed to add source'}`);
      }
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setAddingSource(false);
    }
  }

  /* =========================
     Render
  ========================= */

  return (
    <div className="space-y-4">
      {/* Auto-Scour */}
      {canManage && (
        <AutoScourSettings accessToken={accessToken} isAdmin />
      )}

      {/* OPML Import */}
      {canManage && (
        <OPMLImport accessToken={accessToken} onImportComplete={loadSources} />
      )}

      {/* Bulk Upload */}
      {canManage && (
        <SourceBulkUpload
          accessToken={accessToken}
          onUploadComplete={loadSources}
        />
      )}

      {/* Single Source Add */}
      {canManage && (
        <div className="border rounded-lg p-4" style={{ backgroundColor: MAGNUS_COLORS.offWhite, borderColor: MAGNUS_COLORS.deepGreen }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold" style={{ color: MAGNUS_COLORS.darkGreen }}>
              ➕ Add Individual Source
            </h3>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="text-sm px-3 py-1 rounded"
              style={{ 
                backgroundColor: showAddForm ? MAGNUS_COLORS.caution : MAGNUS_COLORS.deepGreen,
                color: 'white'
              }}
            >
              {showAddForm ? 'Cancel' : 'Add Source'}
            </button>
          </div>
          
          {showAddForm && (
            <div className="space-y-3 mt-3">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: MAGNUS_COLORS.darkGreen }}>
                  Source URL <span style={{ color: MAGNUS_COLORS.critical }}>*</span>
                </label>
                <input
                  type="url"
                  value={newSource.url}
                  onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
                  placeholder="https://example.com/rss"
                  className="w-full px-3 py-2 border rounded"
                  style={{ borderColor: MAGNUS_COLORS.deepGreen }}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: MAGNUS_COLORS.darkGreen }}>
                    Source Name
                  </label>
                  <input
                    type="text"
                    value={newSource.name}
                    onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                    placeholder="News Source Name"
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: MAGNUS_COLORS.darkGreen }}>
                    Country
                  </label>
                  <input
                    type="text"
                    value={newSource.country}
                    onChange={(e) => setNewSource({ ...newSource, country: e.target.value })}
                    placeholder="e.g., US, UK, FR"
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
              </div>
              
              <button
                onClick={addSingleSource}
                disabled={addingSource || !newSource.url.trim()}
                className="px-4 py-2 rounded text-white font-semibold disabled:opacity-50"
                style={{ backgroundColor: MAGNUS_COLORS.deepGreen }}
              >
                {addingSource ? 'Adding...' : 'Add Source'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Scour Status - TEMPORARILY REMOVED during rebuild */}
      {/* <ScourStatusBarInline accessToken={accessToken} /> */}

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <button
          onClick={runScour}
          disabled={isScouring || !canScour}
          className="px-3 py-1 rounded text-white disabled:opacity-50 font-semibold transition hover:opacity-90"
          style={{ backgroundColor: MAGNUS_COLORS.darkGreen }}
        >
          {isScouring ? "Scouring…" : "Run Scour"}
        </button>

        {isScouring && (
          <button
            onClick={forceStopScour}
            className="px-3 py-1 rounded text-white font-semibold transition hover:opacity-90"
            style={{ backgroundColor: MAGNUS_COLORS.orange }}
          >
            ⊗ Force Stop
          </button>
        )}

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search sources…"
          className="border px-2 py-1 rounded text-sm"
        />

        <span className="text-sm" style={{ color: MAGNUS_COLORS.secondaryText }}>
          {enabledTotal} / {total} enabled
        </span>
      </div>

      {error && <div style={{ color: MAGNUS_COLORS.critical }}>{error}</div>}
      {loading && <div className="text-sm" style={{ color: MAGNUS_COLORS.secondaryText }}>Loading…</div>}

      {/* Sources List */}
      <div className="border rounded divide-y">
        {filteredSources.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-2 p-2 text-sm"
          >
            {editingId === s.id ? (
              <>
                <input
                  value={draft.name || ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, name: e.target.value }))
                  }
                  className="border px-1 w-40"
                />

                <input
                  value={draft.url || ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, url: e.target.value }))
                  }
                  className="border px-1 flex-1"
                />

                <input
                  value={draft.country || ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, country: e.target.value }))
                  }
                  className="border px-1 w-28"
                />

                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={!!draft.enabled}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        enabled: e.target.checked,
                      }))
                    }
                  />
                  enabled
                </label>

                <button
                  onClick={saveEdit}
                  className="font-semibold hover:opacity-80 transition"
                  style={{ color: MAGNUS_COLORS.caution }}
                >
                  Save
                </button>
                <button onClick={() => setEditingId(null)}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <strong className="w-40 truncate flex items-center gap-2">
                  {s.name}
                  {s.reachable === false && <span title="Unreachable" style={{ color: MAGNUS_COLORS.critical }}>❌</span>}
                  {s.underperforming && <span title="Underperforming" style={{ color: MAGNUS_COLORS.warning }}>⚠️</span>}
                </strong>
                <span className="flex-1 truncate" style={{ color: MAGNUS_COLORS.secondaryText }}>
                  {s.url}
                </span>
                <span className="w-28">
                  {s.country || "—"}
                </span>
                <span className="w-28" style={{ color: MAGNUS_COLORS.secondaryText }}>
                  {typeof s.alertCount === 'number' ? `${s.alertCount} alerts` : '—'}
                </span>
                <span>{s.enabled ? "✅" : "❌"}</span>

                {canManage && (
                  <>
                    <button
                      onClick={() => startEdit(s)}
                      className="font-semibold hover:opacity-80 transition"
                      style={{ color: MAGNUS_COLORS.deepGreen }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteSource(s.id)}
                      className="font-semibold hover:opacity-80 transition"
                      style={{ color: MAGNUS_COLORS.critical }}
                    >
                      Delete
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <button
          onClick={() => setPage(1)}
          disabled={page <= 1}
          className="px-3 py-1 rounded font-semibold transition hover:opacity-90 disabled:opacity-50 text-xs"
          style={{ backgroundColor: MAGNUS_COLORS.offWhite, color: MAGNUS_COLORS.darkGreen }}
          title="First page"
        >
          ⏮ First
        </button>
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="px-3 py-1 rounded font-semibold transition hover:opacity-90 disabled:opacity-50 text-xs"
          style={{ backgroundColor: MAGNUS_COLORS.offWhite, color: MAGNUS_COLORS.darkGreen }}
        >
          ⏪ Prev
        </button>
        <span className="text-xs" style={{ color: MAGNUS_COLORS.secondaryText }}>
          Page <strong>{page}</strong> of <strong>{Math.ceil(total / pageSize)}</strong>
        </span>
        <button
          onClick={() => setPage((p) => (p * pageSize < total ? p + 1 : p))}
          disabled={page * pageSize >= total}
          className="px-3 py-1 rounded font-semibold transition hover:opacity-90 disabled:opacity-50 text-xs"
          style={{ backgroundColor: MAGNUS_COLORS.offWhite, color: MAGNUS_COLORS.darkGreen }}
        >
          Next ⏩
        </button>
        <button
          onClick={() => setPage(Math.ceil(total / pageSize))}
          disabled={page >= Math.ceil(total / pageSize)}
          className="px-3 py-1 rounded font-semibold transition hover:opacity-90 disabled:opacity-50 text-xs"
          style={{ backgroundColor: MAGNUS_COLORS.offWhite, color: MAGNUS_COLORS.darkGreen }}
          title="Last page"
        >
          Last ⏭
        </button>
        <span className="text-xs" style={{ color: MAGNUS_COLORS.secondaryText }}>
          Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of <strong>{total}</strong>
        </span>
        <select
          value={pageSize}
          onChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(1); }}
          className="border px-2 py-1 rounded text-xs"
          title="Items per page"
        >
          {[25, 50, 100].map((n) => (
            <option key={n} value={n}>{n}/page</option>
          ))}
        </select>
        <button
          onClick={loadSources}
          disabled={loading}
          className="px-3 py-1 rounded font-semibold transition hover:opacity-90 disabled:opacity-50 text-xs"
          style={{ backgroundColor: MAGNUS_COLORS.caution, color: 'white' }}
          title="Refresh source list and counts"
        >
          🔄 Sync
        </button>
      </div>
    </div>
  );
};

export default SourceManagerInline;
