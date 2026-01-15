import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/client';

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
  sessionToken: string;
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
  severity: 'critical' | 'warning' | 'caution' | 'informative';
  status: string;
  source_url: string;
  article_url?: string;
  sources?: string;
  event_start_date?: string;
  event_end_date?: string;
  ai_generated: boolean;
  ai_model?: string;
  ai_confidence?: number;
  created_at: string;
}

/* =========================
   Component
========================= */

export default function AlertReviewQueueInline({
  sessionToken,
  permissions,
}: Props) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (permissions.canReview) {
      loadAlerts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissions.canReview]);

  async function loadAlerts() {
    try {
      setLoading(true);
      setError(null);

      if (!sessionToken) {
        throw new Error('Missing session token');
      }

      const response = await fetch(
        'https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function/alerts/review',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch alerts (${response.status})`);
      }

      const data = await response.json();

      setAlerts(Array.isArray(data.alerts) ? data.alerts : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }

  if (!permissions.canReview) {
    return (
      <div className="p-4 text-gray-500">
        You do not have permission to review alerts.
      </div>
    );
  }

  if (loading) {
    return <div className="p-6">Loading alerts…</div>;
  }

  if (error) {
    return (
      <div className="p-4 border border-red-300 bg-red-50 rounded">
        <p className="text-red-700 mb-2">{error}</p>
        <button
          onClick={loadAlerts}
          className="px-3 py-1 bg-red-600 text-white rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="p-6 text-gray-600">
        No alerts available.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map(alert => (
        <div
          key={alert.id}
          className="p-4 border rounded bg-white shadow-sm"
        >
          <h3 className="font-semibold">{alert.title}</h3>
          <p className="text-sm text-gray-700">{alert.summary}</p>
          <div className="text-xs text-gray-500 mt-1">
            {alert.location}, {alert.country} • {alert.severity.toUpperCase()}
          </div>
        </div>
      ))}
    </div>
  );
}
