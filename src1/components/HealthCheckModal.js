import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * HealthCheckModal - System Health Check Popup
 *
 * Tests all backend APIs and internal routing
 */
import { useState } from 'react';
import { apiFetchJson } from '../lib/utils/api';
import { colors } from '../styles/inline';
import { buttons } from '../styles/designSystem';
const HealthCheckModal = ({ isOpen, onClose, accessToken }) => {
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState(null);
    const [internalRoutes, setInternalRoutes] = useState({});
    const [checkStarted, setCheckStarted] = useState(false);
    const runHealthCheck = async () => {
        setCheckStarted(true);
        setLoading(true);
        setResults(null);
        setInternalRoutes({});
        try {
            // First, test internal routing (should be faster)
            console.log('[Health Check] Starting internal route tests...');
            const routes = await testInternalRouting(accessToken);
            console.log('[Health Check] Internal routes:', routes);
            setInternalRoutes(routes);
            // Then run backend health check
            console.log('[Health Check] Starting backend health check...');
            const healthRes = await apiFetchJson('/health', accessToken);
            console.log('[Health Check] Backend health:', healthRes);
            setResults(healthRes);
        }
        catch (e) {
            console.error('[Health Check] Error:', e);
            setResults({
                timestamp: new Date().toISOString(),
                checks: { error: { ok: false, message: e.message } },
                allHealthy: false,
            });
        }
        finally {
            setLoading(false);
        }
    };
    const testInternalRouting = async (token) => {
        const routes = {
            '/alerts (GET)': { ok: false, message: 'Testing...' },
            '/admin/users (GET)': { ok: false, message: 'Testing...' },
            '/trends (GET)': { ok: false, message: 'Testing...' },
            '/scour/status (GET)': { ok: false, message: 'Testing...' },
        };
        // Test each route with a timeout
        const testRoutes = [
            { key: '/alerts (GET)', path: '/alerts?limit=1' },
            { key: '/admin/users (GET)', path: '/admin/users' },
            { key: '/trends (GET)', path: '/trends' },
            { key: '/scour/status (GET)', path: '/scour/status' },
        ];
        for (const route of testRoutes) {
            try {
                console.log(`[Health Check] Testing ${route.key}...`);
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 8000); // 8 second timeout
                const res = await Promise.race([
                    apiFetchJson(route.path, token),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout after 8s')), 8000))
                ]);
                clearTimeout(timeout);
                console.log(`[Health Check] ${route.key} response:`, res);
                routes[route.key] = {
                    ok: !!res && res.ok !== false,
                    message: !!res && res.ok !== false ? '✅ Responsive' : `⚠️ ${res?.error || 'Error response'}`,
                };
            }
            catch (e) {
                console.warn(`[Health Check] ${route.key} failed:`, e.message);
                routes[route.key] = {
                    ok: false,
                    message: `❌ ${e.message || 'Unknown error'}`,
                };
            }
        }
        return routes;
    };
    if (!isOpen)
        return null;
    return (_jsx("div", { style: {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
        }, onClick: onClose, children: _jsxs("div", { style: {
                backgroundColor: 'white',
                borderRadius: '8px',
                padding: '24px',
                maxWidth: '600px',
                maxHeight: '80vh',
                overflowY: 'auto',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            }, onClick: (e) => e.stopPropagation(), children: [_jsx("h2", { style: { marginTop: 0, marginBottom: '16px', color: colors.gray900 }, children: "\uD83C\uDFE5 System Health Check" }), _jsx("button", { onClick: runHealthCheck, disabled: loading, style: {
                        ...buttons.primary,
                        width: '100%',
                        marginBottom: '16px',
                        opacity: loading ? 0.6 : 1,
                    }, children: loading ? 'Running checks...' : '▶️ Run Health Check' }), results && (_jsxs("div", { children: [_jsxs("div", { style: { marginBottom: '16px', fontSize: '12px', color: colors.gray600 }, children: ["Last checked: ", new Date(results.timestamp).toLocaleTimeString()] }), _jsx("h3", { style: { marginBottom: '12px', color: colors.gray800, fontSize: '14px', fontWeight: 600 }, children: "Backend APIs" }), _jsx("div", { style: { marginBottom: '16px', display: 'grid', gap: '8px' }, children: Object.entries(results.checks).map(([name, check]) => (_jsxs("div", { style: {
                                    padding: '12px',
                                    backgroundColor: check.ok ? colors.green50 : colors.red50,
                                    border: `1px solid ${check.ok ? colors.green200 : colors.red200}`,
                                    borderRadius: '6px',
                                    fontSize: '13px',
                                }, children: [_jsxs("div", { style: { fontWeight: 600, marginBottom: '4px' }, children: [check.ok ? '✅' : '❌', " ", name] }), _jsx("div", { style: { color: colors.gray600, fontSize: '12px' }, children: check.message }), check.tables && (_jsxs("div", { style: { fontSize: '11px', marginTop: '4px', color: colors.gray500 }, children: ["Tables: ", check.tables.join(', ')] }))] }, name))) }), _jsxs("h3", { style: { marginBottom: '12px', color: colors.gray800, fontSize: '14px', fontWeight: 600 }, children: ["Frontend to Backend Routes ", loading ? '(Testing...)' : ''] }), _jsx("div", { style: { marginBottom: '16px', display: 'grid', gap: '8px' }, children: Object.entries(internalRoutes).length > 0 ? (Object.entries(internalRoutes).map(([route, check]) => (_jsxs("div", { style: {
                                    padding: '12px',
                                    backgroundColor: check.ok ? colors.green50 : colors.red50,
                                    border: `1px solid ${check.ok ? colors.green200 : colors.red200}`,
                                    borderRadius: '6px',
                                    fontSize: '13px',
                                }, children: [_jsxs("div", { style: { fontWeight: 600, marginBottom: '4px' }, children: [check.ok ? '✅' : '❌', " ", route] }), _jsx("div", { style: { color: colors.gray600, fontSize: '12px' }, children: check.message })] }, route)))) : (_jsx("div", { style: { padding: '12px', color: colors.gray500, fontSize: '13px' }, children: loading ? 'Testing routes...' : 'Run health check to test routes' })) }), _jsx("div", { style: {
                                padding: '12px',
                                backgroundColor: results.allHealthy ? colors.green50 : colors.orange50,
                                border: `2px solid ${results.allHealthy ? colors.green500 : colors.orange500}`,
                                borderRadius: '6px',
                                fontSize: '14px',
                                fontWeight: 600,
                                textAlign: 'center',
                            }, children: results.allHealthy ? '✅ All Systems Healthy' : '⚠️ Some Systems Have Issues' })] })), _jsx("button", { onClick: onClose, style: {
                        ...buttons.secondary,
                        width: '100%',
                        marginTop: '16px',
                    }, children: "Close" })] }) }));
};
export default HealthCheckModal;
