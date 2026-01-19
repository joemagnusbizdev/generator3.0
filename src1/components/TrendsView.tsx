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
  if (!accessToken) return;

  try {
    setLoading(true);
    setError(null);

    const res = await apiFetchJson<{ ok: boolean; trends?: Trend[] }>(
      "/trends",
      accessToken
    );

    if (!res?.ok) throw new Error("Failed to fetch trends");

    const sorted =
      (res.trends ?? [])
        .slice()
        .sort(
          (a, b) =>
            (SEVERITY_ORDER[b.highest_severity] ?? 0) -
            (SEVERITY_ORDER[a.highest_severity] ?? 0)
        );

    setTrends(sorted);
  } catch (e: any) {
    setError(e?.message || "Failed to load trends");
    setTrends([]);
  } finally {
    setLoading(false);
  }
};


  /* =========================
     Rebuild Trends
  ========================= */

const rebuildTrends = async () => {
  if (!accessToken) return;

  try {
    setLoading(true);
    setError(null);

    await apiFetchJson("/trends/rebuild", accessToken, {
      method: "POST",
    });

    await loadTrends();
  } catch (e: any) {
    setError(e?.message || "Failed to rebuild trends");
  } finally {
    setLoading(false);
  }
};


  /* =========================
     Render
  ========================= */

 if (loading) return <div className="p-4">Loading trends…</div>;

return (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-semibold">Trends</h2>

      <button
        onClick={rebuildTrends}
        className="px-3 py-1.5 text-sm rounded bg-indigo-600 text-white hover:bg-indigo-700"
      >
        Rebuild Trends
      </button>
    </div>

    {error && <div className="text-red-600 text-sm">{error}</div>}

    {!trends.length && (
      <div className="p-4 text-gray-500">
        No trends detected (≥ 3 alerts in last 14 days)
      </div>
    )}

    {trends.map((t) => (
      <div
        key={t.id}
        className="border rounded p-4 bg-white shadow-sm"
      >
        <div className="font-semibold">
          {t.country} — {t.category}
        </div>
        <div className="text-sm text-gray-600">
          {t.count} alerts · highest severity {t.highest_severity}
        </div>
        <div className="text-xs text-gray-400">
          Last seen: {new Date(t.last_seen_at).toLocaleString()}
        </div>
      </div>
    ))}
  </div>
);

