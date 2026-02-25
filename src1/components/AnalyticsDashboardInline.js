import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * AnalyticsDashboardInline - Analytics Dashboard
 *
 * Displays alert metrics with breakdowns by:
 * - Time Period: This Week, This Month, Year-to-Date
 * - Dimensions: Severity, Event Type, Country
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetchJson } from '../lib/utils/api';
import { colors } from '../styles/inline';
import { buttons } from '../styles/designSystem';
import MAGNUS_COLORS from '../styles/magnus-colors';
import HealthCheckModal from './HealthCheckModal';
// ============================================================================
// Helpers
// ============================================================================
function safeArr(val) {
    return Array.isArray(val) ? val : [];
}
function getStartOfWeek(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Monday
    date.setDate(diff);
    date.setHours(0, 0, 0, 0);
    return date;
}
function getStartOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function getStartOfYear(d) {
    return new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
}
function groupAndCount(arr, keyFn) {
    const map = new Map();
    for (const item of arr) {
        const key = keyFn(item) || 'Unknown';
        map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
}
function mapToSortedArray(map) {
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
}
function formatNumber(n) {
    return n.toLocaleString();
}
function percentChange(current, previous) {
    if (previous === 0)
        return { value: current > 0 ? 100 : 0, direction: current > 0 ? 'up' : 'same' };
    const change = ((current - previous) / previous) * 100;
    return {
        value: Math.abs(Math.round(change)),
        direction: change > 0 ? 'up' : change < 0 ? 'down' : 'same',
    };
}
// ============================================================================
// Styles
// ============================================================================
const COLORS = {
    bg: MAGNUS_COLORS.offWhite,
    card: '#FFFFFF',
    border: MAGNUS_COLORS.border,
    text: MAGNUS_COLORS.primaryText,
    muted: MAGNUS_COLORS.secondaryText,
    primary: MAGNUS_COLORS.darkGreen,
    accent: MAGNUS_COLORS.orange,
    success: MAGNUS_COLORS.caution,
    warning: MAGNUS_COLORS.warning,
    danger: MAGNUS_COLORS.critical,
    info: MAGNUS_COLORS.informative,
};
const SEVERITY_COLORS = {
    critical: MAGNUS_COLORS.critical,
    warning: MAGNUS_COLORS.warning,
    caution: MAGNUS_COLORS.informative,
    informative: MAGNUS_COLORS.secondaryText,
    unknown: MAGNUS_COLORS.tertiaryText,
};
function PeriodCard({ title, subtitle, total, posted, comparison, isActive, onClick }) {
    return (_jsxs("div", { onClick: onClick, style: {
            backgroundColor: isActive ? COLORS.primary : COLORS.card,
            borderRadius: '12px',
            padding: '1.25rem',
            border: `2px solid ${isActive ? COLORS.primary : COLORS.border}`,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            minWidth: '180px',
        }, children: [_jsx("div", { style: {
                    fontSize: '0.75rem',
                    color: isActive ? 'rgba(255,255,255,0.7)' : COLORS.muted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '0.25rem',
                }, children: title }), _jsx("div", { style: {
                    fontSize: '0.7rem',
                    color: isActive ? 'rgba(255,255,255,0.5)' : COLORS.muted,
                    marginBottom: '0.75rem',
                }, children: subtitle }), _jsx("div", { style: {
                    fontSize: '2.5rem',
                    fontWeight: 700,
                    color: isActive ? 'white' : COLORS.primary,
                    lineHeight: 1,
                }, children: formatNumber(total) }), _jsxs("div", { style: {
                    fontSize: '0.75rem',
                    color: isActive ? 'rgba(255,255,255,0.7)' : COLORS.muted,
                    marginTop: '0.5rem',
                }, children: [formatNumber(posted), " posted to WP"] }), comparison && comparison.value > 0 && (_jsxs("div", { style: {
                    marginTop: '0.5rem',
                    fontSize: '0.7rem',
                    color: isActive
                        ? 'rgba(255,255,255,0.8)'
                        : comparison.direction === 'up' ? COLORS.success : comparison.direction === 'down' ? COLORS.danger : COLORS.muted,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                }, children: [comparison.direction === 'up' ? '' : comparison.direction === 'down' ? '' : '', comparison.value, "% ", comparison.label] }))] }));
}
function BreakdownTable({ title, icon, data, total, colorFn, maxRows = 10 }) {
    const displayData = data.slice(0, maxRows);
    const hasMore = data.length > maxRows;
    return (_jsxs("div", { style: {
            backgroundColor: COLORS.card,
            borderRadius: '12px',
            border: `1px solid ${COLORS.border}`,
            overflow: 'hidden',
        }, children: [_jsx("div", { style: {
                    padding: '1rem 1.25rem',
                    borderBottom: `1px solid ${COLORS.border}`,
                    backgroundColor: '#FAFAFA',
                }, children: _jsxs("h3", { style: {
                        margin: 0,
                        fontSize: '1rem',
                        fontWeight: 600,
                        color: COLORS.text,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                    }, children: [_jsx("span", { children: icon }), " ", title] }) }), _jsx("div", { style: { padding: '0.5rem 0' }, children: displayData.length === 0 ? (_jsx("div", { style: { padding: '1.5rem', textAlign: 'center', color: COLORS.muted, fontSize: '0.875rem' }, children: "No data for this period" })) : (_jsxs(_Fragment, { children: [_jsxs("div", { style: {
                                display: 'grid',
                                gridTemplateColumns: '1fr 80px 100px',
                                padding: '0.5rem 1.25rem',
                                fontSize: '0.7rem',
                                color: COLORS.muted,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                borderBottom: `1px solid ${COLORS.border}`,
                            }, children: [_jsx("div", { children: "Name" }), _jsx("div", { style: { textAlign: 'right' }, children: "Count" }), _jsx("div", { style: { textAlign: 'right' }, children: "% of Total" })] }), displayData.map(([key, count], index) => {
                            const percent = total > 0 ? Math.round((count / total) * 100) : 0;
                            const barColor = colorFn ? colorFn(key.toLowerCase()) : COLORS.primary;
                            return (_jsxs("div", { style: {
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 80px 100px',
                                    padding: '0.75rem 1.25rem',
                                    alignItems: 'center',
                                    borderBottom: index < displayData.length - 1 ? `1px solid ${COLORS.border}` : 'none',
                                    backgroundColor: index % 2 === 0 ? 'white' : '#FAFAFA',
                                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '0.75rem' }, children: [_jsx("div", { style: {
                                                    width: '12px',
                                                    height: '12px',
                                                    borderRadius: '3px',
                                                    backgroundColor: barColor,
                                                    flexShrink: 0,
                                                } }), _jsx("span", { style: {
                                                    fontSize: '0.875rem',
                                                    color: COLORS.text,
                                                    fontWeight: 500,
                                                }, children: key })] }), _jsx("div", { style: {
                                            textAlign: 'right',
                                            fontSize: '0.875rem',
                                            fontWeight: 600,
                                            color: COLORS.text,
                                        }, children: formatNumber(count) }), _jsxs("div", { style: {
                                            textAlign: 'right',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'flex-end',
                                            gap: '0.5rem',
                                        }, children: [_jsx("div", { style: {
                                                    width: '60px',
                                                    height: '8px',
                                                    backgroundColor: COLORS.border,
                                                    borderRadius: '4px',
                                                    overflow: 'hidden',
                                                }, children: _jsx("div", { style: {
                                                        width: `${percent}%`,
                                                        height: '100%',
                                                        backgroundColor: barColor,
                                                        borderRadius: '4px',
                                                    } }) }), _jsxs("span", { style: {
                                                    fontSize: '0.75rem',
                                                    color: COLORS.muted,
                                                    minWidth: '35px',
                                                }, children: [percent, "%"] })] })] }, key));
                        }), hasMore && (_jsxs("div", { style: {
                                padding: '0.75rem 1.25rem',
                                fontSize: '0.75rem',
                                color: COLORS.muted,
                                textAlign: 'center',
                                backgroundColor: '#FAFAFA',
                            }, children: ["+", data.length - maxRows, " more items"] }))] })) })] }));
}
function SummaryStat({ label, value, icon, color = COLORS.primary }) {
    return (_jsxs("div", { style: {
            backgroundColor: COLORS.card,
            borderRadius: '10px',
            padding: '1rem',
            border: `1px solid ${COLORS.border}`,
            textAlign: 'center',
        }, children: [_jsx("div", { style: { fontSize: '1.25rem', marginBottom: '0.25rem' }, children: icon }), _jsx("div", { style: { fontSize: '1.5rem', fontWeight: 700, color }, children: value }), _jsx("div", { style: { fontSize: '0.7rem', color: COLORS.muted, textTransform: 'uppercase' }, children: label })] }));
}
// ============================================================================
// Main Component
// ============================================================================
export function AnalyticsDashboardInline({ apiBase, accessToken, permissions, }) {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);
    const [selectedPeriod, setSelectedPeriod] = useState('month');
    const [healthCheckOpen, setHealthCheckOpen] = useState(false);
    // Permission check
    if (!permissions.canAccessAnalytics) {
        return (_jsxs("div", { style: { padding: '2rem', textAlign: 'center', color: colors.gray500 }, children: [_jsx("p", { style: { fontSize: '1.125rem', marginBottom: '0.5rem' }, children: " Access Restricted" }), _jsx("p", { children: "You don't have permission to view analytics." })] }));
    }
    const refresh = useCallback(async () => {
        setLoading(true);
        setErr(null);
        try {
            const alertsRes = await apiFetchJson('/alerts?limit=10000', accessToken).catch(() => []);
            const alertsData = Array.isArray(alertsRes) ? alertsRes : alertsRes?.alerts ?? [];
            setAlerts(safeArr(alertsData).filter((a) => typeof a.id === 'string'));
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load analytics data';
            setErr(message);
        }
        finally {
            setLoading(false);
        }
    }, [accessToken]);
    useEffect(() => {
        refresh();
    }, [refresh]);
    // Calculate date ranges
    const now = new Date();
    const startOfThisWeek = getStartOfWeek(now);
    const startOfThisMonth = getStartOfMonth(now);
    const startOfThisYear = getStartOfYear(now);
    // Previous periods for comparison
    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
    const endOfLastWeek = new Date(startOfThisWeek);
    endOfLastWeek.setMilliseconds(-1);
    const startOfLastMonth = new Date(startOfThisMonth);
    startOfLastMonth.setMonth(startOfLastMonth.getMonth() - 1);
    const endOfLastMonth = new Date(startOfThisMonth);
    endOfLastMonth.setMilliseconds(-1);
    // Filter alerts by period
    const alertsThisWeek = useMemo(() => alerts.filter(a => a.created_at && new Date(a.created_at) >= startOfThisWeek), [alerts, startOfThisWeek]);
    const alertsLastWeek = useMemo(() => alerts.filter(a => {
        if (!a.created_at)
            return false;
        const d = new Date(a.created_at);
        return d >= startOfLastWeek && d <= endOfLastWeek;
    }), [alerts, startOfLastWeek, endOfLastWeek]);
    const alertsThisMonth = useMemo(() => alerts.filter(a => a.created_at && new Date(a.created_at) >= startOfThisMonth), [alerts, startOfThisMonth]);
    const alertsLastMonth = useMemo(() => alerts.filter(a => {
        if (!a.created_at)
            return false;
        const d = new Date(a.created_at);
        return d >= startOfLastMonth && d <= endOfLastMonth;
    }), [alerts, startOfLastMonth, endOfLastMonth]);
    const alertsYTD = useMemo(() => alerts.filter(a => a.created_at && new Date(a.created_at) >= startOfThisYear), [alerts, startOfThisYear]);
    // Get currently selected alerts
    const selectedAlerts = useMemo(() => {
        switch (selectedPeriod) {
            case 'week': return alertsThisWeek;
            case 'month': return alertsThisMonth;
            case 'ytd': return alertsYTD;
            default: return alertsThisMonth;
        }
    }, [selectedPeriod, alertsThisWeek, alertsThisMonth, alertsYTD]);
    // Compute breakdowns for selected period
    const breakdowns = useMemo(() => {
        const bySeverity = mapToSortedArray(groupAndCount(selectedAlerts, a => {
            const s = (a.severity ?? 'unknown').toLowerCase();
            // Capitalize first letter
            return s.charAt(0).toUpperCase() + s.slice(1);
        }));
        const byEventType = mapToSortedArray(groupAndCount(selectedAlerts, a => a.event_type ?? 'Unknown'));
        const byCountry = mapToSortedArray(groupAndCount(selectedAlerts, a => a.country ?? 'Unknown'));
        const posted = selectedAlerts.filter(a => a.wordpress_post_id != null).length;
        const draft = selectedAlerts.filter(a => a.status === 'draft').length;
        const approved = selectedAlerts.filter(a => a.status === 'approved').length;
        const dismissed = selectedAlerts.filter(a => a.status === 'dismissed').length;
        return {
            bySeverity,
            byEventType,
            byCountry,
            total: selectedAlerts.length,
            posted,
            draft,
            approved,
            dismissed,
        };
    }, [selectedAlerts]);
    // Period labels
    const weekLabel = `${startOfThisWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const ytdLabel = `Jan 1 - ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    // Comparisons
    const weekComparison = percentChange(alertsThisWeek.length, alertsLastWeek.length);
    const monthComparison = percentChange(alertsThisMonth.length, alertsLastMonth.length);
    // Styles
    const containerStyle = {
        padding: '1.5rem',
        backgroundColor: COLORS.bg,
        minHeight: '100%',
    };
    const headerStyle = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem',
    };
    if (loading) {
        return (_jsx("div", { style: containerStyle, children: _jsx("div", { style: { textAlign: 'center', padding: '3rem', color: COLORS.muted }, children: "Loading analytics..." }) }));
    }
    return (_jsxs("div", { style: containerStyle, children: [_jsxs("div", { style: headerStyle, children: [_jsxs("div", { children: [_jsx("h2", { style: {
                                    fontSize: '1.5rem',
                                    fontWeight: 600,
                                    color: COLORS.primary,
                                    margin: 0,
                                    marginBottom: '0.25rem',
                                }, children: "Analytics Dashboard" }), _jsx("p", { style: { margin: 0, fontSize: '0.875rem', color: COLORS.muted }, children: "Alert metrics by time period" })] }), _jsxs("div", { style: { display: 'flex', gap: '0.5rem' }, children: [_jsx("button", { onClick: () => setHealthCheckOpen(true), style: {
                                    ...buttons.secondary,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    fontSize: '0.875rem',
                                }, children: "\uD83C\uDFE5 Health" }), _jsx("button", { onClick: refresh, disabled: loading, style: {
                                    ...buttons.secondary,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                }, children: "Refresh" })] })] }), _jsx(HealthCheckModal, { isOpen: healthCheckOpen, onClose: () => setHealthCheckOpen(false), accessToken: accessToken }), err && (_jsxs("div", { style: {
                    padding: '1rem',
                    backgroundColor: '#FEF2F2',
                    border: `1px solid ${COLORS.danger}`,
                    borderRadius: '8px',
                    color: COLORS.danger,
                    marginBottom: '1.5rem',
                }, children: [_jsx("strong", { children: "Error:" }), " ", err] })), _jsxs("div", { style: {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem',
                    marginBottom: '2rem',
                }, children: [_jsx(PeriodCard, { title: "This Week", subtitle: weekLabel, total: alertsThisWeek.length, posted: alertsThisWeek.filter(a => a.wordpress_post_id).length, comparison: { ...weekComparison, label: 'vs last week' }, isActive: selectedPeriod === 'week', onClick: () => setSelectedPeriod('week') }), _jsx(PeriodCard, { title: "This Month", subtitle: monthLabel, total: alertsThisMonth.length, posted: alertsThisMonth.filter(a => a.wordpress_post_id).length, comparison: { ...monthComparison, label: 'vs last month' }, isActive: selectedPeriod === 'month', onClick: () => setSelectedPeriod('month') }), _jsx(PeriodCard, { title: "Year to Date", subtitle: ytdLabel, total: alertsYTD.length, posted: alertsYTD.filter(a => a.wordpress_post_id).length, isActive: selectedPeriod === 'ytd', onClick: () => setSelectedPeriod('ytd') })] }), _jsxs("div", { style: {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                    gap: '0.75rem',
                    marginBottom: '2rem',
                }, children: [_jsx(SummaryStat, { label: "Total Alerts", value: formatNumber(breakdowns.total), icon: "", color: COLORS.primary }), _jsx(SummaryStat, { label: "Posted to WP", value: formatNumber(breakdowns.posted), icon: "", color: COLORS.success }), _jsx(SummaryStat, { label: "Drafts", value: formatNumber(breakdowns.draft), icon: "", color: COLORS.warning }), _jsx(SummaryStat, { label: "Approved", value: formatNumber(breakdowns.approved), icon: "", color: COLORS.info }), _jsx(SummaryStat, { label: "Dismissed", value: formatNumber(breakdowns.dismissed), icon: "", color: COLORS.muted })] }), _jsxs("div", { style: {
                    marginBottom: '1rem',
                    padding: '0.75rem 1rem',
                    backgroundColor: COLORS.primary,
                    color: 'white',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                }, children: ["Breakdown for: ", selectedPeriod === 'week' ? `This Week (${weekLabel})` : selectedPeriod === 'month' ? monthLabel : `Year to Date (${ytdLabel})`] }), _jsxs("div", { style: {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                    gap: '1.5rem',
                }, children: [_jsx(BreakdownTable, { title: "By Severity", icon: "", data: breakdowns.bySeverity, total: breakdowns.total, colorFn: (key) => SEVERITY_COLORS[key] ?? COLORS.muted, maxRows: 5 }), _jsx(BreakdownTable, { title: "By Event Type", icon: "", data: breakdowns.byEventType, total: breakdowns.total, colorFn: () => COLORS.accent, maxRows: 10 }), _jsx(BreakdownTable, { title: "By Country", icon: "", data: breakdowns.byCountry, total: breakdowns.total, colorFn: () => COLORS.info, maxRows: 15 })] }), _jsxs("div", { style: {
                    marginTop: '2rem',
                    padding: '1rem',
                    textAlign: 'center',
                    fontSize: '0.75rem',
                    color: COLORS.muted,
                    borderTop: `1px solid ${COLORS.border}`,
                }, children: ["Data refreshed: ", new Date().toLocaleString(), "  Total alerts in database: ", formatNumber(alerts.length)] })] }));
}
export default AnalyticsDashboardInline;
