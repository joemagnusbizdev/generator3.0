// src1/App.tsx
import React, { useEffect, useState } from "react";
import { supabase } from "./lib/supabase/client";

/* Components */
import AlertReviewQueueInline from "./components/AlertReviewQueueInline";
import AlertCreateInline from "./components/AlertCreateInline";
import SourceManagerInline from "./components/SourceManagerInline";
import TrendsView from "./components/TrendsView";
import AnalyticsDashboardInline from "./components/AnalyticsDashboardInline";
import UserManagementInline from "./components/UserManagementInline";
import ScourStatusBarInline from "./components/ScourStatusBarInline";
import { ScourProvider } from "./components/ScourContext";

/* =========================
   Roles & Permissions
========================= */

type Role = "operator" | "analyst" | "admin";
type Tab =
  | "review"
  | "create"
  | "sources"
  | "trends"
  | "analytics"
  | "admin";

export type PermissionSet = {
  canReview: boolean;
  canScour: boolean;
  canApproveAndPost: boolean;
  canDismiss: boolean;
  canDelete: boolean;
  canEditAlerts: boolean;
  canCreate: boolean;
  canManageSources: boolean;
  canAccessAnalytics: boolean;
  canManageUsers: boolean;
};

function getPermissions(role: Role): PermissionSet {
  return {
    canReview: role !== "operator",
    canScour: role !== "operator",
    canApproveAndPost: role === "admin",
    canDismiss: role !== "operator",
    canDelete: role === "admin",
    canEditAlerts: role !== "operator",
    canCreate: role !== "operator",
    canManageSources: role !== "operator",
    canAccessAnalytics: role !== "operator",
    canManageUsers: role === "admin",
  };
}

/* =========================
   App
========================= */

export default function App(): JSX.Element {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("operator");
  const [tab, setTab] = useState<Tab>("review");
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
  const API_BASE =
    "https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function";

  return (
    <ScourProvider apiBase={API_BASE} accessToken={accessToken}>
      <main className="p-4 space-y-4">
        {/* Scour Status Bar */}
        <ScourStatusBarInline />

        {/* Tabs */}
        <div className="flex gap-2 border-b pb-2">
          {permissions.canReview && (
            <button onClick={() => setTab("review")}>Review</button>
          )}
          {permissions.canCreate && (
            <button onClick={() => setTab("create")}>Create</button>
          )}
          {permissions.canManageSources && (
            <button onClick={() => setTab("sources")}>Sources</button>
          )}
          <button onClick={() => setTab("trends")}>Trends</button>
          {permissions.canAccessAnalytics && (
            <button onClick={() => setTab("analytics")}>Analytics</button>
          )}
          {permissions.canManageUsers && (
            <button onClick={() => setTab("admin")}>Admin</button>
          )}
        </div>

        {/* Views */}
        {tab === "review" && (
          <AlertReviewQueueInline permissions={permissions} />
        )}

        {tab === "create" && (
          <AlertCreateInline
            accessToken={accessToken}
            permissions={{ canCreate: permissions.canCreate }}
          />
        )}

        {tab === "sources" && (
          <SourceManagerInline
            accessToken={accessToken}
            permissions={{
              canManageSources: permissions.canManageSources,
              canScour: permissions.canScour,
            }}
          />
        )}

        {tab === "trends" && <TrendsView />}

        {tab === "analytics" && (
          <AnalyticsDashboardInline
            apiBase={API_BASE}
            permissions={{ canAccessAnalytics: permissions.canAccessAnalytics }}
          />
        )}

        {tab === "admin" && (
          <UserManagementInline
            currentUserRole={role}
            permissions={{ canManageUsers: permissions.canManageUsers }}
          />
        )}
      </main>
    </ScourProvider>
  );
}
