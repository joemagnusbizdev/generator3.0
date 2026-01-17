import React, { useEffect, useState } from "react";
import { supabase } from "./lib/supabase/client";

import AlertReviewQueueInline from "./components/AlertReviewQueueInline";
import AlertCreateInline from "./components/AlertCreateInline";
import SourceManagerInline from "./components/SourceManagerInline";
import TrendsView from "./components/TrendsView";
import AnalyticsDashboardInline from "./components/AnalyticsDashboardInline";
import UserManagementInline from "./components/UserManagementInline";

type Role = "operator" | "analyst" | "admin";

export type PermissionSet = {
  canReview: boolean;
  canScour: boolean;
  canApproveAndPost: boolean;
  canDismiss: boolean;
  canDelete: boolean;
  canEditAlerts: boolean;
};

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

const API_BASE =
  "https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function";

export default function App() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("operator");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setAccessToken(data.session.access_token);
        setRole(
          (data.session.user.user_metadata?.role as Role) ?? "operator"
        );
      }
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-6">Loading…</div>;
  if (!accessToken) return <div className="p-6">Please log in.</div>;

  const permissions = getPermissions(role);

  return (
    <main className="p-6 space-y-10">
      <AlertReviewQueueInline permissions={permissions} />

      <AlertCreateInline
        accessToken={accessToken}
        permissions={{ canCreate: permissions.canEditAlerts }}
      />

      <SourceManagerInline
        accessToken={accessToken}
        permissions={{
          canManageSources: permissions.canEditAlerts,
          canScour: permissions.canScour,
        }}
      />

      <TrendsView />

      <AnalyticsDashboardInline
        apiBase={API_BASE}
        permissions={{
          canAccessAnalytics: true,
          canViewDetailedStats: true,
          canExportAnalytics: permissions.canApproveAndPost,
        }}
      />

      <UserManagementInline
        currentUserRole={role}
        permissions={{
          canManageUsers: role === "admin",
          canViewUsers: role !== "operator",
          canChangeRoles: role === "admin",
        }}
      />
    </main>
  );
}
