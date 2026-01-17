import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

import AlertReviewQueueInline from "./components/AlertReviewQueueInline";
import AlertCreateInline from "./components/AlertCreateInline";
import SourceManagerInline from "./components/SourceManagerInline";
import TrendsView from "./components/TrendsView";
import AnalyticsDashboardInline from "./components/AnalyticsDashboardInline";
import UserManagementInline from "./components/UserManagementInline";
import ScourStatusBarInline from "./components/ScourStatusBarInline";
import { ScourProvider } from "./components/ScourContext";

type Role = "operator" | "analyst" | "admin";
type Tab = "review" | "create" | "sources" | "trends" | "analytics" | "admin";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function getPermissions(role: Role) {
  return {
    canReview: true,
    canCreate: role !== "operator",
    canManageSources: role === "admin",
    canScour: role !== "operator",
    canAccessAnalytics: role !== "operator",
    canManageUsers: role === "admin",
    canApproveAndPost: role !== "operator",
    canDismiss: true,
    canDelete: role === "admin",
    canEditAlerts: role !== "operator",
  };
}

export default function App(): JSX.Element {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("operator");
  const [tab, setTab] = useState<Tab>("review");
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

  const { data: listener } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      if (!mounted) return;
      if (session) {
        setAccessToken(session.access_token);
        setRole(
          (session.user.user_metadata?.role as Role) ?? "operator"
        );
      } else {
        setAccessToken(null);
        setRole("operator");
      }
    }
  );

  return () => {
    mounted = false;
    listener.subscription.unsubscribe();
  };
}, []);

  if (loading) return <div className="p-6">Loading...</div>;
  if (!accessToken) return <div className="p-6">Please log in.</div>;

  const permissions = getPermissions(role);

  const API_BASE =
    "https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function";

  return (
    <ScourProvider accessToken={accessToken}>
      <main className="p-4 space-y-4">
        <ScourStatusBarInline />

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




