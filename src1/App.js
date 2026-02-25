import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// src1/App.tsx
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import AlertReviewQueueInline from "./components/AlertReviewQueueInline";
import AlertCreateInline from "./components/AlertCreateInline";
import SourceManagerInline from "./components/SourceManagerInline";
import { ScourStatusIndicator } from "./components/ScourStatusIndicator";
import AnalyticsDashboardInline from "./components/AnalyticsDashboardInline";
import UserManagementInline from "./components/UserManagementInline";
import { ScourProvider } from "./components/ScourContext";
import TrendsView from "./components/TrendsView";
import HealthReportModal from "./components/HealthReportModal";
// -------------------------
// Env
// -------------------------
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
// Create Supabase client once
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// -------------------------
// Permissions
// -------------------------
function getPermissions(role) {
    // OPERATOR: review, create, scour, approve, post, delete, dismiss, trends
    // ANALYST: all operator + sources + analytics
    // ADMIN: all analyst + user management
    const base = {
        canReview: true, // All roles can review
        canCreate: true, // All roles can create
        canManageSources: role === "analyst" || role === "admin", // Analyst+
        canScour: true, // All roles can scour
        canAccessAnalytics: role === "analyst" || role === "admin", // Analyst+
        canManageUsers: role === "admin", // Admin only
    };
    // AlertReviewQueueInline expects these additional keys:
    return {
        ...base,
        canApproveAndPost: true, // All roles can approve/post
        canDismiss: true, // All roles can dismiss
        canDelete: true, // All roles can delete
        canEditAlerts: true, // All roles can edit
    };
}
// -------------------------
// App
// -------------------------
export default function App() {
    const [accessToken, setAccessToken] = useState(null);
    const [role, setRole] = useState("operator");
    const [tab, setTab] = useState("review");
    const [loading, setLoading] = useState(true);
    const [showHealthReport, setShowHealthReport] = useState(false);
    const permissions = useMemo(() => getPermissions(role), [role]);
    useEffect(() => {
        let mounted = true;
        async function init() {
            try {
                const { data } = await supabase.auth.getSession();
                if (!mounted)
                    return;
                if (data.session) {
                    setAccessToken(data.session.access_token);
                    setRole(data.session.user.user_metadata?.role ?? "operator");
                }
                else {
                    setAccessToken(null);
                    setRole("operator");
                }
            }
            finally {
                if (mounted)
                    setLoading(false);
            }
        }
        init();
        // Keep UI in sync if the session changes (login/logout/refresh)
        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!mounted)
                return;
            if (session) {
                setAccessToken(session.access_token);
                setRole(session.user.user_metadata?.role ?? "operator");
            }
            else {
                setAccessToken(null);
                setRole("operator");
            }
        });
        return () => {
            mounted = false;
            sub.subscription.unsubscribe();
        };
    }, []);
    // Health Report - Show every 6 hours
    useEffect(() => {
        const lastHealthReportTime = localStorage.getItem('lastHealthReportTime');
        const SIX_HOURS = 6 * 60 * 60 * 1000;
        const now = Date.now();
        if (!lastHealthReportTime || now - parseInt(lastHealthReportTime, 10) >= SIX_HOURS) {
            setShowHealthReport(true);
            localStorage.setItem('lastHealthReportTime', now.toString());
        }
        // Also check periodically (every 30 seconds)
        const interval = setInterval(() => {
            const lastTime = localStorage.getItem('lastHealthReportTime');
            if (!lastTime || Date.now() - parseInt(lastTime, 10) >= SIX_HOURS) {
                setShowHealthReport(true);
                localStorage.setItem('lastHealthReportTime', Date.now().toString());
            }
        }, 30000); // Check every 30 seconds
        return () => clearInterval(interval);
    }, []);
    // Loading gate
    if (loading) {
        return _jsx("div", { className: "p-6", children: "Loading..." });
    }
    // Login gate (Auth UI)
    if (!accessToken) {
        return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-gray-50 p-6", children: _jsxs("div", { className: "w-full max-w-md bg-white border rounded-lg p-6 shadow-sm", children: [_jsx("div", { className: "text-lg font-semibold mb-2", children: "MAGNUS Intelligence" }), _jsx("div", { className: "text-sm text-gray-600", children: "MAGNUS ATLAS" }), _jsx("div", { className: "text-xs text-gray-500 mb-4", children: "Analysis and Threat Location based Alert System" }), _jsx("div", { className: "text-sm text-gray-600 mb-4", children: "Sign in to continue." }), _jsx(Auth, { supabaseClient: supabase, appearance: { theme: ThemeSupa }, providers: [] })] }) }));
    }
    return (_jsxs(ScourProvider, { accessToken: accessToken, children: [_jsx(HealthReportModal, { isOpen: showHealthReport, onClose: () => setShowHealthReport(false) }), _jsx(ScourStatusIndicator, {}), _jsxs("main", { className: "p-4 space-y-4", children: [_jsxs("div", { className: "flex flex-wrap gap-2 border-b pb-2", children: [permissions.canReview && (_jsx("button", { className: `px-3 py-1 rounded border ${tab === "review" ? "bg-gray-100" : "bg-white"}`, onClick: () => setTab("review"), children: "Review" })), permissions.canCreate && (_jsx("button", { className: `px-3 py-1 rounded border ${tab === "create" ? "bg-gray-100" : "bg-white"}`, onClick: () => setTab("create"), children: "Create" })), permissions.canManageSources && (_jsx("button", { className: `px-3 py-1 rounded border ${tab === "sources" ? "bg-gray-100" : "bg-white"}`, onClick: () => setTab("sources"), children: "Sources" })), _jsx("button", { className: `px-3 py-1 rounded border ${tab === "trends" ? "bg-gray-100" : "bg-white"}`, onClick: () => setTab("trends"), children: "Trends" }), permissions.canAccessAnalytics && (_jsx("button", { className: `px-3 py-1 rounded border ${tab === "analytics" ? "bg-gray-100" : "bg-white"}`, onClick: () => setTab("analytics"), children: "Analytics" })), permissions.canManageUsers && (_jsx("button", { className: `px-3 py-1 rounded border ${tab === "admin" ? "bg-gray-100" : "bg-white"}`, onClick: () => setTab("admin"), children: "Admin" })), _jsx("div", { className: "flex-1" }), _jsx("button", { className: "px-3 py-1 rounded border bg-white", onClick: () => supabase.auth.signOut(), title: "Sign out", children: "Sign out" })] }), tab === "review" && _jsx(AlertReviewQueueInline, { permissions: permissions, accessToken: accessToken || '' }), tab === "create" && (_jsx(AlertCreateInline, { accessToken: accessToken, permissions: { canCreate: permissions.canCreate } })), tab === "sources" && (_jsx(SourceManagerInline, { accessToken: accessToken, permissions: {
                            canManageSources: permissions.canManageSources,
                            canScour: permissions.canScour,
                        } })), tab === "trends" && _jsx(TrendsView, { accessToken: accessToken }), tab === "analytics" && (_jsx(AnalyticsDashboardInline, { apiBase: "", accessToken: accessToken, permissions: { canAccessAnalytics: permissions.canAccessAnalytics } })), tab === "admin" && (_jsx(UserManagementInline, { accessToken: accessToken || undefined, currentUserRole: role, permissions: { canManageUsers: permissions.canManageUsers } }))] })] }));
}
