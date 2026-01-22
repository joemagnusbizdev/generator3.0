import React, { useState } from 'react';
import { parseExcelToSources } from '../lib/excelParser';
import { bulkUploadSources } from '../lib/utils/api';

interface SourceBulkUploadProps {
  accessToken?: string;
  onUploadComplete?: (count: number) => void;
}

export function SourceBulkUpload({ onUploadComplete, accessToken }: SourceBulkUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  const [totalParsedCount, setTotalParsedCount] = useState(0);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
    } catch (err: any) {
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
      const fileInput = document.getElementById('excel-upload') as HTMLInputElement;
      const file = fileInput?.files?.[0];
      
      if (!file) {
        throw new Error('File not found');
      }

      console.log('Re-parsing file for upload...');
      const sources = await parseExcelToSources(file);
      
      console.log('Uploading', sources.length, 'sources to backend...');
      console.log('Sources data:', JSON.stringify(sources, null, 2));
      
      const result: any = await bulkUploadSources(sources, accessToken);
      
      console.log('Upload result:', result);
      
      if (result.ok) {
        const parts: string[] = [];
        if (typeof result.inserted === 'number') parts.push(`${result.inserted} inserted`);
        if (typeof result.updated === 'number') parts.push(`${result.updated} updated`);
        if (Array.isArray(result.rejected) && result.rejected.length > 0) parts.push(`${result.rejected.length} rejected`);
        const message = parts.length ? `Bulk upload complete: ${parts.join(' · ')}` : `Successfully uploaded ${result.count} sources!`;
        setSuccess(message);
        setPreview([]);
        setTotalParsedCount(0);
        fileInput.value = '';
        console.log('Upload successful!');
        onUploadComplete?.(result.count ?? (result.inserted ?? 0) + (result.updated ?? 0));
        
        if (Array.isArray(result.rejected) && result.rejected.length > 0) {
          const sample = result.rejected.slice(0, 10).map((r: any) => `- ${r.name} (${r.url}) — ${r.reason || 'rejected'}`).join('\n');
          console.warn('Some sources were rejected due to reachability issues:', result.rejected);
          setError(`Rejected ${result.rejected.length} source(s) due to reachability issues.\n\nExamples:\n${sample}`);
        }
      } else {
        throw new Error(result.error || 'Upload failed - no error message');
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
      console.log('=== UPLOAD COMPLETE ===');
    }
  };

  return (
    <div style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '1rem', backgroundColor: '#f9f9f9' }}>
      <h3 style={{ marginTop: 0 }}>📤 Bulk Upload Sources (Excel)</h3>
      
      <div style={{ marginBottom: '1rem' }}>
        <input
          id="excel-upload"
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          disabled={uploading}
          style={{ marginBottom: '0.5rem', padding: '0.5rem' }}
        />
        <p style={{ fontSize: '0.875rem', color: '#666', margin: '0.5rem 0' }}>
          Upload an Excel file with columns: <strong>name</strong>, <strong>url</strong>, <strong>type</strong>, <strong>country</strong>, <strong>query</strong>, <strong>trust_score</strong>, <strong>enabled</strong>
        </p>
        
        <details style={{ fontSize: '0.875rem', color: '#666', margin: '0.5rem 0', cursor: 'pointer' }}>
          <summary style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>📋 Column Guide & Examples</summary>
          <div style={{ marginTop: '0.5rem', paddingLeft: '1rem', backgroundColor: '#fff', borderRadius: '4px', padding: '0.75rem' }}>
            <ul style={{ margin: '0.5rem 0' }}>
              <li><strong>name:</strong> Source name (required) - e.g., "USGS Earthquakes"</li>
              <li><strong>url:</strong> Source URL (required) - e.g., "https://earthquake.usgs.gov/earthquakes/feed/v1.0/atom.xml"</li>
              <li><strong>type:</strong> Parser type - Options: usgs-atom, nws-cap, news-rss, gdacs-rss, reliefweb-rss, travel-advisory-rss, faa-json, generic-rss (default: generic-rss)</li>
              <li><strong>country:</strong> Country code (e.g., "US", "AU", "Global") - optional</li>
              <li><strong>query:</strong> For dynamic sources, e.g., "hurricane OR storm" - optional</li>
              <li><strong>trust_score:</strong> 0.0-1.0 scale:
                <ul style={{ marginTop: '0.3rem' }}>
                  <li>0.95 = USGS Earthquake (official US gov)</li>
                  <li>0.90 = NWS, NOAA, FAA (official US gov)</li>
                  <li>0.80 = Reuters, BBC, Guardian (major news)</li>
                  <li>0.75 = Travel advisories (official)</li>
                  <li>0.60 = Travel blogs, local news</li>
                  <li>0.50 = Unknown/unverified (default)</li>
                </ul>
              </li>
              <li><strong>enabled:</strong> TRUE/FALSE or 1/0 (default: TRUE)</li>
            </ul>
          </div>
        </details>
      </div>

      {preview.length > 0 && (
        <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #e0e0e0' }}>
          <h4 style={{ marginTop: 0 }}>
            ✓ Preview ({preview.length} of {totalParsedCount} sources shown):
          </h4>
          <div style={{ fontSize: '0.8rem', maxHeight: '320px', overflow: 'auto', margin: '0.5rem 0', backgroundColor: '#fafafa', borderRadius: '4px', padding: '0.5rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ddd', backgroundColor: '#f0f0f0' }}>
                  <th style={{ textAlign: 'left', padding: '6px', fontWeight: 'bold' }}>Name</th>
                  <th style={{ textAlign: 'left', padding: '6px', fontWeight: 'bold' }}>Type</th>
                  <th style={{ textAlign: 'center', padding: '6px', fontWeight: 'bold' }}>Trust</th>
                  <th style={{ textAlign: 'center', padding: '6px', fontWeight: 'bold' }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '6px', fontWeight: 'bold' }}>URL</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((source, idx) => {
                  const trustScore = source.trust_score || 0.5;
                  const trustColor = trustScore >= 0.75 ? '#d4edda' : trustScore >= 0.5 ? '#fff3cd' : '#f8d7da';
                  const statusColor = source.enabled !== false ? '#28a745' : '#dc3545';
                  
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #e5e5e5' }}>
                      <td style={{ padding: '6px', fontWeight: 'bold', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {source.name}
                      </td>
                      <td style={{ padding: '6px' }}>
                        <span style={{ backgroundColor: '#e8f4f8', color: '#0066cc', padding: '3px 8px', borderRadius: '3px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                          {source.type || 'generic-rss'}
                        </span>
                      </td>
                      <td style={{ padding: '6px', textAlign: 'center' }}>
                        <span style={{ backgroundColor: trustColor, padding: '2px 6px', borderRadius: '3px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                          {trustScore.toFixed(2)}
                        </span>
                      </td>
                      <td style={{ padding: '6px', textAlign: 'center' }}>
                        <span style={{ color: statusColor, fontWeight: 'bold', fontSize: '1rem' }}>
                          {source.enabled !== false ? '✓' : '✗'}
                        </span>
                      </td>
                      <td style={{ padding: '6px', fontSize: '0.7rem', color: '#666', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {source.url}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: '#f0f8ff', borderRadius: '4px', fontSize: '0.875rem', color: '#004085' }}>
            📊 Summary: {totalParsedCount} total sources ({preview.filter(s => s.enabled !== false).length} enabled, {preview.filter(s => s.enabled === false).length} disabled)
          </div>
          
          <button
            onClick={handleUpload}
            disabled={uploading}
            style={{
              marginTop: '0.75rem',
              padding: '0.75rem 1.5rem',
              backgroundColor: uploading ? '#ccc' : '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: uploading ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold',
            }}
          >
            {uploading ? 'Uploading...' : `✓ Upload ${totalParsedCount} Sources`}
          </button>
        </div>
      )}

      {success && (
        <div style={{ 
          padding: '0.75rem', 
          backgroundColor: '#d4edda', 
          color: '#155724', 
          borderRadius: '4px',
          marginTop: '1rem',
          border: '1px solid #c3e6cb'
        }}>
          ✓ {success}
        </div>
      )}

      {error && (
        <div style={{ 
          padding: '0.75rem', 
          backgroundColor: '#f8d7da', 
          color: '#721c24', 
          borderRadius: '4px',
          marginTop: '1rem',
          border: '1px solid #f5c6cb',
          whiteSpace: 'pre-wrap',
          fontSize: '0.875rem'
        }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}
