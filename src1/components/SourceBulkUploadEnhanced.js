import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { parseExcelToSources } from '../lib/excelParser';
import { bulkUploadSources } from '../lib/utils/api';
export function SourceBulkUpload({ onUploadComplete, accessToken }) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [preview, setPreview] = useState([]);
    const [success, setSuccess] = useState(null);
    const [totalParsedCount, setTotalParsedCount] = useState(0);
    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        console.log('File selected:', file.name, file.type, file.size);
        setError(null);
        setSuccess(null);
        setPreview([]);
        try {
            console.log('Starting to parse Excel file...');
            const sources = await parseExcelToSources(file);
            console.log('Parsed sources:', sources);
            if (sources.length === 0) {
                setError('No sources found in the Excel file. Make sure it has columns: name, url, country, type, query, trust_score, enabled');
                return;
            }
            setTotalParsedCount(sources.length);
            setPreview(sources.slice(0, 5));
            console.log(`Successfully parsed ${sources.length} sources from Excel`);
        }
        catch (err) {
            console.error('Parse error:', err);
            setError(`Failed to parse Excel file: ${err.message}`);
        }
    };
    const handleUpload = async () => {
        console.log('=== STARTING UPLOAD ===');
        if (preview.length === 0) {
            setError('No sources to upload');
            return;
        }
        setUploading(true);
        setError(null);
        setSuccess(null);
        try {
            const fileInput = document.getElementById('excel-upload');
            const file = fileInput?.files?.[0];
            if (!file) {
                throw new Error('File not found');
            }
            console.log('Re-parsing file for upload...');
            const sources = await parseExcelToSources(file);
            console.log('Uploading', sources.length, 'sources to backend...');
            console.log('Sources data:', JSON.stringify(sources, null, 2));
            const result = await bulkUploadSources(sources, accessToken);
            console.log('Upload result:', result);
            if (result.ok) {
                const parts = [];
                if (typeof result.inserted === 'number')
                    parts.push(`${result.inserted} inserted`);
                if (typeof result.updated === 'number')
                    parts.push(`${result.updated} updated`);
                if (Array.isArray(result.rejected) && result.rejected.length > 0)
                    parts.push(`${result.rejected.length} rejected`);
                const message = parts.length ? `Bulk upload complete: ${parts.join(' · ')}` : `Successfully uploaded ${result.count} sources!`;
                setSuccess(message);
                setPreview([]);
                setTotalParsedCount(0);
                fileInput.value = '';
                console.log('Upload successful!');
                onUploadComplete?.(result.count ?? (result.inserted ?? 0) + (result.updated ?? 0));
                if (Array.isArray(result.rejected) && result.rejected.length > 0) {
                    const sample = result.rejected.slice(0, 10).map((r) => `- ${r.name} (${r.url}) — ${r.reason || 'rejected'}`).join('\n');
                    console.warn('Some sources were rejected due to reachability issues:', result.rejected);
                    setError(`Rejected ${result.rejected.length} source(s) due to reachability issues.\n\nExamples:\n${sample}`);
                }
            }
            else {
                throw new Error(result.error || 'Upload failed - no error message');
            }
        }
        catch (err) {
            console.error('Upload error:', err);
            setError(`Upload failed: ${err.message}`);
        }
        finally {
            setUploading(false);
            console.log('=== UPLOAD COMPLETE ===');
        }
    };
    return (_jsxs("div", { style: { padding: '1rem', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '1rem', backgroundColor: '#f9f9f9' }, children: [_jsx("h3", { style: { marginTop: 0 }, children: "\uD83D\uDCE4 Bulk Upload Sources (Excel)" }), _jsxs("div", { style: { marginBottom: '1rem' }, children: [_jsx("input", { id: "excel-upload", type: "file", accept: ".xlsx,.xls", onChange: handleFileChange, disabled: uploading, style: { marginBottom: '0.5rem', padding: '0.5rem' } }), _jsxs("p", { style: { fontSize: '0.875rem', color: '#666', margin: '0.5rem 0' }, children: ["Upload an Excel file with columns: ", _jsx("strong", { children: "name" }), ", ", _jsx("strong", { children: "url" }), ", ", _jsx("strong", { children: "type" }), ", ", _jsx("strong", { children: "country" }), ", ", _jsx("strong", { children: "query" }), ", ", _jsx("strong", { children: "trust_score" }), ", ", _jsx("strong", { children: "enabled" })] }), _jsxs("details", { style: { fontSize: '0.875rem', color: '#666', margin: '0.5rem 0', cursor: 'pointer' }, children: [_jsx("summary", { style: { fontWeight: 'bold', marginBottom: '0.5rem' }, children: "\uD83D\uDCCB Column Guide & Examples" }), _jsx("div", { style: { marginTop: '0.5rem', paddingLeft: '1rem', backgroundColor: '#fff', borderRadius: '4px', padding: '0.75rem' }, children: _jsxs("ul", { style: { margin: '0.5rem 0' }, children: [_jsxs("li", { children: [_jsx("strong", { children: "name:" }), " Source name (required) - e.g., \"USGS Earthquakes\""] }), _jsxs("li", { children: [_jsx("strong", { children: "url:" }), " Source URL (required) - e.g., \"https://earthquake.usgs.gov/earthquakes/feed/v1.0/atom.xml\""] }), _jsxs("li", { children: [_jsx("strong", { children: "type:" }), " Parser type - Options: usgs-atom, nws-cap, news-rss, gdacs-rss, reliefweb-rss, travel-advisory-rss, faa-json, generic-rss (default: generic-rss)"] }), _jsxs("li", { children: [_jsx("strong", { children: "country:" }), " Country code (e.g., \"US\", \"AU\", \"Global\") - optional"] }), _jsxs("li", { children: [_jsx("strong", { children: "query:" }), " For dynamic sources, e.g., \"hurricane OR storm\" - optional"] }), _jsxs("li", { children: [_jsx("strong", { children: "trust_score:" }), " 0.0-1.0 scale:", _jsxs("ul", { style: { marginTop: '0.3rem' }, children: [_jsx("li", { children: "0.95 = USGS Earthquake (official US gov)" }), _jsx("li", { children: "0.90 = NWS, NOAA, FAA (official US gov)" }), _jsx("li", { children: "0.80 = Reuters, BBC, Guardian (major news)" }), _jsx("li", { children: "0.75 = Travel advisories (official)" }), _jsx("li", { children: "0.60 = Travel blogs, local news" }), _jsx("li", { children: "0.50 = Unknown/unverified (default)" })] })] }), _jsxs("li", { children: [_jsx("strong", { children: "enabled:" }), " TRUE/FALSE or 1/0 (default: TRUE)"] })] }) })] })] }), preview.length > 0 && (_jsxs("div", { style: { marginBottom: '1rem', padding: '1rem', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #e0e0e0' }, children: [_jsxs("h4", { style: { marginTop: 0 }, children: ["\u2713 Preview (", preview.length, " of ", totalParsedCount, " sources shown):"] }), _jsx("div", { style: { fontSize: '0.8rem', maxHeight: '320px', overflow: 'auto', margin: '0.5rem 0', backgroundColor: '#fafafa', borderRadius: '4px', padding: '0.5rem' }, children: _jsxs("table", { style: { width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }, children: [_jsx("thead", { children: _jsxs("tr", { style: { borderBottom: '2px solid #ddd', backgroundColor: '#f0f0f0' }, children: [_jsx("th", { style: { textAlign: 'left', padding: '6px', fontWeight: 'bold' }, children: "Name" }), _jsx("th", { style: { textAlign: 'left', padding: '6px', fontWeight: 'bold' }, children: "Type" }), _jsx("th", { style: { textAlign: 'center', padding: '6px', fontWeight: 'bold' }, children: "Trust" }), _jsx("th", { style: { textAlign: 'center', padding: '6px', fontWeight: 'bold' }, children: "Status" }), _jsx("th", { style: { textAlign: 'left', padding: '6px', fontWeight: 'bold' }, children: "URL" })] }) }), _jsx("tbody", { children: preview.map((source, idx) => {
                                        const trustScore = source.trust_score || 0.5;
                                        const trustColor = trustScore >= 0.75 ? '#d4edda' : trustScore >= 0.5 ? '#fff3cd' : '#f8d7da';
                                        const statusColor = source.enabled !== false ? '#28a745' : '#dc3545';
                                        return (_jsxs("tr", { style: { borderBottom: '1px solid #e5e5e5' }, children: [_jsx("td", { style: { padding: '6px', fontWeight: 'bold', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }, children: source.name }), _jsx("td", { style: { padding: '6px' }, children: _jsx("span", { style: { backgroundColor: '#e8f4f8', color: '#0066cc', padding: '3px 8px', borderRadius: '3px', fontSize: '0.75rem', fontWeight: 'bold' }, children: source.type || 'generic-rss' }) }), _jsx("td", { style: { padding: '6px', textAlign: 'center' }, children: _jsx("span", { style: { backgroundColor: trustColor, padding: '2px 6px', borderRadius: '3px', fontSize: '0.75rem', fontWeight: 'bold' }, children: trustScore.toFixed(2) }) }), _jsx("td", { style: { padding: '6px', textAlign: 'center' }, children: _jsx("span", { style: { color: statusColor, fontWeight: 'bold', fontSize: '1rem' }, children: source.enabled !== false ? '✓' : '✗' }) }), _jsx("td", { style: { padding: '6px', fontSize: '0.7rem', color: '#666', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: source.url })] }, idx));
                                    }) })] }) }), _jsxs("div", { style: { marginTop: '0.75rem', padding: '0.75rem', backgroundColor: '#f0f8ff', borderRadius: '4px', fontSize: '0.875rem', color: '#004085' }, children: ["\uD83D\uDCCA Summary: ", totalParsedCount, " total sources (", preview.filter(s => s.enabled !== false).length, " enabled, ", preview.filter(s => s.enabled === false).length, " disabled)"] }), _jsx("button", { onClick: handleUpload, disabled: uploading, style: {
                            marginTop: '0.75rem',
                            padding: '0.75rem 1.5rem',
                            backgroundColor: uploading ? '#ccc' : '#4CAF50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: uploading ? 'not-allowed' : 'pointer',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                        }, children: uploading ? 'Uploading...' : `✓ Upload ${totalParsedCount} Sources` })] })), success && (_jsxs("div", { style: {
                    padding: '0.75rem',
                    backgroundColor: '#d4edda',
                    color: '#155724',
                    borderRadius: '4px',
                    marginTop: '1rem',
                    border: '1px solid #c3e6cb'
                }, children: ["\u2713 ", success] })), error && (_jsxs("div", { style: {
                    padding: '0.75rem',
                    backgroundColor: '#f8d7da',
                    color: '#721c24',
                    borderRadius: '4px',
                    marginTop: '1rem',
                    border: '1px solid #f5c6cb',
                    whiteSpace: 'pre-wrap',
                    fontSize: '0.875rem'
                }, children: ["\u26A0\uFE0F ", error] }))] }));
}
