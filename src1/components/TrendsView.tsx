import React, { useEffect, useState } from "react";
import { apiFetchJson, apiPostJson } from "../lib/utils/api";

/* =========================
   Types
========================= */

export interface Trend {
  id: string;
  country: string;
  category: string;
  count: number;
  highest_severity: "critical" | "warning" | "caution" | "informative";
  last_seen_at: string;
}

/* =========================
   Helpers
========================= */

const SEVERITY_ORDER: Record<string, number> = {
  critical: 4,
  warning: 3,
  caution: 2,
  informative: 1,
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: "bg-red-600",
  warning: "bg-orange-500",
  caution: "bg-yellow-500",
  informative: "bg-blue-500",
};

/* =========================
   Component
========================= */

export default function TrendsView({
  accessToken,
}: {
  accessToken?: string;
}) {
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* =========================
     Load Trends
  ========================= */

const loadTrends = async () => {
  try {
    setLoading(true);
    setError(null);

    const res = await apiFetchJson<{
      ok: boolean;
      trends?: Trend[];
    }>("/trends");

    if (!res?.ok) {
      throw new Error("Failed to fetch trends");
    }

    const sorted =
      res.trends?.slice().sort(
        (a, b) =>
          (SEVERITY_ORDER[b.highest_severity] ?? 0) -
          (SEVERITY_ORDER[a.highest_severity] ?? 0)
      ) ?? [];

    setTrends(sorted);
  } catch (e: any) {
    setError(e.message || "Failed to load trends");
  } finally {
    setLoading(false);
  }
};

useEffect(() => {
  loadTrends();
}, []);

  /* =========================
     Rebuild Trends
  ========================= */

  const rebuildTrends = async () => {
    if (!accessToken) return;

    try {
      setRebuilding(true);
      setError(null);

     await apiPostJson("/trends/rebuild", {});


      await loadTrends();
    } catch (e: any) {
      setError(e.message || "Failed to rebuild trends");
    } finally {
      setRebuilding(false);
    }
  };

  /* =========================
     Render
  ========================= */

  if (loading) {
    return <div className="p-4 text-sm">Loading trends…</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Trends</h2>

        <button
          onClick={rebuildTrends}
          disabled={rebuilding}
          className="px-3 py-1 rounded bg-indigo-600 text-white text-sm disabled:opacity-50"
        >
          {rebuilding ? "Rebuilding…" : "Rebuild Trends"}
        </button>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      {!trends.length && (
        <div className="p-6 text-gray-500 text-sm">
          No trends detected.
          <br />
          <span className="text-xs">
            (Requires ≥ 3 related alerts in the last 7 days)
          </span>
        </div>
      )}

      {/* Trend Cards */}
      <div className="space-y-3">
        {trends.map((t) => (
          <div
            key={t.id}
            className="border rounded p-4 bg-white shadow-sm space-y-1"
          >
            <div className="flex items-center justify-between">
              <div className="font-semibold">
                {t.country} — {t.category}
              </div>

              <span
                className={`text-xs text-white px-2 py-1 rounded ${
                  SEVERITY_COLOR[t.highest_severity] || "bg-gray-400"
                }`}
              >
                {t.highest_severity.toUpperCase()}
              </span>
            </div>

            <div className="text-sm text-gray-600">
              {t.count} related alerts
            </div>

            <div className="text-xs text-gray-400">
              Last seen: {new Date(t.last_seen_at).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
