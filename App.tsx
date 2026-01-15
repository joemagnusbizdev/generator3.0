import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from './lib/supabase/client';

import AlertReviewQueueInline from './components/AlertReviewQueueInline';

/* =========================
   Permissions
========================= */

type Role = 'operator' | 'analyst' | 'admin';

function getPermissions(role: Role) {
  return {
    canReview: role !== 'operator',
    canScour: role !== 'operator',
    canApproveAndPost: role === 'admin',
    canDismiss: role !== 'operator',
    canDelete: role === 'admin',
    canEditAlerts: role !== 'operator',
  };
}

/* =========================
   App
========================= */

export default function App(): JSX.Element {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [role, setRole] = useState<Role>('operator');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setAccessToken(data.session.access_token);
        setRole(
          (data.session.user.user_metadata?.role as Role) ?? 'operator'
        );
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="p-6">Loading…</div>;
  }

  if (!accessToken) {
    return <div className="p-6">Please log in.</div>;
  }

  const permissions = getPermissions(role);

  return (
    <main className="p-6">
      <AlertReviewQueueInline
        sessionToken={accessToken}
        permissions={permissions}
      />
    </main>
  );
}
