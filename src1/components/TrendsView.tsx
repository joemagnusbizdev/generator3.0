import React, { useEffect, useState } from "react";
import { apiFetchJson } from "../lib/utils/api";

interface Trend {
  id: string;
  country: string;
  category: string;
  count: number;
  highest_severity: string;
  last_seen_at: string;
}

export default function TrendsView({
  accessToken,
}: {
  accessToken?: string;
}) {
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;

    apiFetchJson<Trend[]>("/trends", accessToken)
      .then(setTrends)
      .finally(() => setLoading(false));
  }, [accessToken]);

  if (loading) return <div className="p-4">Loading trends…</div>;

  if (!trends.length) {
    return (
      <div className="p-6 text-gray-500">
        No trends detected (requires ≥ 3 related alerts in 7 days)
      </div>
    );
  }

  return (
    <div className="space-y-3">
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
}
