import React, { useEffect, useState } from "react";
import { supabase } from "./lib/supabase/client";

import AlertReviewQueueInline, {
  type PermissionSet,
} from "./components/AlertReviewQueueInline";
import SourceManagerInline from "./components/SourceManagerInline";
import AlertCreateInline from "./components/AlertCreateInline";
import TrendsView from "./TrendsView";
import AnalyticsDashboardInline from "./components/AnalyticsDashboardInline";
import UserManagementInline from "./components/UserManagementInline";
import ScourStatusBarInline from "./components/ScourStatusBarInline";

import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "./components/ui/tabs";

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
    <main className="p-6 space-y-4">
      {/* Status bar always visible */}
      <ScourStatusBarInline permissions={permissions} />

      <Tabs defaultValue={permissions.canReview ? "review" : "create"}>
        <TabsList>
          {permissions.canReview && (
            <TabsTrigger value="review">Review</TabsTrigger>
          )}
          <TabsTrigger value="create">Create</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          {role === "admin" && (
            <TabsTrigger value="admin">Admin</TabsTrigger>
          )}
        </TabsList>

        {permissions.canReview && (
          <TabsContent value="review">
            <AlertReviewQueueInline permissions={permissions} />
          </TabsContent>
        )}

        <TabsContent value="create">
          <AlertCreateInline permissions={permissions} />
        </TabsContent>

        <TabsContent value="sources">
          <SourceManagerInline permissions={permissions} />
        </TabsContent>

        <TabsContent value="trends">
          <TrendsView />
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsDashboardInline />
        </TabsContent>

        {role === "admin" && (
          <TabsContent value="admin">
            <UserManagementInline />
          </TabsContent>
        )}
      </Tabs>
    </main>
  );
}
