// src1/App.tsx
import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";

import AlertReviewQueueInline from "./components/AlertReviewQueueInline";
import AlertCreateInline from "./components/AlertCreateInline";
import SourceManagerInline from "./components/SourceManagerInline";
import ScourStatusBarInline from "./components/ScourStatusBarInline";
import AnalyticsDashboardInline from "./components/AnalyticsDashboardInline";
import UserManagementInline from "./components/UserManagementInline";
import { ScourProvider } from "./components/ScourContext";
import TrendsView from "./components/TrendsView";

type Role = "operator" | "analyst" | "admin";
type Tab = "review" | "create" | "sources" | "trends" | "analytics" | "admin";

// -------------------------
// Env
// -------------------------
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || "";
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "";
const API_BASE =
  (import.meta.env.VITE_API_BASE as string) ||
  "https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function";

// Create Supabase client once
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// -------------------------
// Permissions
// -------------------------
function getPermissions(role: Role) {
  // App-wide permissions
  const base = {
    canReview: role !== "operator",
    canCreate: true,
    canManageSources: role === "admin",
    canScour: role !== "operator",
    canAccessAnalytics: role !== "operator",
    canManageUsers: role === "admin",
  };

  // AlertReviewQueueInline expects these additional keys:
  return {
    ...base,
    canApproveAndPost: role === "admin" || role === "analyst",
    canDismiss: role !== "operator",
    canDelete: role === "admin",
    canEditAlerts: role !== "operator",
  };
}

// -------------------------
// App
// -------------------------
export default function App(): JSX.Element {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("operator");
  const [tab, setTab] = useState<Tab>("review");
  const [loading, setLoading] = useState(true);

  const permissions = useMemo(() => getPermissions(role), [role]);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;

        if (data.session) {
          setAccessToken(data.session.access_token);
          setRole((data.session.user.user_metadata?.role as Role) ?? "operator");
        } else {
          setAccessToken(null);
          setRole("operator");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();

    // Keep UI in sync if the session changes (login/logout/refresh)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session) {
        setAccessToken(session.access_token);
        setRole((session.user.user_metadata?.role as Role) ?? "operator");
      } else {
        setAccessToken(null);
        setRole("operator");
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Loading gate
  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  // Login gate (Auth UI)
  if (!accessToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md bg-white border rounded-lg p-6 shadow-sm">
          <div className="text-lg font-semibold mb-2">MAGNUS Intelligence</div>
          <div className="text-sm text-gray-600 mb-4">Sign in to continue.</div>
          <Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa }}
            providers={[]}
          />
        </div>
      </div>
    );
  }

  return (
    <ScourProvider accessToken={accessToken}>
      <main className="p-4 space-y-4">
        {/* Scour Status Bar (must be inside ScourProvider) */}
        <ScourStatusBarInline />

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 border-b pb-2">
          {permissions.canReview && (
            <button
              className={`px-3 py-1 rounded border ${
                tab === "review" ? "bg-gray-100" : "bg-white"
              }`}
              onClick={() => setTab("review")}
            >
              Review
            </button>
          )}

          {permissions.canCreate && (
            <button
              className={`px-3 py-1 rounded border ${
                tab === "create" ? "bg-gray-100" : "bg-white"
              }`}
              onClick={() => setTab("create")}
            >
              Create
            </button>
          )}

          {permissions.canManageSources && (
            <button
              className={`px-3 py-1 rounded border ${
                tab === "sources" ? "bg-gray-100" : "bg-white"
              }`}
              onClick={() => setTab("sources")}
            >
              Sources
            </button>
          )}

          <button
            className={`px-3 py-1 rounded border ${
              tab === "trends" ? "bg-gray-100" : "bg-white"
            }`}
            onClick={() => setTab("trends")}
          >
            Trends
          </button>

          {permissions.canAccessAnalytics && (
            <button
              className={`px-3 py-1 rounded border ${
                tab === "analytics" ? "bg-gray-100" : "bg-white"
              }`}
              onClick={() => setTab("analytics")}
            >
              Analytics
            </button>
          )}

          {permissions.canManageUsers && (
            <button
              className={`px-3 py-1 rounded border ${
                tab === "admin" ? "bg-gray-100" : "bg-white"
              }`}
              onClick={() => setTab("admin")}
            >
              Admin
            </button>
          )}

          <div className="flex-1" />

          {/* Quick sign out */}
          <button
            className="px-3 py-1 rounded border bg-white"
            onClick={() => supabase.auth.signOut()}
            title="Sign out"
          >
            Sign out
          </button>
        </div>

        {/* Views */}
        {tab === "review" && <AlertReviewQueueInline permissions={permissions} />}

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
