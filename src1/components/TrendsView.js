import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { apiFetchJson, apiPostJson } from "../lib/utils/api";
import MAGNUS_COLORS from "../styles/magnus-colors";
/* =========================
   Helpers
========================= */
const SEVERITY_ORDER = {
    critical: 4,
    warning: 3,
    caution: 2,
    informative: 1,
};
const SEVERITY_COLOR = {
    critical: MAGNUS_COLORS.critical,
    warning: MAGNUS_COLORS.warning,
    caution: MAGNUS_COLORS.caution,
    informative: MAGNUS_COLORS.informative,
};
/* =========================
   Component
========================= */
export default function TrendsView({ accessToken, }) {
    const [trends, setTrends] = useState([]);
    const [loading, setLoading] = useState(true);
    const [rebuilding, setRebuilding] = useState(false);
    const [error, setError] = useState(null);
    const [expandedTrendId, setExpandedTrendId] = useState(null);
    const [expandedAlerts, setExpandedAlerts] = useState({});
    const [loadingAlerts, setLoadingAlerts] = useState({});
    const [generatingReport, setGeneratingReport] = useState(null);
    const [report, setReport] = useState(null);
    const [deletingTrendId, setDeletingTrendId] = useState(null);
    const [deletingAlertId, setDeletingAlertId] = useState(null);
    const [countryFilter, setCountryFilter] = useState("all");
    const [editingReport, setEditingReport] = useState(false);
    const [editedReportContent, setEditedReportContent] = useState("");
    const loadTrends = async () => {
        if (!accessToken)
            return;
        try {
            setLoading(true);
            setError(null);
            const res = await apiFetchJson("/trends", accessToken);
            if (!res?.ok)
                throw new Error("Failed to fetch trends");
            const sorted = (res.trends ?? [])
                .slice()
                .sort((a, b) => (SEVERITY_ORDER[b.highest_severity] ?? 0) -
                (SEVERITY_ORDER[a.highest_severity] ?? 0));
            setTrends(sorted);
        }
        catch (e) {
            setError(e?.message || "Failed to load trends");
            setTrends([]);
        }
        finally {
            setLoading(false);
        }
    };
    const toggleTrendExpansion = async (trendId) => {
        if (expandedTrendId === trendId) {
            // Collapse
            setExpandedTrendId(null);
        }
        else {
            // Expand and load alerts if not already loaded
            setExpandedTrendId(trendId);
            if (!expandedAlerts[trendId] && !loadingAlerts[trendId]) {
                await loadTrendAlerts(trendId);
            }
        }
    };
    const loadTrendAlerts = async (trendId) => {
        if (!accessToken)
            return;
        try {
            setLoadingAlerts(prev => ({ ...prev, [trendId]: true }));
            const res = await apiFetchJson(`/trends/${trendId}/alerts`, accessToken);
            if (!res?.ok)
                throw new Error("Failed to fetch trend alerts");
            setExpandedAlerts(prev => ({
                ...prev,
                [trendId]: res.alerts ?? []
            }));
        }
        catch (e) {
            setError(e?.message || "Failed to load trend alerts");
        }
        finally {
            setLoadingAlerts(prev => ({ ...prev, [trendId]: false }));
        }
    };
    const rebuildTrends = async () => {
        if (!accessToken)
            return;
        try {
            setLoading(true);
            setError(null);
            await apiFetchJson("/trends/rebuild", accessToken, {
                method: "POST",
            });
            await loadTrends();
        }
        catch (e) {
            setError(e?.message || "Failed to rebuild trends");
        }
        finally {
            setLoading(false);
        }
    };
    const generateReport = async (trendId) => {
        if (!accessToken)
            return;
        try {
            setGeneratingReport(trendId);
            setError(null);
            const res = await apiPostJson(`/trends/${trendId}/generate-report`, accessToken);
            if (!res?.ok || !res.report) {
                throw new Error(res?.error || "Failed to generate report");
            }
            setReport(res.report);
        }
        catch (e) {
            setError(e?.message || "Failed to generate report");
        }
        finally {
            setGeneratingReport(null);
        }
    };
    const deleteTrend = async (trendId) => {
        if (!accessToken)
            return;
        try {
            setDeletingTrendId(trendId);
            setError(null);
            await apiFetchJson(`/trends/${trendId}`, accessToken, { method: "DELETE" });
            // Remove from state
            setTrends(trends.filter(t => t.id !== trendId));
        }
        catch (e) {
            setError(e?.message || "Failed to delete trend");
        }
        finally {
            setDeletingTrendId(null);
        }
    };
    const deleteAlertFromTrend = async (alertId, trendId) => {
        if (!accessToken)
            return;
        try {
            setDeletingAlertId(alertId);
            setError(null);
            // Call delete endpoint for the alert
            await apiFetchJson(`/alerts/${alertId}`, accessToken, { method: "DELETE" });
            // Update the local expanded alerts list
            setExpandedAlerts(prev => ({
                ...prev,
                [trendId]: prev[trendId]?.filter(a => a.id !== alertId) || []
            }));
            // Reload trends to get updated counts
            loadTrends();
        }
        catch (e) {
            setError(e?.message || "Failed to delete alert");
        }
        finally {
            setDeletingAlertId(null);
        }
    };
    const exportReportAsText = () => {
        if (!report)
            return;
        // Use HTML if available, otherwise fallback to text
        const isHTML = report.html && report.html.includes('<!DOCTYPE');
        if (isHTML) {
            // Export as styled HTML file
            const blob = new Blob([report.html], { type: "text/html;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `MAGNUS-Report-${report.country}-${new Date().toISOString().split("T")[0]}.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
        else {
            // Fallback to text export
            const text = `
================================================================================
                    MAGNUS TRAVEL SAFETY INTELLIGENCE
                          SITUATIONAL REPORT
================================================================================

TITLE: ${report.title}
COUNTRY: ${report.country}
SEVERITY: ${report.severity.toUpperCase()}
GENERATED: ${new Date(report.generatedAt).toLocaleString()}

================================================================================

${report.content}

================================================================================
Report ID: ${report.id}
Trend ID: ${report.trendId}
Generated by MAGNUS Intelligence System
================================================================================
    `.trim();
            const blob = new Blob([text], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `MAGNUS-Report-${report.country}-${new Date().toISOString().split("T")[0]}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };
    useEffect(() => {
        loadTrends();
    }, [accessToken]);
    // Filter trends by country
    const filteredTrends = countryFilter === "all"
        ? trends
        : trends.filter(t => t.country === countryFilter);
    // Get unique countries for filter dropdown
    const uniqueCountries = Array.from(new Set(trends.map(t => t.country))).sort();
    if (loading)
        return _jsx("div", { className: "p-4", children: "Loading trends\u2026" });
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between flex-wrap gap-3", children: [_jsx("h2", { className: "text-lg font-semibold", style: { color: MAGNUS_COLORS.darkGreen }, children: "Trends" }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-sm font-medium", style: { color: MAGNUS_COLORS.darkGreen }, children: "Country:" }), _jsxs("select", { value: countryFilter, onChange: (e) => setCountryFilter(e.target.value), className: "px-3 py-1.5 text-sm border rounded", style: { borderColor: MAGNUS_COLORS.deepGreen }, children: [_jsxs("option", { value: "all", children: ["All Countries (", trends.length, ")"] }), uniqueCountries.map(country => (_jsxs("option", { value: country, children: [country, " (", trends.filter(t => t.country === country).length, ")"] }, country)))] })] }), _jsx("button", { onClick: rebuildTrends, disabled: rebuilding, className: "px-3 py-1.5 text-sm rounded text-white hover:opacity-90 disabled:opacity-50", style: { backgroundColor: MAGNUS_COLORS.deepGreen }, children: rebuilding ? "Rebuilding..." : "Rebuild Trends" })] })] }), error && _jsx("div", { className: "text-sm", style: { color: MAGNUS_COLORS.critical }, children: error }), report && (_jsxs("div", { className: "p-4 rounded shadow-md", style: { backgroundColor: MAGNUS_COLORS.offWhite, borderLeft: `4px solid ${MAGNUS_COLORS.deepGreen}` }, children: [_jsxs("div", { className: "flex items-start justify-between mb-3", children: [_jsxs("div", { className: "flex-1", children: [_jsx("h3", { className: "font-bold", style: { color: MAGNUS_COLORS.darkGreen }, children: report.title }), _jsxs("p", { className: "text-xs", style: { color: MAGNUS_COLORS.secondaryText }, children: ["Generated: ", new Date(report.generatedAt).toLocaleString()] })] }), _jsxs("div", { className: "flex gap-2", children: [!editingReport && (_jsx("button", { onClick: () => {
                                            setEditingReport(true);
                                            setEditedReportContent(report.content);
                                        }, className: "px-2 py-1 text-sm rounded hover:opacity-80", style: { backgroundColor: MAGNUS_COLORS.deepGreen, color: 'white' }, title: "Edit report", children: "\u270F\uFE0F Edit" })), _jsx("button", { onClick: () => {
                                            setReport(null);
                                            setEditingReport(false);
                                        }, className: "text-lg hover:opacity-80", style: { color: MAGNUS_COLORS.deepGreen }, children: "\u2715" })] })] }), editingReport ? (_jsxs("div", { className: "space-y-3", children: [_jsx("textarea", { value: editedReportContent, onChange: (e) => setEditedReportContent(e.target.value), className: "w-full p-3 rounded border text-sm font-mono", style: { minHeight: '400px', borderColor: MAGNUS_COLORS.deepGreen } }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => {
                                            setReport({ ...report, content: editedReportContent });
                                            setEditingReport(false);
                                        }, className: "px-4 py-2 text-sm rounded text-white hover:opacity-90", style: { backgroundColor: MAGNUS_COLORS.deepGreen }, children: "\uD83D\uDCBE Save Changes" }), _jsx("button", { onClick: () => {
                                            setEditingReport(false);
                                            setEditedReportContent(report.content);
                                        }, className: "px-4 py-2 text-sm rounded border hover:bg-gray-50", style: { borderColor: MAGNUS_COLORS.border, color: MAGNUS_COLORS.secondaryText }, children: "Cancel" })] })] })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "p-3 rounded mb-3 text-sm max-h-96 overflow-y-auto whitespace-pre-wrap bg-white", style: { color: MAGNUS_COLORS.secondaryText }, children: report.content }), _jsx("button", { onClick: exportReportAsText, className: "px-3 py-1.5 text-sm rounded text-white hover:opacity-90", style: { backgroundColor: MAGNUS_COLORS.deepGreen }, children: "\uD83D\uDCE5 Export as HTML" })] }))] })), !filteredTrends.length && (_jsx("div", { className: "p-4", style: { color: MAGNUS_COLORS.secondaryText }, children: trends.length === 0
                    ? "No trends detected (≥ 3 alerts in last 14 days)"
                    : `No trends found for ${countryFilter}` })), filteredTrends.map((t) => (_jsxs("div", { className: "border rounded bg-white shadow-sm", style: { borderColor: MAGNUS_COLORS.border }, children: [_jsx("div", { className: "p-4", children: _jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "font-semibold", style: { color: MAGNUS_COLORS.darkGreen }, children: [t.country, " \u2014 ", t.category] }), _jsxs("div", { className: "text-sm", style: { color: MAGNUS_COLORS.secondaryText }, children: [t.count, " alerts \u00B7 highest severity ", t.highest_severity] }), _jsxs("div", { className: "text-xs", style: { color: MAGNUS_COLORS.tertiaryText }, children: ["Last seen: ", new Date(t.last_seen_at).toLocaleString()] })] }), _jsxs("div", { className: "ml-3 flex gap-2", children: [_jsx("button", { onClick: () => toggleTrendExpansion(t.id), className: "px-3 py-1.5 text-sm rounded hover:opacity-90 whitespace-nowrap", style: {
                                                backgroundColor: MAGNUS_COLORS.offWhite,
                                                color: MAGNUS_COLORS.deepGreen,
                                                borderColor: MAGNUS_COLORS.deepGreen,
                                                border: `1px solid ${MAGNUS_COLORS.deepGreen}`
                                            }, children: expandedTrendId === t.id ? "▼ Collapse" : "▶ Expand" }), _jsx("button", { onClick: () => generateReport(t.id), disabled: generatingReport === t.id, className: "px-3 py-1.5 text-sm rounded hover:opacity-90 disabled:opacity-50 whitespace-nowrap", style: {
                                                backgroundColor: MAGNUS_COLORS.offWhite,
                                                color: MAGNUS_COLORS.deepGreen,
                                                borderColor: MAGNUS_COLORS.deepGreen,
                                                border: `1px solid ${MAGNUS_COLORS.deepGreen}`
                                            }, children: generatingReport === t.id ? "Generating..." : "📊 Report" }), _jsx("button", { onClick: () => deleteTrend(t.id), disabled: deletingTrendId === t.id, className: "px-3 py-1.5 text-sm rounded hover:opacity-90 disabled:opacity-50 whitespace-nowrap", style: {
                                                backgroundColor: MAGNUS_COLORS.critical,
                                                color: "white",
                                                opacity: deletingTrendId === t.id ? 0.5 : 1
                                            }, children: deletingTrendId === t.id ? "Deleting..." : "🗑️ Delete" })] })] }) }), expandedTrendId === t.id && (_jsx("div", { className: "border-t p-4", style: { borderColor: MAGNUS_COLORS.border, backgroundColor: MAGNUS_COLORS.offWhite }, children: loadingAlerts[t.id] ? (_jsx("div", { style: { color: MAGNUS_COLORS.secondaryText }, className: "text-sm", children: "Loading alerts\u2026" })) : (expandedAlerts[t.id] && expandedAlerts[t.id].length > 0) ? (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "text-xs font-semibold", style: { color: MAGNUS_COLORS.darkGreen }, children: ["Aggregated Alerts (", expandedAlerts[t.id].length, ")"] }), expandedAlerts[t.id].map((alert) => (_jsx("div", { className: "p-3 rounded bg-white border", style: { borderColor: MAGNUS_COLORS.border, borderLeft: `4px solid ${SEVERITY_COLOR[alert.severity] || MAGNUS_COLORS.caution}` }, children: _jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "font-semibold text-sm", style: { color: MAGNUS_COLORS.darkGreen }, children: alert.title }), _jsx("div", { className: "text-xs mt-1", style: { color: MAGNUS_COLORS.secondaryText }, children: _jsxs("strong", { children: [alert.location, ", ", alert.country] }) }), _jsxs("div", { className: "text-xs mt-1", style: { color: MAGNUS_COLORS.tertiaryText }, children: [alert.summary.substring(0, 100), alert.summary.length > 100 ? '...' : ''] }), _jsxs("div", { className: "text-xs mt-2", style: { color: MAGNUS_COLORS.tertiaryText }, children: ["Created: ", new Date(alert.created_at).toLocaleString()] })] }), _jsxs("div", { className: "ml-3 flex items-center gap-2", children: [_jsx("div", { className: "px-2 py-1 rounded text-xs font-semibold", style: { backgroundColor: SEVERITY_COLOR[alert.severity] || MAGNUS_COLORS.caution, color: "white" }, children: alert.severity.toUpperCase() }), _jsx("button", { onClick: () => deleteAlertFromTrend(alert.id, t.id), disabled: deletingAlertId === alert.id, className: "px-2 py-1 text-xs rounded hover:opacity-90 disabled:opacity-50 whitespace-nowrap", style: {
                                                            backgroundColor: MAGNUS_COLORS.critical,
                                                            color: "white",
                                                            opacity: deletingAlertId === alert.id ? 0.5 : 1
                                                        }, title: "Delete this alert", children: deletingAlertId === alert.id ? "Deleting..." : "🗑" })] })] }) }, alert.id)))] })) : (_jsx("div", { style: { color: MAGNUS_COLORS.secondaryText }, className: "text-sm", children: "No alerts found" })) }))] }, t.id)))] }));
}
