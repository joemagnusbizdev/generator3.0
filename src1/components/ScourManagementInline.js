import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
export default function ScourManagementInline({ accessToken }) {
    const [sourceGroups, setSourceGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [runningGroupIds, setRunningGroupIds] = useState(new Set());
    const [allComplete, setAllComplete] = useState(false);
    const [statusMessages, setStatusMessages] = useState({});
    const [lastSourceCount, setLastSourceCount] = useState(0);
    const [isExpanded, setIsExpanded] = useState(false);
    const [activityLogs, setActivityLogs] = useState({});
    const [expandedActivityLogs, setExpandedActivityLogs] = useState(new Set());
    useEffect(() => {
        loadAndGroupSources();
        // Poll for new sources every 10 seconds
        const interval = setInterval(() => {
            loadAndGroupSources();
        }, 10000);
        return () => clearInterval(interval);
    }, [accessToken]);
    // Poll for activity logs while any scour is running
    useEffect(() => {
        if (runningGroupIds.size === 0)
            return;
        const pollActivityLogs = async () => {
            try {
                // Poll first running group for activity logs display
                const firstRunning = Array.from(runningGroupIds)[0];
                if (!firstRunning)
                    return;
                const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clever-function/scour/status?jobId=${encodeURIComponent(firstRunning)}`, {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data.job?.activityLog && Array.isArray(data.job.activityLog)) {
                        setActivityLogs(prev => ({ ...prev, [firstRunning]: data.job.activityLog }));
                        // Auto-expand logs section when logs appear
                        if (data.job.activityLog.length > 0 && !expandedActivityLogs.has(firstRunning)) {
                            setExpandedActivityLogs(prev => new Set([...prev, firstRunning]));
                        }
                    }
                }
            }
            catch (e) {
                // Silently fail
            }
        };
        // Poll every 500ms for live updates
        const interval = setInterval(pollActivityLogs, 500);
        return () => clearInterval(interval);
    }, [runningGroupIds, accessToken]);
    const addStatusMessage = (groupId, message) => {
        setStatusMessages(prev => ({ ...prev, [groupId]: message }));
    };
    // Parse log message to extract just the query and country
    const parseActivityLogMessage = (message) => {
        // Format: [progress bar] N/TOTAL (%)% - "query" in Country → status
        // Extract: "query" in Country
        const match = message.match(/-\s+"([^"]+)"\s+in\s+([^→]+)→/);
        if (match) {
            return `${match[1]} • ${match[2].trim()}`;
        }
        // Fallback to original if format doesn't match
        return message.replace(/^\[[█░\s]+\]\s+\d+\/\d+\s+\(\d+%\)\s+-\s+/, '');
    };
    const loadAndGroupSources = async () => {
        try {
            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/sources?enabled=eq.true&select=*,last_scoured_at&order=type,name`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
                    'Content-Type': 'application/json',
                },
            });
            if (!response.ok)
                throw new Error('Failed to load sources');
            const sources = await response.json();
            // Only update if source count changed
            if (sources.length === lastSourceCount) {
                return;
            }
            setLastSourceCount(sources.length);
            const groupedByType = new Map();
            sources.forEach(source => {
                const type = source.type || 'other';
                if (!groupedByType.has(type))
                    groupedByType.set(type, []);
                groupedByType.get(type).push(source);
            });
            // Use the latest sourceGroups from state callback
            setSourceGroups(prevSourceGroups => {
                const groups = [];
                // Add Early Signals as first group, preserving its state if it exists
                const existingEarlySignals = prevSourceGroups.find(g => g.id === 'early-signals');
                console.log(`[Polling] Early signals state:`, {
                    exists: !!existingEarlySignals,
                    status: existingEarlySignals?.status,
                    lastScourTime: existingEarlySignals?.lastScourTime
                });
                groups.push({
                    id: 'early-signals',
                    type: 'early_signals',
                    name: 'Early Signals Scour',
                    sources: [],
                    status: existingEarlySignals?.status || 'pending',
                    lastScourTime: existingEarlySignals?.lastScourTime,
                    results: existingEarlySignals?.results,
                });
                groupedByType.forEach((typeSourceList, type) => {
                    for (let i = 0; i < typeSourceList.length; i += 50) {
                        const batch = typeSourceList.slice(i, i + 50);
                        const groupIndex = Math.floor(i / 50);
                        const groupId = `${type}-${groupIndex}`;
                        // Preserve existing group state if it exists
                        const existingGroup = prevSourceGroups.find(g => g.id === groupId);
                        // Get the most recent scour time from sources in this batch
                        const mostRecentScourTime = batch
                            .filter(s => s.last_scoured_at)
                            .map(s => new Date(s.last_scoured_at).getTime())
                            .sort((a, b) => b - a)[0];
                        groups.push({
                            id: groupId,
                            type,
                            name: `${type.charAt(0).toUpperCase() + type.slice(1)} - Group ${groupIndex + 1} (${batch.length} sources)`,
                            sources: batch,
                            status: existingGroup?.status || 'pending',
                            lastScourTime: existingGroup?.lastScourTime || (mostRecentScourTime ? new Date(mostRecentScourTime).toISOString() : undefined),
                            results: existingGroup?.results,
                        });
                    }
                });
                return groups;
            });
            setLoading(false);
        }
        catch (e) {
            console.error('Failed to load sources:', e);
            setLoading(false);
        }
    };
    const runGroup = async (groupId) => {
        const group = sourceGroups.find(g => g.id === groupId);
        if (!group || runningGroupIds.has(groupId))
            return; // Only block if THIS group is already running
        setRunningGroupIds(prev => new Set([...prev, groupId]));
        setSourceGroups(prev => prev.map(g => g.id === groupId ? { ...g, status: 'running' } : g));
        addStatusMessage(groupId, 'Starting...');
        const now = new Date().toISOString(); // Set timestamp at the start
        try {
            const statusMsg = groupId === 'early-signals'
                ? 'Running web search scour...'
                : `Scouring ${group.sources.length} sources...`;
            addStatusMessage(groupId, statusMsg);
            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clever-function/scour/run?t=${Date.now()}`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                },
                body: JSON.stringify({
                    jobId: groupId,
                    sourceIds: groupId === 'early-signals' ? [] : group.sources.map(s => s.id),
                    earlySignalsOnly: groupId === 'early-signals',
                }),
            });
            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
                throw new Error(error.error || `Scour failed with status ${response.status}`);
            }
            const result = await response.json();
            console.log(`[Scour run] Response result:`, result);
            // If job is queued, poll for completion instead of getting immediate results
            if (result.status === 'queued') {
                const actualJobId = result.jobId || groupId; // Use the ID returned from the backend
                console.log(`[Scour polling] Using jobId: "${actualJobId}" (groupId: "${groupId}"), result.jobId: "${result.jobId}"`);
                addStatusMessage(groupId, 'Job queued, polling for status...');
                // Poll for job completion
                let jobComplete = false;
                let pollCount = 0;
                const maxPolls = 1800; // 15 minutes with 500ms interval
                while (!jobComplete && pollCount < maxPolls) {
                    await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms between polls
                    pollCount++;
                    try {
                        const statusResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clever-function/scour/status?jobId=${encodeURIComponent(actualJobId)}`, {
                            headers: {
                                Authorization: `Bearer ${accessToken}`,
                            },
                        });
                        if (statusResponse.ok) {
                            const statusData = await statusResponse.json();
                            const job = statusData.job;
                            console.log(`[Scour polling] Poll ${pollCount}: statusData keys=${Object.keys(statusData).join(',')}, job=${job ? 'exists' : 'NULL'}, job keys=${job ? Object.keys(job).join(',') : 'N/A'}`);
                            if (!job) {
                                console.warn(`[Scour polling] Poll ${pollCount}: No job data returned from status endpoint`);
                                continue;
                            }
                            console.log(`[Scour polling] Poll ${pollCount}: status=${job.status}, processed=${job.processed}/${job.total}, created=${job.created}, logs=${job.activityLog?.length || 0}`);
                            if (job && (job.status === 'done' || job.status === 'error')) {
                                jobComplete = true;
                                // Extract results from job data
                                const alerts = job.created || 0;
                                const dupes = job.duplicatesSkipped || 0;
                                const errors = job.errorCount || 0;
                                const disabledSourceIds = job.disabled_source_ids || [];
                                if (errors > 0 && disabledSourceIds.length === 0) {
                                    addStatusMessage(groupId, `⚠️ Created ${alerts} alerts, ${dupes} dupes, ${errors} errors (sources with errors will be disabled)`);
                                }
                                else {
                                    addStatusMessage(groupId, `Created ${alerts} alerts, ${dupes} dupes`);
                                }
                                // Update completion timestamp to current time
                                const completionTime = new Date().toISOString();
                                setSourceGroups(prev => prev.map(g => g.id === groupId
                                    ? {
                                        ...g,
                                        status: job.status === 'error' ? 'error' : 'completed',
                                        lastScourTime: completionTime,
                                        sources: groupId === 'early-signals' ? g.sources : g.sources.filter(s => !disabledSourceIds.includes(s.id)),
                                        results: {
                                            alerts_created: alerts,
                                            duplicates_skipped: dupes,
                                            errors: errors,
                                            disabled_sources: disabledSourceIds.length,
                                            disabled_source_ids: disabledSourceIds
                                        }
                                    }
                                    : g));
                            }
                            else if (job && job.status === 'running') {
                                // Still running, show progress
                                const processed = job.processed || 0;
                                const total = job.total || '?';
                                const logCount = job.activityLog?.length || 0;
                                const logHint = logCount > 0 ? ` (${logCount} log entries)` : '';
                                addStatusMessage(groupId, `Running: ${processed}/${total} sources processed...${logHint}`);
                            }
                            else {
                                // Status is neither done, error, nor running - might be queued/pending
                                addStatusMessage(groupId, `Processing... (status: ${job.status})`);
                            }
                        }
                    }
                    catch (pollError) {
                        // Polling error, continue trying
                        console.error(`[Scour polling] Poll ${pollCount} ERROR:`, pollError);
                    }
                }
                if (!jobComplete) {
                    console.error(`[Scour polling] TIMEOUT after ${maxPolls} polls (${maxPolls * 0.5}s)`);
                    throw new Error('Scour job polling timeout (15 minutes elapsed)');
                }
                // Clear this group from running set
                setRunningGroupIds(prev => {
                    const updated = new Set(prev);
                    updated.delete(groupId);
                    return updated;
                });
                const allDone = sourceGroups.every(g => g.id === groupId || g.status === 'completed');
                if (allDone)
                    setAllComplete(true);
                return;
            }
            // Synchronous response (for non-queued jobs)
            const alerts = result.created || 0;
            const dupes = result.duplicatesSkipped || 0;
            const errors = result.errorCount || 0;
            const disabledSourceIds = result.disabled_source_ids || result.error_source_ids || [];
            if (errors > 0 && disabledSourceIds.length === 0) {
                addStatusMessage(groupId, `⚠️ Created ${alerts} alerts, ${dupes} dupes, ${errors} errors (sources with errors will be disabled)`);
            }
            else {
                addStatusMessage(groupId, `Created ${alerts} alerts, ${dupes} dupes`);
            }
            // Update group with results and disabled sources
            const completionTime = new Date().toISOString();
            setSourceGroups(prev => prev.map(g => g.id === groupId
                ? {
                    ...g,
                    status: 'completed',
                    lastScourTime: completionTime,
                    // Remove disabled sources from the group (only for non-Early Signals)
                    sources: groupId === 'early-signals' ? g.sources : g.sources.filter(s => !disabledSourceIds.includes(s.id)),
                    results: {
                        alerts_created: alerts,
                        duplicates_skipped: dupes,
                        errors: errors,
                        disabled_sources: disabledSourceIds.length,
                        disabled_source_ids: disabledSourceIds
                    }
                }
                : g));
            if (disabledSourceIds.length > 0 && groupId !== 'early-signals') {
                addStatusMessage(groupId, `Disabling ${disabledSourceIds.length} sources due to errors...`);
                for (const sourceId of disabledSourceIds) {
                    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/sources?id=eq.${sourceId}`, {
                        method: 'PATCH',
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ enabled: false }),
                    });
                }
                addStatusMessage(groupId, 'Done');
            }
            const allDone = sourceGroups.every(g => g.id === groupId || g.status === 'completed');
            if (allDone)
                setAllComplete(true);
        }
        catch (e) {
            const errorMsg = e.message || 'Unknown error';
            const now = new Date().toISOString();
            // If 504 timeout and not Early Signals, retry with batching
            if (errorMsg.includes('504') && groupId !== 'early-signals') {
                addStatusMessage(groupId, `⚠️ ${errorMsg} - Retrying with batch processing...`);
                try {
                    // Split sources into batches of 10 and process each
                    const sources = group.sources;
                    const batchSize = 10;
                    const batches = Math.ceil(sources.length / batchSize);
                    let totalAlerts = 0;
                    let totalDupes = 0;
                    let totalErrors = 0;
                    const allDisabledSources = [];
                    for (let batch = 0; batch < batches; batch++) {
                        const offset = batch * batchSize;
                        addStatusMessage(groupId, `Processing batch ${batch + 1}/${batches} (${offset + 1}-${Math.min(offset + batchSize, sources.length)} of ${sources.length} sources)...`);
                        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clever-function/scour/run?t=${Date.now()}`, {
                            method: 'POST',
                            headers: {
                                Authorization: `Bearer ${accessToken}`,
                                'Content-Type': 'application/json',
                                'Cache-Control': 'no-cache, no-store, must-revalidate',
                                'Pragma': 'no-cache',
                            },
                            body: JSON.stringify({
                                jobId: groupId,
                                sourceIds: sources.slice(offset, offset + batchSize).map((s) => s.id),
                                batchOffset: offset,
                                batchSize: batchSize,
                            }),
                        });
                        if (!response.ok) {
                            const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
                            throw new Error(`Batch ${batch + 1} failed: ${error.error || response.statusText}`);
                        }
                        const result = await response.json();
                        totalAlerts += result.created || 0;
                        totalDupes += result.duplicatesSkipped || 0;
                        totalErrors += result.errorCount || 0;
                        if (result.disabled_source_ids) {
                            allDisabledSources.push(...result.disabled_source_ids);
                        }
                    }
                    addStatusMessage(groupId, `Created ${totalAlerts} alerts (batch mode), ${totalDupes} dupes`);
                    const batchCompletionTime = new Date().toISOString();
                    setSourceGroups(prev => prev.map(g => g.id === groupId
                        ? {
                            ...g,
                            status: 'completed',
                            lastScourTime: batchCompletionTime,
                            sources: g.sources.filter(s => !allDisabledSources.includes(s.id)),
                            results: {
                                alerts_created: totalAlerts,
                                duplicates_skipped: totalDupes,
                                errors: totalErrors,
                                disabled_sources: allDisabledSources.length,
                                disabled_source_ids: allDisabledSources
                            }
                        }
                        : g));
                }
                catch (batchError) {
                    addStatusMessage(groupId, `Error: ${batchError.message}`);
                    const errorTime = new Date().toISOString();
                    setSourceGroups(prev => prev.map(g => g.id === groupId
                        ? { ...g, status: 'error', error: batchError.message, lastScourTime: errorTime }
                        : g));
                }
            }
            else {
                // Not a 504 timeout or is Early Signals - regular error handling
                addStatusMessage(groupId, `Error: ${errorMsg}`);
                const finalErrorTime = new Date().toISOString();
                setSourceGroups(prev => prev.map(g => g.id === groupId
                    ? { ...g, status: 'error', error: errorMsg, lastScourTime: finalErrorTime }
                    : g));
            }
        }
        finally {
            setRunningGroupIds(prev => {
                const updated = new Set(prev);
                updated.delete(groupId);
                return updated;
            });
        }
    };
    const stopAllScours = () => {
        setRunningGroupIds(new Set());
        setSourceGroups(prev => prev.map(g => (g.status === 'running' ? { ...g, status: 'pending' } : g)));
        setStatusMessages({});
    };
    if (loading) {
        return _jsx("div", { className: "text-sm text-gray-500", children: "Loading sources..." });
    }
    // Get most recent scour time from any group
    const mostRecentScour = sourceGroups
        .filter(g => g.lastScourTime)
        .map(g => new Date(g.lastScourTime).getTime())
        .sort((a, b) => b - a)[0];
    const formatTime = (timestamp) => {
        if (!timestamp)
            return 'Never';
        const date = new Date(timestamp);
        return date.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };
    return (_jsxs("div", { className: "border rounded-lg p-4 bg-gray-50", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsxs("div", { onClick: () => setIsExpanded(!isExpanded), className: "flex-1 cursor-pointer flex items-center gap-2 hover:opacity-80", children: [_jsx("span", { className: "text-lg", children: isExpanded ? '▼' : '▶' }), _jsxs("div", { className: "flex flex-col", children: [_jsx("h3", { className: "font-bold text-base", children: "\uD83D\uDCCA Scour Management" }), !isExpanded && mostRecentScour && (_jsxs("span", { className: "text-sm font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded", children: ["\u23F1 Last scour: ", formatTime(sourceGroups.find(g => g.lastScourTime && new Date(g.lastScourTime).getTime() === mostRecentScour)?.lastScourTime)] }))] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: stopAllScours, className: "text-xs px-3 py-1 rounded bg-orange-600 text-white hover:bg-orange-700 cursor-pointer font-semibold", style: { opacity: 1, pointerEvents: 'auto' }, children: "\u2297 Force Stop" }), allComplete && _jsx("span", { className: "text-xs bg-green-200 text-green-800 px-2 py-1 rounded", children: "\u2705 Complete" })] })] }), isExpanded && (_jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("h4", { className: "text-xs font-semibold text-gray-600 uppercase", children: "Scour Groups" }), sourceGroups.map(group => {
                                const isRunning = runningGroupIds.has(group.id);
                                return (_jsx("div", { className: `border rounded p-2 text-xs transition-colors ${group.status === 'completed'
                                        ? 'bg-green-100 border-green-300'
                                        : group.status === 'error'
                                            ? 'bg-red-100 border-red-300'
                                            : isRunning
                                                ? 'bg-blue-100 border-blue-300'
                                                : 'bg-white border-gray-300'}`, children: _jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "font-semibold text-xs", children: group.name }), group.lastScourTime && (_jsxs("div", { className: "text-xs font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded mt-1 inline-block", children: ["\u23F1 ", formatTime(group.lastScourTime)] }))] }), _jsxs("div", { className: "flex-shrink-0 flex items-center gap-1", children: [group.status === 'pending' && (_jsx("button", { onClick: () => runGroup(group.id), disabled: runningGroupIds.has(group.id), className: "px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap", children: "Run" })), isRunning && (_jsx("div", { className: "animate-spin w-3 h-3 border-2 border-blue-400 border-t-blue-600 rounded-full" })), group.status === 'completed' && _jsx("span", { className: "text-green-700 font-bold", children: "\u2713" }), group.status === 'error' && _jsx("span", { className: "text-red-700 font-bold", children: "\u2717" })] })] }) }, group.id));
                            })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("h4", { className: "text-xs font-semibold text-gray-600 uppercase", children: "Results & Status" }), sourceGroups.map(group => {
                                const statusMsg = statusMessages[group.id];
                                return (_jsxs("div", { className: "border rounded p-2 bg-white text-xs", children: [_jsx("div", { className: "flex items-center justify-between mb-2", children: _jsx("div", { className: "font-semibold text-xs", children: group.name }) }), group.lastScourTime && (_jsxs("div", { className: "mb-2 font-semibold text-sm text-blue-600 bg-blue-50 px-2 py-1.5 rounded border border-blue-200", children: ["\u2713 Scoured: ", formatTime(group.lastScourTime)] })), statusMsg && (_jsxs("div", { className: "text-xs text-gray-700 mb-2 flex items-center gap-2", children: [runningGroupIds.has(group.id) && (_jsx("div", { className: "animate-spin w-3 h-3 border-2 border-blue-400 border-t-blue-600 rounded-full flex-shrink-0" })), _jsx("span", { children: statusMsg })] })), (() => {
                                            const isRunning = runningGroupIds.has(group.id);
                                            const hasLogs = activityLogs[group.id];
                                            const logCount = hasLogs?.length || 0;
                                            if (isRunning && logCount > 0) {
                                                return (_jsxs("div", { className: "mb-2 border rounded bg-gray-50 overflow-hidden", children: [_jsxs("button", { onClick: () => {
                                                                const newExpanded = new Set(expandedActivityLogs);
                                                                if (newExpanded.has(group.id)) {
                                                                    newExpanded.delete(group.id);
                                                                }
                                                                else {
                                                                    newExpanded.add(group.id);
                                                                }
                                                                setExpandedActivityLogs(newExpanded);
                                                            }, className: "w-full text-left px-2 py-1 hover:bg-gray-200 font-semibold text-xs flex items-center justify-between", children: [_jsxs("span", { children: ["\uD83D\uDCCB Activity Log (", logCount, ")"] }), _jsx("span", { children: expandedActivityLogs.has(group.id) ? '▼' : '▶' })] }), expandedActivityLogs.has(group.id) && (_jsx("div", { className: "max-h-48 overflow-y-auto border-t bg-white", children: activityLogs[group.id].slice(-15).reverse().map((log, idx) => (_jsxs("div", { className: "px-2 py-1 border-b text-xs text-gray-700 hover:bg-blue-50", title: log.message, children: [_jsx("span", { className: "text-gray-500 font-mono text-xs", children: new Date(log.time).toLocaleTimeString() }), _jsxs("span", { className: "ml-2 text-gray-800", children: ["\uD83D\uDD0D ", parseActivityLogMessage(log.message)] })] }, idx))) }))] }));
                                            }
                                            return null;
                                        })(), group.results && (_jsxs("div", { className: "grid grid-cols-2 gap-2 text-xs", children: [_jsxs("div", { className: "flex items-center gap-1", children: [_jsx("span", { className: "text-green-700", children: "\u2713" }), _jsxs("span", { children: [group.results.alerts_created, " alerts"] })] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("span", { className: "text-gray-700", children: "\u223C" }), _jsxs("span", { children: [group.results.duplicates_skipped, " dupes"] })] }), group.results.errors > 0 && (_jsxs("div", { className: "flex items-center gap-1", children: [_jsx("span", { className: "text-red-700", children: "\u2717" }), _jsxs("span", { children: [group.results.errors, " errors"] })] })), group.results.disabled_sources > 0 && (_jsxs("div", { className: "flex items-center gap-1", children: [_jsx("span", { className: "text-orange-700", children: "\u2298" }), _jsxs("span", { children: [group.results.disabled_sources, " disabled"] })] }))] }))] }, group.id));
                            })] })] }))] }));
}
