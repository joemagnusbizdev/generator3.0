import React, { useEffect, useState } from "react";
import { supabase } from "./lib/supabase/client";

import AlertReviewQueueInline, {
  type PermissionSet,
} from "./components/AlertReviewQueueInline";

/* =========================
   Permissions
========================= */

type Role = "operator" | "analyst" | "admin";

function getPermissions(role: Role): PermissionSet {
  return {
    canReview: role !== "operator",
    canScour: role !== "operator",
    canApproveAndPost: role === "admin",
    canDismiss: role !== "operator",
    canDelete: role === "admin",
    canEditAlerts: role !== "operator",
  };
}

/* =========================
   App
========================= */

export default function App(): JSX.Element {
  const [role, setRole] = useState<Role>("operator");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setRole(
          (data.session.user.user_metadata?.role as Role) ?? "operator"
        );
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="p-6">Loading…</div>;
  }

  const permissions = getPermissions(role);

  return (
    <main className="p-6">
      <AlertReviewQueueInline permissions={permissions} />
    </main>
  );
}
