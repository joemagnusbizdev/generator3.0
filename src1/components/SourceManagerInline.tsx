import React, { useEffect, useMemo, useState } from "react";
import { apiFetchJson, apiPatchJson, apiPostJson } from "../lib/utils/api";
import { useScour } from "./ScourContext";
import { SourceBulkUpload } from "./SourceBulkUpload";
import ScourStatusBarInline from "./ScourStatusBarInline";
import { AutoScourSettings } from "./AutoScourSettings";

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

  const { isScouring, startScour } = useScour();

  const canManage = permissions?.canManageSources !== false;
  const canScour = permissions?.canScour !== false;

  /* =========================
     Load Sources
  ========================= */

  async function loadSources() {
    try {
      setLoading(true);
      const res = await apiFetchJson<{ ok: boolean; sources: Source[] }>(
        "/sources",
        accessToken
      );
      setSources(res.ok ? res.sources : []);
    } catch (e: any) {
      setError(e.message || "Failed to load sources");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSources();
  }, [accessToken]);

  /* =========================
     Search / Filter
  ========================= */

  const filteredSources = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sources;

    return sources.filter((s) =>
      [s.name, s.url, s.country]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [sources, search]);

  /* =========================
     Scour
  ========================= */

  async function runScour() {
    const enabled = filteredSources.filter((s) => s.enabled);

    if (!enabled.length) {
      alert("No enabled sources match the current filter");
      return;
    }

    await startScour(accessToken, {
      sourceIds: enabled.map((s) => s.id),
      daysBack: 14,
    });
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

  /* =========================
     Render
  ========================= */

  return (
    <div className="space-y-4">
      {/* Auto-Scour */}
      {canManage && (
        <AutoScourSettings accessToken={accessToken} isAdmin />
      )}

      {/* Bulk Upload */}
      {canManage && (
        <SourceBulkUpload
          accessToken={accessToken}
          onUploadComplete={loadSources}
        />
      )}

      {/* Scour Status */}
      <ScourStatusBarInline />

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <button
          onClick={runScour}
          disabled={isScouring || !canScour}
          className="px-3 py-1 rounded bg-indigo-600 text-white disabled:opacity-50"
        >
          {isScouring ? "Scouring…" : "Run Scour"}
        </button>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search sources…"
          className="border px-2 py-1 rounded text-sm"
        />

        <span className="text-sm text-gray-600">
          {
            filteredSources.filter((s) => s.enabled).length
          }{" "}
          / {filteredSources.length} enabled
        </span>
      </div>

      {error && <div className="text-red-600">{error}</div>}
      {loading && <div className="text-sm text-gray-500">Loading…</div>}

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
                  className="text-green-600"
                >
                  Save
                </button>
                <button onClick={() => setEditingId(null)}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <strong className="w-40 truncate">
                  {s.name}
                </strong>
                <span className="flex-1 truncate text-gray-500">
                  {s.url}
                </span>
                <span className="w-28">
                  {s.country || "—"}
                </span>
                <span>{s.enabled ? "✅" : "❌"}</span>

                {canManage && (
                  <>
                    <button
                      onClick={() => startEdit(s)}
                      className="text-blue-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteSource(s.id)}
                      className="text-red-600"
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
    </div>
  );
};

export default SourceManagerInline;
