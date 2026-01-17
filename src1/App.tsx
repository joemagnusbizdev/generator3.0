// src1/App.tsx
import React, { useEffect, useState } from "react";
import { supabase } from "./lib/supabase/client";

import AlertReviewQueueInline, {
  type PermissionSet,
} from "./components/AlertReviewQueueInline";
import AlertCreateInline from "./components/AlertCreateInline";
import SourceManagerInline from "./components/SourceManagerInline";
import TrendsView from "./TrendsView";
import AnalyticsDashboardInline from "./components/AnalyticsDashboardInline";
import UserManagementInline from "./components/UserManagementInline";
import ScourStatusBarInline from "./components/ScourStatusBarInline";

import {
  TabsInline,
  TabsListInline,
  TabsTriggerInline,
  TabsContentInline,
} from "./components/ui/tabs-inline";

/* =========================
   Roles & Permissions
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
    <main className="p-6 space-y-4">
      {/* Global scour status */}
      <ScourStatusBarInline permissions={permissions} />

      <TabsInline
        defaultValue={permissions.canReview ? "review" : "create"}
        className="space-y-6"
      >
        <TabsListInline>
          {permissions.canReview && (
            <TabsTriggerInline value="review">
              Review
            </TabsTriggerInline>
          )}
          <TabsTriggerInline value="create">
            Create
          </TabsTriggerInline>
          <TabsTriggerInline value="sources">
            Sources
          </TabsTriggerInline>
          <TabsTriggerInline value="trends">
            Trends
          </TabsTriggerInline>
          <TabsTriggerInline value="analytics">
            Analytics
          </TabsTriggerInline>
          {role === "admin" && (
            <TabsTriggerInline value="admin">
              Admin
            </TabsTriggerInline>
          )}
        </TabsListInline>

        {/* ================= REVIEW ================= */}
        {permissions.canReview && (
          <TabsContentInline value="review">
            <AlertReviewQueueInline permissions={permissions} />
          </TabsContentInline>
        )}

        {/* ================= CREATE ================= */}
        <TabsContentInline value="create">
          <AlertCreateInline />
        </TabsContentInline>

        {/* ================= SOURCES ================= */}
        <TabsContentInline value="sources">
          <SourceManagerInline
            permissions={{
              canManageSources: role !== "operator",
              canScour: permissions.canScour,
            }}
          />
        </TabsContentInline>

        {/* ================= TRENDS ================= */}
        <TabsContentInline value="trends">
          <TrendsView />
        </TabsContentInline>

        {/* ================= ANALYTICS ================= */}
        <TabsContentInline value="analytics">
          <AnalyticsDashboardInline
            apiBase="https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function"
            permissions={permissions}
          />
        </TabsContentInline>

        {/* ================= ADMIN ================= */}
        {role === "admin" && (
          <TabsContentInline value="admin">
            <UserManagementInline
              currentUserRole={role}
              permissions={permissions}
            />
          </TabsContentInline>
        )}
      </TabsInline>
    </main>
  );
}
