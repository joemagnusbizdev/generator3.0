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
        setError('No sources found in the Excel file. Make sure it has columns: name, url, country');
        return;
      }

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
      
      const result = await bulkUploadSources(sources, accessToken);
      
      console.log('Upload result:', result);
      
      if (result.ok) {
        const message = `Successfully uploaded ${result.count} sources!`;
        setSuccess(message);
        setPreview([]);
        fileInput.value = '';
        console.log('Upload successful!');
        onUploadComplete?.(result.count);
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
      <h3 style={{ marginTop: 0 }}>Bulk Upload Sources (Excel)</h3>
      
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
          Upload an Excel file with columns: <strong>name</strong>, <strong>url</strong>, <strong>country</strong> (optional)
        </p>
      </div>

      {preview.length > 0 && (
        <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #e0e0e0' }}>
          <h4 style={{ marginTop: 0 }}>Preview ({preview.length} of {preview.length} sources shown):</h4>
          <ul style={{ fontSize: '0.875rem', maxHeight: '200px', overflow: 'auto', margin: '0.5rem 0' }}>
            {preview.map((source, idx) => (
              <li key={idx} style={{ marginBottom: '0.5rem' }}>
                <strong>{source.name}</strong> - <code style={{ fontSize: '0.8rem', backgroundColor: '#f0f0f0', padding: '2px 4px' }}>{source.url}</code>
                {source.country && ` (${source.country})`}
              </li>
            ))}
          </ul>
          <button
            onClick={handleUpload}
            disabled={uploading}
            style={{
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
            {uploading ? 'Uploading...' : `Upload ${preview.length} Sources`}
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
          Ã¢Å“â€¦ {success}
        </div>
      )}

      {error && (
        <div style={{ 
          padding: '0.75rem', 
          backgroundColor: '#f8d7da', 
          color: '#721c24', 
          borderRadius: '4px',
          marginTop: '1rem',
          border: '1px solid #f5c6cb'
        }}>
          Ã¢ÂÅ’ {error}
        </div>
      )}
    </div>
  );
}



