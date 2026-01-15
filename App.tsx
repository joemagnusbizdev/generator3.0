import React, { useEffect, useState } from "react";
import { supabase } from "./lib/supabase/client";

import AlertReviewQueueInline from "./components/AlertReviewQueueInline";

/* =========================
   Types
========================= */

type Role = "operator" | "analyst" | "admin";

export type PermissionSet = {
  canReview: boolean;
  canScour: boolean;
  canApproveAndPost: boolean;
  canDismiss: boolean;
  canDelete: boolean;
  canEditAlerts: boolean;
  canCreate: boolean; // ✅ REQUIRED by other components
};

/* =========================
   Permissions
========================= */

function getPermissions(role: Role): PermissionSet {
  return {
    canReview: role !== "operator",
    canScour: role !== "operator",
    canApproveAndPost: role === "admin",
    canDismiss: role !== "operator",
    canDelete: role === "admin",
    canEditAlerts: role !== "operator",
    canCreate: role !== "operator", // ✅ FIX
  };
}

/* =========================
   App
========================= */

export default function App(): JSX.Element {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("operator");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;

      if (data.session) {
        setAccessToken(data.session.access_token);
        setRole(
          (data.session.user.user_metadata?.role as Role) ?? "operator"
        );
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
    };
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
