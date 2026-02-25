import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { apiPatchJson } from '../lib/utils/api';
export function SourceTable({ sources, onSourceUpdated, accessToken }) {
    const [testing, setTesting] = useState(new Set());
    const [testResults, setTestResults] = useState(new Map());
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;
    const totalPages = Math.ceil(sources.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedSources = sources.slice(startIndex, startIndex + itemsPerPage);
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
    return (_jsxs("div", { children: [_jsxs("table", { style: { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }, children: [_jsx("thead", { children: _jsxs("tr", { style: { backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }, children: [_jsx("th", { style: { padding: '0.75rem', textAlign: 'left' }, children: "Name" }), _jsx("th", { style: { padding: '0.75rem', textAlign: 'left' }, children: "URL" }), _jsx("th", { style: { padding: '0.75rem', textAlign: 'left' }, children: "Country" }), _jsx("th", { style: { padding: '0.75rem', textAlign: 'center' }, children: "Status" }), _jsx("th", { style: { padding: '0.75rem', textAlign: 'center' }, children: "Actions" })] }) }), _jsx("tbody", { children: paginatedSources.map(source => {
                            const testResult = testResults.get(source.id);
                            const isTesting = testing.has(source.id);
                            return (_jsxs("tr", { style: { borderBottom: '1px solid #e5e7eb' }, children: [_jsx("td", { style: { padding: '0.75rem' }, children: source.name }), _jsx("td", { style: { padding: '0.75rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }, children: _jsx("a", { href: source.url, target: "_blank", rel: "noopener noreferrer", style: { color: '#3b82f6' }, children: source.url }) }), _jsx("td", { style: { padding: '0.75rem' }, children: source.country || '-' }), _jsxs("td", { style: { padding: '0.75rem', textAlign: 'center' }, children: [_jsx("span", { style: {
                                                    padding: '0.25rem 0.5rem',
                                                    borderRadius: '0.25rem',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 'bold',
                                                    backgroundColor: source.enabled ? '#dcfce7' : '#fee2e2',
                                                    color: source.enabled ? '#166534' : '#991b1b'
                                                }, children: source.enabled ? 'ENABLED' : 'DISABLED' }), testResult && (_jsx("div", { style: { marginTop: '0.25rem', fontSize: '0.75rem' }, children: testResult.ok ? (_jsxs("span", { style: { color: '#16a34a' }, children: [" OK ", testResult.status ? `(${testResult.status})` : ''] })) : (_jsx("span", { style: { color: '#dc2626' }, children: " UNREACHABLE" })) }))] }), _jsxs("td", { style: { padding: '0.75rem', textAlign: 'center' }, children: [_jsx("button", { onClick: () => handleToggleEnabled(source.id, source.enabled), style: {
                                                    padding: '0.25rem 0.75rem',
                                                    marginRight: '0.5rem',
                                                    fontSize: '0.75rem',
                                                    borderRadius: '0.25rem',
                                                    border: '1px solid #d1d5db',
                                                    backgroundColor: '#fff',
                                                    cursor: 'pointer'
                                                }, children: source.enabled ? 'Disable' : 'Enable' }), _jsx("button", { onClick: () => handleTestSource(source.id, source.url), disabled: isTesting, style: {
                                                    padding: '0.25rem 0.75rem',
                                                    fontSize: '0.75rem',
                                                    borderRadius: '0.25rem',
                                                    border: '1px solid #d1d5db',
                                                    backgroundColor: isTesting ? '#e5e7eb' : '#fff',
                                                    cursor: isTesting ? 'not-allowed' : 'pointer'
                                                }, children: isTesting ? 'Testing...' : 'Test' })] })] }, source.id));
                        }) })] }), totalPages > 1 && (_jsxs("div", { style: { marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }, children: [_jsx("button", { onClick: () => setCurrentPage(p => Math.max(1, p - 1)), disabled: currentPage === 1, style: {
                            padding: '0.5rem 1rem',
                            borderRadius: '0.25rem',
                            border: '1px solid #d1d5db',
                            backgroundColor: currentPage === 1 ? '#e5e7eb' : '#fff',
                            cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                        }, children: "Previous" }), _jsxs("span", { style: { padding: '0.5rem 1rem' }, children: ["Page ", currentPage, " of ", totalPages] }), _jsx("button", { onClick: () => setCurrentPage(p => Math.min(totalPages, p + 1)), disabled: currentPage === totalPages, style: {
                            padding: '0.5rem 1rem',
                            borderRadius: '0.25rem',
                            border: '1px solid #d1d5db',
                            backgroundColor: currentPage === totalPages ? '#e5e7eb' : '#fff',
                            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                        }, children: "Next" })] }))] }));
}
