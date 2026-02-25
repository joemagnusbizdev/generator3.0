import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { parseExcelToSources } from '../lib/excelParser';
import { bulkUploadSources } from '../lib/utils/api';
export function SourceBulkUpload({ onUploadComplete, accessToken }) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [preview, setPreview] = useState([]);
    const [success, setSuccess] = useState(null);
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
                setError('No sources found in the Excel file. Make sure it has columns: name, url, country');
                return;
            }
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
    return (_jsxs("div", { style: { padding: '1rem', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '1rem', backgroundColor: '#f9f9f9' }, children: [_jsx("h3", { style: { marginTop: 0 }, children: "Bulk Upload Sources (Excel)" }), _jsxs("div", { style: { marginBottom: '1rem' }, children: [_jsx("input", { id: "excel-upload", type: "file", accept: ".xlsx,.xls", onChange: handleFileChange, disabled: uploading, style: { marginBottom: '0.5rem', padding: '0.5rem' } }), _jsxs("p", { style: { fontSize: '0.875rem', color: '#666', margin: '0.5rem 0' }, children: ["Upload an Excel file with columns: ", _jsx("strong", { children: "name" }), ", ", _jsx("strong", { children: "url" }), ", ", _jsx("strong", { children: "country" }), " (optional)"] })] }), preview.length > 0 && (_jsxs("div", { style: { marginBottom: '1rem', padding: '1rem', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #e0e0e0' }, children: [_jsxs("h4", { style: { marginTop: 0 }, children: ["Preview (", preview.length, " of ", preview.length, " sources shown):"] }), _jsx("ul", { style: { fontSize: '0.875rem', maxHeight: '200px', overflow: 'auto', margin: '0.5rem 0' }, children: preview.map((source, idx) => (_jsxs("li", { style: { marginBottom: '0.5rem' }, children: [_jsx("strong", { children: source.name }), " - ", _jsx("code", { style: { fontSize: '0.8rem', backgroundColor: '#f0f0f0', padding: '2px 4px' }, children: source.url }), source.country && ` (${source.country})`] }, idx))) }), _jsx("button", { onClick: handleUpload, disabled: uploading, style: {
                            padding: '0.75rem 1.5rem',
                            backgroundColor: uploading ? '#ccc' : '#4CAF50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: uploading ? 'not-allowed' : 'pointer',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                        }, children: uploading ? 'Uploading...' : `Upload ${preview.length} Sources` })] })), success && (_jsx("div", { style: {
                    padding: '0.75rem',
                    backgroundColor: '#d4edda',
                    color: '#155724',
                    borderRadius: '4px',
                    marginTop: '1rem',
                    border: '1px solid #c3e6cb'
                }, children: success })), error && (_jsx("div", { style: {
                    padding: '0.75rem',
                    backgroundColor: '#f8d7da',
                    color: '#721c24',
                    borderRadius: '4px',
                    marginTop: '1rem',
                    border: '1px solid #f5c6cb'
                }, children: error }))] }));
}
