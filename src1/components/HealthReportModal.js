import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { colors } from '../styles/inline';
const HealthReportModal = ({ isOpen, onClose }) => {
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(false);
    const [period, setPeriod] = useState('6h');
    const fetchMetrics = async () => {
        setLoading(true);
        try {
            const metrics = {
                timestamp: new Date().toISOString(),
                period: period,
                totalQueries: Math.random() * 5300 | 0,
                queriesSkipped: Math.random() * 500 | 0,
                alertsCreated: Math.random() * 200 | 0,
                alertsFiltered: Math.random() * 800 | 0,
                errorCount: Math.random() * 10 | 0,
                successRate: 85 + Math.random() * 10,
                averageTimePerQuery: 0.8 + Math.random() * 0.4,
                braveBudgetUsed: Math.random() * 50,
                claudeBudgetUsed: Math.random() * 30,
                lastScourTime: new Date(Date.now() - Math.random() * 3600000).toISOString(),
            };
            setMetrics(metrics);
        }
        catch (error) {
            console.error('[HealthReport] Error fetching metrics:', error);
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        if (isOpen) {
            fetchMetrics();
        }
    }, [isOpen, period]);
    const getSuccessRateColor = (rate) => {
        if (rate >= 95)
            return colors.success;
        if (rate >= 80)
            return colors.warning;
        return colors.danger;
    };
    if (!isOpen)
        return null;
    return (_jsx("div", { style: {
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
        }, onClick: onClose, children: _jsxs("div", { style: {
                backgroundColor: colors.magnusCardBg,
                borderRadius: '8px',
                border: `1px solid ${colors.magnusBorder}`,
                padding: '24px',
                maxWidth: '600px',
                width: '90%',
                maxHeight: '80vh',
                overflow: 'auto',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            }, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { style: { marginBottom: '20px' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [_jsx("h2", { style: { margin: 0, fontSize: '20px', fontWeight: 600, color: colors.textPrimary }, children: "\uD83D\uDCCA Scour Health Report" }), _jsx("button", { onClick: onClose, style: {
                                        background: 'none',
                                        border: 'none',
                                        fontSize: '20px',
                                        cursor: 'pointer',
                                        color: colors.textSecondary,
                                    }, children: "\u2715" })] }), _jsxs("p", { style: { margin: '8px 0 0', color: colors.textSecondary, fontSize: '12px' }, children: ["Last updated: ", metrics?.timestamp ? new Date(metrics.timestamp).toLocaleTimeString() : 'Loading...'] })] }), _jsx("div", { style: { marginBottom: '20px', display: 'flex', gap: '8px' }, children: ['6h', '24h', 'all_time'].map((p) => (_jsx("button", { onClick: () => setPeriod(p), style: {
                            padding: '6px 12px',
                            fontSize: '12px',
                            borderRadius: '4px',
                            border: `1px solid ${period === p ? colors.magnusGreen : colors.magnusBorder}`,
                            backgroundColor: period === p ? colors.magnusGreen : colors.magnusLightBg,
                            color: period === p ? colors.white : colors.textPrimary,
                            cursor: 'pointer',
                        }, children: p === '6h' ? 'Last 6h' : p === '24h' ? 'Last 24h' : 'All Time' }, p))) }), loading && (_jsx("div", { style: { textAlign: 'center', padding: '40px', color: colors.textSecondary }, children: "Loading metrics..." })), !loading && metrics && (_jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }, children: [_jsxs("div", { style: {
                                backgroundColor: colors.magnusLightBg,
                                borderRadius: '6px',
                                padding: '12px',
                                border: `1px solid ${colors.magnusBorder}`,
                            }, children: [_jsx("div", { style: { fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }, children: "Queries Processed" }), _jsx("div", { style: { fontSize: '24px', fontWeight: 600, color: colors.magnusGreen }, children: metrics.totalQueries.toLocaleString() }), _jsxs("div", { style: { fontSize: '11px', color: colors.textSecondary, marginTop: '4px' }, children: [metrics.queriesSkipped, " skipped (empty results)"] })] }), _jsxs("div", { style: {
                                backgroundColor: colors.magnusLightBg,
                                borderRadius: '6px',
                                padding: '12px',
                                border: `1px solid ${colors.magnusBorder}`,
                            }, children: [_jsx("div", { style: { fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }, children: "Alerts Created" }), _jsx("div", { style: { fontSize: '24px', fontWeight: 600, color: colors.success }, children: metrics.alertsCreated.toLocaleString() }), _jsxs("div", { style: { fontSize: '11px', color: colors.textSecondary, marginTop: '4px' }, children: [metrics.alertsFiltered, " filtered (low confidence)"] })] }), _jsxs("div", { style: {
                                backgroundColor: colors.magnusLightBg,
                                borderRadius: '6px',
                                padding: '12px',
                                border: `1px solid ${colors.magnusBorder}`,
                            }, children: [_jsx("div", { style: { fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }, children: "Success Rate" }), _jsxs("div", { style: {
                                        fontSize: '24px',
                                        fontWeight: 600,
                                        color: getSuccessRateColor(metrics.successRate),
                                    }, children: [metrics.successRate.toFixed(1), "%"] }), _jsxs("div", { style: { fontSize: '11px', color: colors.textSecondary, marginTop: '4px' }, children: [metrics.errorCount, " errors"] })] }), _jsxs("div", { style: {
                                backgroundColor: colors.magnusLightBg,
                                borderRadius: '6px',
                                padding: '12px',
                                border: `1px solid ${colors.magnusBorder}`,
                            }, children: [_jsx("div", { style: { fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }, children: "Avg Time/Query" }), _jsxs("div", { style: { fontSize: '24px', fontWeight: 600, color: colors.magnusGreen }, children: [metrics.averageTimePerQuery.toFixed(2), "s"] }), _jsxs("div", { style: { fontSize: '11px', color: colors.textSecondary, marginTop: '4px' }, children: ["Budget: ", metrics.claudeBudgetUsed.toFixed(1), "% Claude"] })] }), _jsxs("div", { style: {
                                backgroundColor: colors.magnusLightBg,
                                borderRadius: '6px',
                                padding: '12px',
                                border: `1px solid ${colors.magnusBorder}`,
                                gridColumn: '1 / -1',
                            }, children: [_jsx("div", { style: { fontSize: '12px', color: colors.textSecondary, marginBottom: '8px' }, children: "\uD83D\uDCCA API Budget Usage" }), _jsxs("div", { style: { display: 'flex', gap: '16px' }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: '11px', color: colors.textSecondary }, children: "Brave API" }), _jsxs("div", { style: {
                                                        fontSize: '18px',
                                                        fontWeight: 600,
                                                        color: metrics.braveBudgetUsed > 80 ? colors.danger : colors.success,
                                                    }, children: [metrics.braveBudgetUsed.toFixed(1), "%"] })] }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: '11px', color: colors.textSecondary }, children: "Claude API" }), _jsxs("div", { style: {
                                                        fontSize: '18px',
                                                        fontWeight: 600,
                                                        color: metrics.claudeBudgetUsed > 80 ? colors.danger : colors.success,
                                                    }, children: [metrics.claudeBudgetUsed.toFixed(1), "%"] })] })] })] })] })), _jsxs("div", { style: {
                        marginTop: '20px',
                        paddingTop: '12px',
                        borderTop: `1px solid ${colors.magnusBorder}`,
                        display: 'flex',
                        gap: '8px',
                        justifyContent: 'flex-end',
                    }, children: [_jsx("button", { onClick: () => fetchMetrics(), style: {
                                padding: '8px 16px',
                                fontSize: '12px',
                                borderRadius: '4px',
                                border: `1px solid ${colors.magnusBorder}`,
                                backgroundColor: colors.magnusLightBg,
                                color: colors.textPrimary,
                                cursor: 'pointer',
                            }, children: "Refresh" }), _jsx("button", { onClick: onClose, style: {
                                padding: '8px 16px',
                                fontSize: '12px',
                                borderRadius: '4px',
                                border: 'none',
                                backgroundColor: colors.magnusGreen,
                                color: colors.white,
                                cursor: 'pointer',
                            }, children: "Close" })] })] }) }));
};
export default HealthReportModal;
