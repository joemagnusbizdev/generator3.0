import React, { useEffect, useState } from "react";
import { apiFetchJson, apiPostJson } from "../lib/utils/api";
import MAGNUS_COLORS from "../styles/magnus-colors";

/* =========================
   Types
========================= */

export interface Alert {
  id: string;
  title: string;
  country: string;
  location: string;
  summary: string;
  severity: "critical" | "warning" | "caution" | "informative";
  event_type?: string;
  created_at: string;
}

export interface Trend {
  id: string;
  country: string;
  category: string;
  count: number;
  highest_severity: "critical" | "warning" | "caution" | "informative";
  last_seen_at: string;
  alert_ids?: string[];
}

export interface SituationalReport {
  id: string;
  trendId: string;
  title: string;
  country: string;
  severity: string;
  content: string;
  generatedAt: string;
  metadata: any;
  html?: string;
}

/* =========================
   Helpers
========================= */

const SEVERITY_ORDER: Record<string, number> = {
  critical: 4,
  warning: 3,
  caution: 2,
  informative: 1,
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: MAGNUS_COLORS.critical,
  warning: MAGNUS_COLORS.warning,
  caution: MAGNUS_COLORS.caution,
  informative: MAGNUS_COLORS.informative,
};

/* =========================
   Component
========================= */
export default function TrendsView({
  accessToken,
}: {
  accessToken?: string;
}) {
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTrendId, setExpandedTrendId] = useState<string | null>(null);
  const [expandedAlerts, setExpandedAlerts] = useState<Record<string, Alert[]>>({});
  const [loadingAlerts, setLoadingAlerts] = useState<Record<string, boolean>>({});
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);
  const [report, setReport] = useState<SituationalReport | null>(null);
  const [deletingTrendId, setDeletingTrendId] = useState<string | null>(null);
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [editingReport, setEditingReport] = useState(false);
  const [editedReportContent, setEditedReportContent] = useState("");

  const loadTrends = async () => {
    if (!accessToken) return;

    try {
      setLoading(true);
      setError(null);

      const res = await apiFetchJson<{ ok: boolean; trends?: Trend[] }>(
        "/trends",
        accessToken
      );

      if (!res?.ok) throw new Error("Failed to fetch trends");

      const sorted =
        (res.trends ?? [])
          .slice()
          .sort(
            (a, b) =>
              (SEVERITY_ORDER[b.highest_severity] ?? 0) -
              (SEVERITY_ORDER[a.highest_severity] ?? 0)
          );

      setTrends(sorted);
    } catch (e: any) {
      setError(e?.message || "Failed to load trends");
      setTrends([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleTrendExpansion = async (trendId: string) => {
    if (expandedTrendId === trendId) {
      // Collapse
      setExpandedTrendId(null);
    } else {
      // Expand and load alerts if not already loaded
      setExpandedTrendId(trendId);
      
      if (!expandedAlerts[trendId] && !loadingAlerts[trendId]) {
        await loadTrendAlerts(trendId);
      }
    }
  };

  const loadTrendAlerts = async (trendId: string) => {
    if (!accessToken) return;

    try {
      setLoadingAlerts(prev => ({ ...prev, [trendId]: true }));
      
      const res = await apiFetchJson<{ ok: boolean; alerts?: Alert[] }>(
        `/trends/${trendId}/alerts`,
        accessToken
      );

      if (!res?.ok) throw new Error("Failed to fetch trend alerts");

      setExpandedAlerts(prev => ({
        ...prev,
        [trendId]: res.alerts ?? []
      }));
    } catch (e: any) {
      setError(e?.message || "Failed to load trend alerts");
    } finally {
      setLoadingAlerts(prev => ({ ...prev, [trendId]: false }));
    }
  };

  const rebuildTrends = async () => {
    if (!accessToken) return;

    try {
      setLoading(true);
      setError(null);

      await apiFetchJson("/trends/rebuild", accessToken, {
        method: "POST",
      });

      await loadTrends();
    } catch (e: any) {
      setError(e?.message || "Failed to rebuild trends");
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async (trendId: string) => {
    if (!accessToken) return;

    try {
      setGeneratingReport(trendId);
      setError(null);

      const res = await apiPostJson<{ ok: boolean; report?: SituationalReport; error?: string }>(
        `/trends/${trendId}/generate-report`,
        accessToken
      );

      if (!res?.ok || !res.report) {
        throw new Error(res?.error || "Failed to generate report");
      }

      setReport(res.report);
    } catch (e: any) {
      setError(e?.message || "Failed to generate report");
    } finally {
      setGeneratingReport(null);
    }
  };

  const deleteTrend = async (trendId: string) => {
    if (!accessToken) return;

    try {
      setDeletingTrendId(trendId);
      setError(null);

      await apiFetchJson<{ ok: boolean; error?: string }>(
        `/trends/${trendId}`,
        accessToken,
        { method: "DELETE" }
      );

      // Remove from state
      setTrends(trends.filter(t => t.id !== trendId));
    } catch (e: any) {
      setError(e?.message || "Failed to delete trend");
    } finally {
      setDeletingTrendId(null);
    }
  };

  const exportReportAsText = () => {
    if (!report) return;

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
    } else {
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

  if (loading) return <div className="p-4">Loading trends…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold" style={{ color: MAGNUS_COLORS.darkGreen }}>Trends</h2>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium" style={{ color: MAGNUS_COLORS.darkGreen }}>
              Country:
            </label>
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border rounded"
              style={{ borderColor: MAGNUS_COLORS.deepGreen }}
            >
              <option value="all">All Countries ({trends.length})</option>
              {uniqueCountries.map(country => (
                <option key={country} value={country}>
                  {country} ({trends.filter(t => t.country === country).length})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={rebuildTrends}
            disabled={rebuilding}
            className="px-3 py-1.5 text-sm rounded text-white hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: MAGNUS_COLORS.deepGreen }}
          >
            {rebuilding ? "Rebuilding..." : "Rebuild Trends"}
          </button>
        </div>
      </div>

      {error && <div className="text-sm" style={{ color: MAGNUS_COLORS.critical }}>{error}</div>}

      {report && (
        <div className="p-4 rounded shadow-md" style={{ backgroundColor: MAGNUS_COLORS.offWhite, borderLeft: `4px solid ${MAGNUS_COLORS.deepGreen}` }}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="font-bold" style={{ color: MAGNUS_COLORS.darkGreen }}>{report.title}</h3>
              <p className="text-xs" style={{ color: MAGNUS_COLORS.secondaryText }}>
                Generated: {new Date(report.generatedAt).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2">
              {!editingReport && (
                <button
                  onClick={() => {
                    setEditingReport(true);
                    setEditedReportContent(report.content);
                  }}
                  className="px-2 py-1 text-sm rounded hover:opacity-80"
                  style={{ backgroundColor: MAGNUS_COLORS.deepGreen, color: 'white' }}
                  title="Edit report"
                >
                  ✏️ Edit
                </button>
              )}
              <button
                onClick={() => {
                  setReport(null);
                  setEditingReport(false);
                }}
                className="text-lg hover:opacity-80"
                style={{ color: MAGNUS_COLORS.deepGreen }}
              >
                ✕
              </button>
            </div>
          </div>
          
          {editingReport ? (
            <div className="space-y-3">
              <textarea
                value={editedReportContent}
                onChange={(e) => setEditedReportContent(e.target.value)}
                className="w-full p-3 rounded border text-sm font-mono"
                style={{ minHeight: '400px', borderColor: MAGNUS_COLORS.deepGreen }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setReport({ ...report, content: editedReportContent });
                    setEditingReport(false);
                  }}
                  className="px-4 py-2 text-sm rounded text-white hover:opacity-90"
                  style={{ backgroundColor: MAGNUS_COLORS.deepGreen }}
                >
                  💾 Save Changes
                </button>
                <button
                  onClick={() => {
                    setEditingReport(false);
                    setEditedReportContent(report.content);
                  }}
                  className="px-4 py-2 text-sm rounded border hover:bg-gray-50"
                  style={{ borderColor: MAGNUS_COLORS.border, color: MAGNUS_COLORS.secondaryText }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="p-3 rounded mb-3 text-sm max-h-96 overflow-y-auto whitespace-pre-wrap bg-white" style={{ color: MAGNUS_COLORS.secondaryText }}>
                {report.content}
              </div>
              <button
                onClick={exportReportAsText}
                className="px-3 py-1.5 text-sm rounded text-white hover:opacity-90"
                style={{ backgroundColor: MAGNUS_COLORS.deepGreen }}
              >
                📥 Export as HTML
              </button>
            </>
          )}
        </div>
      )}

      {!filteredTrends.length && (
        <div className="p-4" style={{ color: MAGNUS_COLORS.secondaryText }}>
          {trends.length === 0 
            ? "No trends detected (≥ 3 alerts in last 14 days)"
            : `No trends found for ${countryFilter}`
          }
        </div>
      )}

      {filteredTrends.map((t) => (
        <div
          key={t.id}
          className="border rounded bg-white shadow-sm"
          style={{ borderColor: MAGNUS_COLORS.border }}
        >
          <div className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="font-semibold" style={{ color: MAGNUS_COLORS.darkGreen }}>
                  {t.country} — {t.category}
                </div>
                <div className="text-sm" style={{ color: MAGNUS_COLORS.secondaryText }}>
                  {t.count} alerts · highest severity {t.highest_severity}
                </div>
                <div className="text-xs" style={{ color: MAGNUS_COLORS.tertiaryText }}>
                  Last seen: {new Date(t.last_seen_at).toLocaleString()}
                </div>
              </div>
              <div className="ml-3 flex gap-2">
                <button
                  onClick={() => toggleTrendExpansion(t.id)}
                  className="px-3 py-1.5 text-sm rounded hover:opacity-90 whitespace-nowrap"
                  style={{ 
                    backgroundColor: MAGNUS_COLORS.offWhite, 
                    color: MAGNUS_COLORS.deepGreen,
                    borderColor: MAGNUS_COLORS.deepGreen,
                    border: `1px solid ${MAGNUS_COLORS.deepGreen}`
                  }}
                >
                  {expandedTrendId === t.id ? "▼ Collapse" : "▶ Expand"}
                </button>
                <button
                  onClick={() => generateReport(t.id)}
                  disabled={generatingReport === t.id}
                  className="px-3 py-1.5 text-sm rounded hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
                  style={{ 
                    backgroundColor: MAGNUS_COLORS.offWhite, 
                    color: MAGNUS_COLORS.deepGreen,
                    borderColor: MAGNUS_COLORS.deepGreen,
                    border: `1px solid ${MAGNUS_COLORS.deepGreen}`
                  }}
                >
                  {generatingReport === t.id ? "Generating..." : "📊 Report"}
                </button>
                <button
                  onClick={() => deleteTrend(t.id)}
                  disabled={deletingTrendId === t.id}
                  className="px-3 py-1.5 text-sm rounded hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
                  style={{ 
                    backgroundColor: MAGNUS_COLORS.critical, 
                    color: "white",
                    opacity: deletingTrendId === t.id ? 0.5 : 1
                  }}
                >
                  {deletingTrendId === t.id ? "Deleting..." : "🗑️ Delete"}
                </button>
              </div>
            </div>
          </div>

          {expandedTrendId === t.id && (
            <div className="border-t p-4" style={{ borderColor: MAGNUS_COLORS.border, backgroundColor: MAGNUS_COLORS.offWhite }}>
              {loadingAlerts[t.id] ? (
                <div style={{ color: MAGNUS_COLORS.secondaryText }} className="text-sm">Loading alerts…</div>
              ) : (expandedAlerts[t.id] && expandedAlerts[t.id].length > 0) ? (
                <div className="space-y-2">
                  <div className="text-xs font-semibold" style={{ color: MAGNUS_COLORS.darkGreen }}>
                    Aggregated Alerts ({expandedAlerts[t.id].length})
                  </div>
                  {expandedAlerts[t.id].map((alert) => (
                    <div
                      key={alert.id}
                      className="p-3 rounded bg-white border"
                      style={{ borderColor: MAGNUS_COLORS.border, borderLeft: `4px solid ${SEVERITY_COLOR[alert.severity] || MAGNUS_COLORS.caution}` }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-sm" style={{ color: MAGNUS_COLORS.darkGreen }}>
                            {alert.title}
                          </div>
                          <div className="text-xs mt-1" style={{ color: MAGNUS_COLORS.secondaryText }}>
                            <strong>{alert.location}, {alert.country}</strong>
                          </div>
                          <div className="text-xs mt-1" style={{ color: MAGNUS_COLORS.tertiaryText }}>
                            {alert.summary.substring(0, 100)}{alert.summary.length > 100 ? '...' : ''}
                          </div>
                          <div className="text-xs mt-2" style={{ color: MAGNUS_COLORS.tertiaryText }}>
                            Created: {new Date(alert.created_at).toLocaleString()}
                          </div>
                        </div>
                        <div
                          className="ml-3 px-2 py-1 rounded text-xs font-semibold"
                          style={{ backgroundColor: SEVERITY_COLOR[alert.severity] || MAGNUS_COLORS.caution, color: "white" }}
                        >
                          {alert.severity.toUpperCase()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: MAGNUS_COLORS.secondaryText }} className="text-sm">No alerts found</div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

