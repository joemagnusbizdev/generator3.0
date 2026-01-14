import React, { useState } from 'react';
import { parseExcelToSources } from '../lib/excelParser';
import { bulkUploadSources } from '../lib/utils/api';

interface SourceBulkUploadProps {
  onUploadComplete?: (count: number) => void;
}

export function SourceBulkUpload({ onUploadComplete }: SourceBulkUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<any[]>([]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setPreview([]);

    try {
      const sources = await parseExcelToSources(file);
      
      if (sources.length === 0) {
        setError('No sources found in the Excel file');
        return;
      }

      setPreview(sources.slice(0, 5));
      console.log(`Parsed ${sources.length} sources from Excel`);
    } catch (err: any) {
      setError(`Failed to parse Excel file: ${err.message}`);
      console.error('Parse error:', err);
    }
  };

  const handleUpload = async () => {
    if (preview.length === 0) {
      setError('No sources to upload');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const fileInput = document.getElementById('excel-upload') as HTMLInputElement;
      const file = fileInput?.files?.[0];
      
      if (!file) {
        throw new Error('File not found');
      }

      const sources = await parseExcelToSources(file);
      
      console.log('Uploading sources:', sources);
      
      const result = await bulkUploadSources(sources);
      
      console.log('Upload result:', result);
      
      if (result.ok) {
        alert(`Successfully uploaded ${result.count} sources!`);
        setPreview([]);
        fileInput.value = '';
        onUploadComplete?.(result.count);
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (err: any) {
      setError(`Upload failed: ${err.message}`);
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '1rem' }}>
      <h3>Bulk Upload Sources (Excel)</h3>
      
      <div style={{ marginBottom: '1rem' }}>
        <input
          id="excel-upload"
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          disabled={uploading}
          style={{ marginBottom: '0.5rem' }}
        />
        <p style={{ fontSize: '0.875rem', color: '#666' }}>
          Upload an Excel file with columns: name, url, country (optional)
        </p>
      </div>

      {preview.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <h4>Preview (first 5 sources):</h4>
          <ul style={{ fontSize: '0.875rem', maxHeight: '200px', overflow: 'auto' }}>
            {preview.map((source, idx) => (
              <li key={idx}>
                <strong>{source.name}</strong> - {source.url}
                {source.country && ` (${source.country})`}
              </li>
            ))}
          </ul>
          <button
            onClick={handleUpload}
            disabled={uploading}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: uploading ? '#ccc' : '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: uploading ? 'not-allowed' : 'pointer',
            }}
          >
            {uploading ? 'Uploading...' : 'Upload All Sources'}
          </button>
        </div>
      )}

      {error && (
        <div style={{ 
          padding: '0.75rem', 
          backgroundColor: '#fee', 
          color: '#c00', 
          borderRadius: '4px',
          marginTop: '1rem'
        }}>
          {error}
        </div>
      )}
    </div>
  );
}