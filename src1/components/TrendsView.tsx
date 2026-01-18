import React, { useEffect, useState } from "react";
import { apiFetchJson, apiPostJson } from "../lib/utils/api";

interface Trend {
  id: string;
  country: string;
  category: string;
  count: number;
  highest_severity: string;
  last_seen_at: string;
}

export default function TrendsView({ accessToken }: { accessToken?: string }) {
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!accessToken) return;
    setLoading(true);
    const res = await apiFetchJson<{ ok: boolean; trends: Trend[] }>(
      "/trends",
      accessToken
    );
    setTrends(res.trends || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [accessToken]);

  const rebuild = async () => {
    await apiPostJson("/trends/rebuild", {}, accessToken);
    load();
  };

  if (loading) return <div className="p-4">Loading trends…</div>;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={rebuild}
          className="px-3 py-1 bg-indigo-600 text-white rounded"
        >
          Rebuild Trends
        </button>
      </div>

      {!trends.length && (
        <div className="text-gray-500 p-4">
          No trends detected yet
        </div>
      )}

      {trends.map((t) => (
        <div key={t.id} className="border rounded p-4 bg-white">
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
}
