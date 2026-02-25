import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { apiFetchJson, apiPostJson } from '../lib/utils/api';
export function AutoScourSettings({ accessToken, isAdmin }) {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState(false);
    const [running, setRunning] = useState(false);
    const loadStatus = async () => {
        try {
            setLoading(true);
            const result = await apiFetchJson('/auto-scour/status', accessToken);
            if (result.ok) {
                setStatus({
                    enabled: result.enabled,
                    intervalMinutes: result.intervalMinutes,
                    lastRun: result.lastRun,
                    envEnabled: result.envEnabled,
                });
            }
        }
        catch (err) {
            console.error('Failed to load auto-scour status:', err);
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        if (isAdmin) {
            loadStatus();
        }
    }, [isAdmin, accessToken]);
    const handleToggle = async () => {
        if (!status)
            return;
        try {
            setToggling(true);
            const result = await apiPostJson('/auto-scour/toggle', { enabled: !status.enabled, intervalMinutes: status.intervalMinutes }, accessToken);
            if (result.ok) {
                setStatus({ ...status, enabled: result.enabled });
                alert(result.message);
            }
        }
        catch (err) {
            console.error('Failed to toggle auto-scour:', err);
            alert('Failed to toggle auto-scour: ' + err.message);
        }
        finally {
            setToggling(false);
        }
    };
    const handleRunNow = async () => {
        try {
            setRunning(true);
            const result = await apiPostJson('/auto-scour/run-now', {}, accessToken);
            if (result.ok) {
                alert(result.message + '\nJob ID: ' + result.jobId);
                await loadStatus();
            }
        }
        catch (err) {
            console.error('Failed to run auto-scour:', err);
            alert('Failed to run auto-scour: ' + err.message);
        }
        finally {
            setRunning(false);
        }
    };
    if (!isAdmin) {
        return null;
    }
    if (loading) {
        return (_jsx("div", { style: {
                padding: '1.5rem',
                backgroundColor: '#f9fafb',
                borderRadius: '0.5rem',
                border: '1px solid #e5e7eb',
            }, children: _jsx("div", { style: { color: '#6b7280' }, children: "Loading auto-scour settings..." }) }));
    }
    if (!status) {
        return null;
    }
    const containerStyle = {
        padding: '1.5rem',
        backgroundColor: status.enabled ? '#ecfdf5' : '#f9fafb',
        borderRadius: '0.5rem',
        border: `2px solid ${status.enabled ? '#10b981' : '#e5e7eb'}`,
        marginBottom: '2rem',
    };
    const headerStyle = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1rem',
    };
    const titleStyle = {
        fontSize: '1.125rem',
        fontWeight: '600',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
    };
    const badgeStyle = {
        padding: '0.25rem 0.75rem',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: '600',
        backgroundColor: status.enabled ? '#10b981' : '#6b7280',
        color: 'white',
    };
    const infoStyle = {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '1rem',
        fontSize: '0.875rem',
        color: '#4b5563',
    };
    const buttonStyle = {
        padding: '0.5rem 1rem',
        borderRadius: '0.375rem',
        border: 'none',
        fontSize: '0.875rem',
        fontWeight: '600',
        cursor: 'pointer',
        marginRight: '0.5rem',
    };
    const toggleButtonStyle = {
        ...buttonStyle,
        backgroundColor: status.enabled ? '#ef4444' : '#10b981',
        color: 'white',
    };
    const runNowButtonStyle = {
        ...buttonStyle,
        backgroundColor: '#3b82f6',
        color: 'white',
    };
    return (_jsxs("div", { style: containerStyle, children: [_jsx("div", { style: headerStyle, children: _jsxs("div", { style: titleStyle, children: [_jsx("span", {}), _jsx("span", { children: "Auto Scour (Admin)" }), _jsx("span", { style: badgeStyle, children: status.enabled ? 'ENABLED' : 'DISABLED' })] }) }), _jsxs("div", { style: infoStyle, children: [_jsxs("div", { children: [_jsx("strong", { children: "Interval:" }), " Every ", status.intervalMinutes, " minutes"] }), _jsxs("div", { children: [_jsx("strong", { children: "Last Run:" }), ' ', status.lastRun ? new Date(status.lastRun).toLocaleString() : 'Never'] }), _jsxs("div", { children: [_jsx("strong", { children: "Env Status:" }), ' ', _jsx("span", { style: { color: status.envEnabled ? '#10b981' : '#ef4444' }, children: status.envEnabled ? ' Enabled' : ' Disabled' })] })] }), _jsxs("div", { style: { display: 'flex', gap: '0.5rem', alignItems: 'center' }, children: [_jsx("button", { onClick: handleToggle, disabled: toggling, style: {
                            ...toggleButtonStyle,
                            opacity: toggling ? 0.6 : 1,
                            cursor: toggling ? 'not-allowed' : 'pointer',
                        }, children: toggling ? ' Toggling...' : status.enabled ? ' Disable Auto Scour' : ' Enable Auto Scour' }), status.enabled && (_jsx("button", { onClick: handleRunNow, disabled: running, style: {
                            ...runNowButtonStyle,
                            opacity: running ? 0.6 : 1,
                            cursor: running ? 'not-allowed' : 'pointer',
                        }, children: running ? ' Running...' : ' Run Now' })), _jsx("div", { style: { marginLeft: 'auto', fontSize: '0.75rem', color: '#6b7280' }, children: status.enabled ? ' Automatically scouring sources' : ' Manual scour only' })] }), !status.envEnabled && (_jsxs("div", { style: {
                    marginTop: '1rem',
                    padding: '0.75rem',
                    backgroundColor: '#fef3c7',
                    color: '#92400e',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                }, children: [_jsx("strong", { children: "Warning:" }), " AUTO_SCOUR_ENABLED environment variable is disabled in edge function. Set it to \"true\" in Supabase dashboard for cron to work."] }))] }));
}
