import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo } from 'react';
import { apiPatchJson } from '../lib/utils/api';
const SOURCE_TYPES = [
    'usgs-atom',
    'nws-cap',
    'noaa-tropical',
    'faa-json',
    'reliefweb-rss',
    'gdacs-rss',
    'news-rss',
    'travel-advisory-rss',
    'gdelt-json',
    'google-news-api',
    'generic-rss',
    'manual'
];
function getTrustScoreColor(score) {
    const s = score || 0.5;
    if (s >= 0.8)
        return '#d4edda'; // Green
    if (s >= 0.6)
        return '#fff3cd'; // Yellow
    return '#f8d7da'; // Red
}
function getHealthStatusEmoji(health) {
    switch (health) {
        case 'healthy': return '✅';
        case 'warning': return '⚠️';
        case 'error': return '❌';
        default: return '❓';
    }
}
export function SourceTable({ sources, onSourceUpdated, accessToken }) {
    const [testing, setTesting] = useState(new Set());
    const [testResults, setTestResults] = useState(new Map());
    const [currentPage, setCurrentPage] = useState(1);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState(null);
    const [filterStatus, setFilterStatus] = useState('all');
    const [sortBy, setSortBy] = useState('name');
    const itemsPerPage = 20;
    // Filter and search
    const filtered = useMemo(() => {
        return sources.filter(source => {
            // Search filter (name, url, country)
            if (search && !source.name.toLowerCase().includes(search.toLowerCase()) &&
                !source.url.toLowerCase().includes(search.toLowerCase()) &&
                !(source.country && source.country.toLowerCase().includes(search.toLowerCase()))) {
                return false;
            }
            // Type filter
            if (filterType && (source.type || 'generic-rss') !== filterType) {
                return false;
            }
            // Status filter
            if (filterStatus === 'enabled' && !source.enabled)
                return false;
            if (filterStatus === 'disabled' && source.enabled)
                return false;
            return true;
        });
    }, [sources, search, filterType, filterStatus]);
    // Sort
    const sorted = useMemo(() => {
        const copy = [...filtered];
        switch (sortBy) {
            case 'name':
                copy.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'trust':
                copy.sort((a, b) => (b.trust_score || 0.5) - (a.trust_score || 0.5));
                break;
            case 'type':
                copy.sort((a, b) => ((a.type || 'generic-rss').localeCompare(b.type || 'generic-rss')));
                break;
        }
        return copy;
    }, [filtered, sortBy]);
    const totalPages = Math.ceil(sorted.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedSources = sorted.slice(startIndex, startIndex + itemsPerPage);
    const handleToggleEnabled = async (sourceId, currentEnabled) => {
        try {
            await apiPatchJson(`/sources/${sourceId}`, { enabled: !currentEnabled }, accessToken);
            onSourceUpdated();
        }
        catch (error) {
            console.error('Failed to toggle source:', error);
            alert('Failed to update source status');
        }
    };
    const handleTestSource = async (sourceId, url) => {
        setTesting(prev => new Set(prev).add(sourceId));
        try {
            const response = await fetch(url, { method: 'HEAD', mode: 'no-cors' });
            setTestResults(prev => new Map(prev).set(sourceId, { ok: true, status: response.status }));
        }
        catch (error) {
            setTestResults(prev => new Map(prev).set(sourceId, { ok: false }));
        }
        finally {
            setTesting(prev => {
                const next = new Set(prev);
                next.delete(sourceId);
                return next;
            });
        }
    };
    if (sources.length === 0) {
        return (_jsx("div", { style: { padding: '2rem', textAlign: 'center', color: '#666' }, children: "No sources configured. Use bulk upload to add sources." }));
    }
    // Count by status
    const enabledCount = sources.filter(s => s.enabled).length;
    const disabledCount = sources.length - enabledCount;
    return (_jsxs("div", { children: [_jsxs("div", { style: { marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', fontSize: '0.875rem' }, children: [_jsxs("div", { children: [_jsx("label", { style: { display: 'block', fontWeight: 'bold', marginBottom: '0.25rem' }, children: "\uD83D\uDD0D Search" }), _jsx("input", { type: "text", placeholder: "Source name, URL, country...", value: search, onChange: (e) => {
                                    setSearch(e.target.value);
                                    setCurrentPage(1);
                                }, style: {
                                    width: '100%',
                                    padding: '0.5rem',
                                    borderRadius: '4px',
                                    border: '1px solid #d1d5db',
                                    fontSize: '0.875rem'
                                } })] }), _jsxs("div", { children: [_jsx("label", { style: { display: 'block', fontWeight: 'bold', marginBottom: '0.25rem' }, children: "\uD83D\uDCCB Type Filter" }), _jsxs("select", { value: filterType || '', onChange: (e) => {
                                    setFilterType(e.target.value || null);
                                    setCurrentPage(1);
                                }, style: {
                                    width: '100%',
                                    padding: '0.5rem',
                                    borderRadius: '4px',
                                    border: '1px solid #d1d5db',
                                    fontSize: '0.875rem'
                                }, children: [_jsx("option", { value: "", children: "All Types" }), SOURCE_TYPES.map(type => (_jsx("option", { value: type, children: type }, type)))] })] }), _jsxs("div", { children: [_jsx("label", { style: { display: 'block', fontWeight: 'bold', marginBottom: '0.25rem' }, children: "\uD83D\uDCCA Status" }), _jsxs("select", { value: filterStatus, onChange: (e) => {
                                    setFilterStatus(e.target.value);
                                    setCurrentPage(1);
                                }, style: {
                                    width: '100%',
                                    padding: '0.5rem',
                                    borderRadius: '4px',
                                    border: '1px solid #d1d5db',
                                    fontSize: '0.875rem'
                                }, children: [_jsxs("option", { value: "all", children: ["All (", sources.length, ")"] }), _jsxs("option", { value: "enabled", children: ["Enabled (", enabledCount, ")"] }), _jsxs("option", { value: "disabled", children: ["Disabled (", disabledCount, ")"] })] })] }), _jsxs("div", { children: [_jsx("label", { style: { display: 'block', fontWeight: 'bold', marginBottom: '0.25rem' }, children: "\uD83D\uDCC8 Sort By" }), _jsxs("select", { value: sortBy, onChange: (e) => setSortBy(e.target.value), style: {
                                    width: '100%',
                                    padding: '0.5rem',
                                    borderRadius: '4px',
                                    border: '1px solid #d1d5db',
                                    fontSize: '0.875rem'
                                }, children: [_jsx("option", { value: "name", children: "Name (A-Z)" }), _jsx("option", { value: "trust", children: "Trust Score (High\u2192Low)" }), _jsx("option", { value: "type", children: "Type" })] })] })] }), _jsxs("div", { style: { marginBottom: '1rem', fontSize: '0.875rem', color: '#666' }, children: ["Showing ", paginatedSources.length, " of ", sorted.length, " sources", search && ` (filtered by "${search}")`, filterType && ` (type: ${filterType})`] }), _jsx("div", { style: { overflowX: 'auto' }, children: _jsxs("table", { style: { width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }, children: [_jsx("thead", { children: _jsxs("tr", { style: { backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }, children: [_jsx("th", { style: { padding: '0.75rem', textAlign: 'left', minWidth: '150px' }, children: "Name" }), _jsx("th", { style: { padding: '0.75rem', textAlign: 'left', minWidth: '100px' }, children: "Type" }), _jsx("th", { style: { padding: '0.75rem', textAlign: 'center', minWidth: '80px' }, children: "Trust" }), _jsx("th", { style: { padding: '0.75rem', textAlign: 'left', minWidth: '100px' }, children: "Country" }), _jsx("th", { style: { padding: '0.75rem', textAlign: 'center', minWidth: '80px' }, children: "Health" }), _jsx("th", { style: { padding: '0.75rem', textAlign: 'center', minWidth: '80px' }, children: "Status" }), _jsx("th", { style: { padding: '0.75rem', textAlign: 'center', minWidth: '120px' }, children: "Actions" })] }) }), _jsx("tbody", { children: paginatedSources.map(source => {
                                const testResult = testResults.get(source.id);
                                const isTesting = testing.has(source.id);
                                const trustScore = source.trust_score || 0.5;
                                return (_jsxs("tr", { style: { borderBottom: '1px solid #e5e7eb', backgroundColor: !source.enabled ? '#fafafa' : '#fff' }, children: [_jsx("td", { style: { padding: '0.75rem', fontWeight: 'bold', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }, children: source.name }), _jsx("td", { style: { padding: '0.75rem' }, children: _jsx("span", { style: {
                                                    padding: '2px 8px',
                                                    backgroundColor: '#e8f4f8',
                                                    color: '#0066cc',
                                                    borderRadius: '3px',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 'bold'
                                                }, children: source.type || 'generic-rss' }) }), _jsx("td", { style: { padding: '0.75rem', textAlign: 'center' }, children: _jsx("span", { style: {
                                                    padding: '2px 6px',
                                                    backgroundColor: getTrustScoreColor(trustScore),
                                                    borderRadius: '3px',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 'bold'
                                                }, children: trustScore.toFixed(2) }) }), _jsx("td", { style: { padding: '0.75rem' }, children: source.country || '-' }), _jsx("td", { style: { padding: '0.75rem', textAlign: 'center', fontSize: '1.2rem' }, children: getHealthStatusEmoji(source.health_status) }), _jsxs("td", { style: { padding: '0.75rem', textAlign: 'center' }, children: [_jsx("span", { style: {
                                                        padding: '0.25rem 0.5rem',
                                                        borderRadius: '0.25rem',
                                                        fontSize: '0.7rem',
                                                        fontWeight: 'bold',
                                                        backgroundColor: source.enabled ? '#dcfce7' : '#fee2e2',
                                                        color: source.enabled ? '#166534' : '#991b1b'
                                                    }, children: source.enabled ? '✓ ON' : '✗ OFF' }), testResult && (_jsx("div", { style: { marginTop: '0.25rem', fontSize: '0.7rem' }, children: testResult.ok ? (_jsx("span", { style: { color: '#16a34a' }, children: "\u2713 OK" })) : (_jsx("span", { style: { color: '#dc2626' }, children: "\u2717 FAIL" })) }))] }), _jsxs("td", { style: { padding: '0.75rem', textAlign: 'center' }, children: [_jsx("button", { onClick: () => handleToggleEnabled(source.id, source.enabled), style: {
                                                        padding: '0.25rem 0.5rem',
                                                        marginRight: '0.25rem',
                                                        fontSize: '0.7rem',
                                                        borderRadius: '3px',
                                                        border: '1px solid #d1d5db',
                                                        backgroundColor: '#fff',
                                                        cursor: 'pointer'
                                                    }, title: source.enabled ? 'Disable source' : 'Enable source', children: source.enabled ? 'Disable' : 'Enable' }), _jsx("button", { onClick: () => handleTestSource(source.id, source.url), disabled: isTesting, style: {
                                                        padding: '0.25rem 0.5rem',
                                                        fontSize: '0.7rem',
                                                        borderRadius: '3px',
                                                        border: '1px solid #d1d5db',
                                                        backgroundColor: isTesting ? '#e5e7eb' : '#fff',
                                                        cursor: isTesting ? 'not-allowed' : 'pointer'
                                                    }, title: "Test source URL (HEAD request)", children: isTesting ? '...' : 'Test' })] })] }, source.id));
                            }) })] }) }), totalPages > 1 && (_jsxs("div", { style: { marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center' }, children: [_jsx("button", { onClick: () => setCurrentPage(p => Math.max(1, p - 1)), disabled: currentPage === 1, style: {
                            padding: '0.5rem 1rem',
                            borderRadius: '0.25rem',
                            border: '1px solid #d1d5db',
                            backgroundColor: currentPage === 1 ? '#e5e7eb' : '#fff',
                            cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                        }, children: "\u2190 Previous" }), _jsxs("span", { style: { padding: '0.5rem 1rem' }, children: ["Page ", currentPage, " of ", totalPages] }), _jsx("button", { onClick: () => setCurrentPage(p => Math.min(totalPages, p + 1)), disabled: currentPage === totalPages, style: {
                            padding: '0.5rem 1rem',
                            borderRadius: '0.25rem',
                            border: '1px solid #d1d5db',
                            backgroundColor: currentPage === totalPages ? '#e5e7eb' : '#fff',
                            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                        }, children: "Next \u2192" })] }))] }));
}
