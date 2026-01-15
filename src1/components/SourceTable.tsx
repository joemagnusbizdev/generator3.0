import React, { useState } from 'react';
import { apiPatchJson } from '../lib/utils/api';

export interface Source {
  id: string;
  name: string;
  url: string;
  country?: string;
  enabled: boolean;
  created_at: string;
}

interface SourceTableProps {
  sources: Source[];
  onSourceUpdated: () => void;
  accessToken?: string;
}

export function SourceTable({ sources, onSourceUpdated, accessToken }: SourceTableProps) {
  const [testing, setTesting] = useState<Set<string>>(new Set());
  const [testResults, setTestResults] = useState<Map<string, { ok: boolean; status?: number }>>(new Map());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const totalPages = Math.ceil(sources.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSources = sources.slice(startIndex, startIndex + itemsPerPage);

  const handleToggleEnabled = async (sourceId: string, currentEnabled: boolean) => {
    try {
      await apiPatchJson(`/sources/${sourceId}`, { enabled: !currentEnabled }, accessToken);
      onSourceUpdated();
    } catch (error) {
      console.error('Failed to toggle source:', error);
      alert('Failed to update source status');
    }
  };

  const handleTestSource = async (sourceId: string, url: string) => {
    setTesting(prev => new Set(prev).add(sourceId));
    try {
      const response = await fetch(url, { method: 'HEAD', mode: 'no-cors' });
      setTestResults(prev => new Map(prev).set(sourceId, { ok: true, status: response.status }));
    } catch (error) {
      setTestResults(prev => new Map(prev).set(sourceId, { ok: false }));
    } finally {
      setTesting(prev => {
        const next = new Set(prev);
        next.delete(sourceId);
        return next;
      });
    }
  };

  if (sources.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
        No sources configured. Use bulk upload to add sources.
      </div>
    );
  }

  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead>
          <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Name</th>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>URL</th>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Country</th>
            <th style={{ padding: '0.75rem', textAlign: 'center' }}>Status</th>
            <th style={{ padding: '0.75rem', textAlign: 'center' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {paginatedSources.map(source => {
            const testResult = testResults.get(source.id);
            const isTesting = testing.has(source.id);
            
            return (
              <tr key={source.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '0.75rem' }}>{source.name}</td>
                <td style={{ padding: '0.75rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <a href={source.url} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>
                    {source.url}
                  </a>
                </td>
                <td style={{ padding: '0.75rem' }}>{source.country || '-'}</td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    backgroundColor: source.enabled ? '#dcfce7' : '#fee2e2',
                    color: source.enabled ? '#166534' : '#991b1b'
                  }}>
                    {source.enabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                  {testResult && (
                    <div style={{ marginTop: '0.25rem', fontSize: '0.75rem' }}>
                      {testResult.ok ? (
                        <span style={{ color: '#16a34a' }}>âœ“ OK {testResult.status ? `(${testResult.status})` : ''}</span>
                      ) : (
                        <span style={{ color: '#dc2626' }}>âœ— UNREACHABLE</span>
                      )}
                    </div>
                  )}
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                  <button
                    onClick={() => handleToggleEnabled(source.id, source.enabled)}
                    style={{
                      padding: '0.25rem 0.75rem',
                      marginRight: '0.5rem',
                      fontSize: '0.75rem',
                      borderRadius: '0.25rem',
                      border: '1px solid #d1d5db',
                      backgroundColor: '#fff',
                      cursor: 'pointer'
                    }}
                  >
                    {source.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => handleTestSource(source.id, source.url)}
                    disabled={isTesting}
                    style={{
                      padding: '0.25rem 0.75rem',
                      fontSize: '0.75rem',
                      borderRadius: '0.25rem',
                      border: '1px solid #d1d5db',
                      backgroundColor: isTesting ? '#e5e7eb' : '#fff',
                      cursor: isTesting ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isTesting ? 'Testing...' : 'Test'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.25rem',
              border: '1px solid #d1d5db',
              backgroundColor: currentPage === 1 ? '#e5e7eb' : '#fff',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
            }}
          >
            Previous
          </button>
          <span style={{ padding: '0.5rem 1rem' }}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.25rem',
              border: '1px solid #d1d5db',
              backgroundColor: currentPage === totalPages ? '#e5e7eb' : '#fff',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}