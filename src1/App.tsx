import React, { useState } from "react";

import AlertReviewQueueInline, {
  PermissionSet,
} from "./components/AlertReviewQueueInline";
import AlertCreateInline from "./components/AlertCreateInline";
import SourceManagerInline from "./components/SourceManagerInline";
import ScourStatusBarInline from "./components/ScourStatusBarInline";

/* =========================
   Permissions (internal app)
========================= */

const permissions: PermissionSet = {
  canReview: true,
  canScour: true,
  canApproveAndPost: true,
  canDismiss: true,
  canDelete: true,
  canEditAlerts: true,
};

/* =========================
   App
========================= */

type TabKey = "review" | "create" | "sources";

export default function App() {
  const [tab, setTab] = useState<TabKey>("review");

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* =========================
          Header
      ========================= */}
      <header className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <h1 className="text-lg font-semibold">
            🛡️ MAGNUS Intelligence
          </h1>
        </div>
      </header>

      {/* =========================
          Scour Status (GLOBAL)
          🔑 Always mounted
      ========================= */}
      <div className="max-w-7xl mx-auto px-4 py-2">
        <ScourStatusBarInline />
      </div>

      {/* =========================
          Tabs
      ========================= */}
      <div className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 flex gap-6">
          <TabButton
            active={tab === "review"}
            onClick={() => setTab("review")}
          >
            Review
          </TabButton>

          <TabButton
            active={tab === "create"}
            onClick={() => setTab("create")}
          >
            Create
          </TabButton>

          <TabButton
            active={tab === "sources"}
            onClick={() => setTab("sources")}
          >
            Sources
          </TabButton>
        </div>
      </div>

      {/* =========================
          Tab Content
      ========================= */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {tab === "review" && (
          <AlertReviewQueueInline permissions={permissions} />
        )}

        {tab === "create" && (
          <AlertCreateInline permissions={permissions} />
        )}

        {tab === "sources" && (
          <SourceManagerInline permissions={permissions} />
        )}
      </main>
    </div>
  );
}

/* =========================
   Tab Button
========================= */

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`py-3 text-sm font-medium border-b-2 transition ${
        active
          ? "border-indigo-600 text-indigo-600"
          : "border-transparent text-gray-600 hover:text-gray-900"
      }`}
    >
      {children}
    </button>
  );
}
