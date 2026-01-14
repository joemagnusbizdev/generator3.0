/**
 * SourceManagerInline - Source management component with bulk upload
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetchJson, apiPostJson, apiPatchJson } from '../lib/utils/api';
import { useScour } from './ScourContext';
import { colors, styles, combine } from '../styles/inline';
import { buttons, cards, forms, typography } from '../styles/designSystem';
import { SourceBulkUpload } from './SourceBulkUpload';


// ============================================================================
// Types
// ============================================================================

interface Source {
  id: string;
  name?: string;
  url?: string;
  enabled?: boolean;
  created_at?: string;
  last_scoured_at?: string;
  category?: string;
  query?: string;
}

interface SourceStats {
  total: number;
  enabled: number;
  disabled: number;
  recentlyScoured: number;
  sources?: Source[];
}

interface BulkUploadRow {
  name: string;
  url: string;
  category?: string;
  query?: string;
}

interface SourceManagerInlineProps {
  accessToken?: string;
  permissions: {
    canManageSources?: boolean;
    canScour?: boolean;
  };
}

// ============================================================================
// Excel Parser Helper (simplified)
// ============================================================================

async function parseExcelFile(file: File): Promise<BulkUploadRow[]> {
  // For CSV files, parse directly
  if (file.name.endsWith('.csv')) {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const row: BulkUploadRow = {
        name: values[headers.indexOf('name')] || '',
        url: values[headers.indexOf('url')] || '',
        category: values[headers.indexOf('category')] || undefined,
        query: values[headers.indexOf('query')] || undefined,
      };
      return row;
    }).filter(row => row.name && row.url);
  }

  // For Excel files, we'd need a library like xlsx
  // For now, return empty and show a message
  throw new Error('Excel parsing requires the xlsx library. Please use CSV format.');
}

// ============================================================================
// Component
// ============================================================================

export function SourceManagerInline({
  accessToken,
  permissions,
}: SourceManagerInlineProps): JSX.Element | null {
  const [sources, setSources] = useState<Source[]>([]);
  const [stats, setStats] = useState<SourceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Bulk upload state
  const [uploadPreview, setUploadPreview] = useState<BulkUploadRow[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { startScour } = useScour();

  // Permission check
  if (!permissions.canManageSources) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: colors.gray500 }}>
        You don't have permission to manage sources.
      </div>
    );
  }

  // Fetch sources
  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);

    try {
      const data = await apiFetchJson<SourceStats>('/sources/stats', accessToken);
      setStats(data);
      setSources(data.sources ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load sources';
      setErr(message);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Toggle source enabled
  const toggleEnabled = useCallback(async (id: string, enabled: boolean) => {
    setBusyIds(prev => new Set(prev).add(id));

    try {
      await apiPatchJson(`/sources/${id}`, { enabled }, accessToken);
      setSources(prev => prev.map(s => s.id === id ? { ...s, enabled } : s));
    } catch (error) {
      console.error('Failed to toggle source:', error);
    } finally {
      setBusyIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [accessToken]);

  // Delete source
  const deleteSource = useCallback(async (id: string) => {
    if (!confirm('Delete this source?')) return;

    setBusyIds(prev => new Set(prev).add(id));

    try {
      await apiFetchJson(`/sources/${id}`, accessToken, { method: 'DELETE' });
      setSources(prev => prev.filter(s => s.id !== id));
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (error) {
      console.error('Failed to delete source:', error);
    } finally {
      setBusyIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [accessToken]);

// Inside your component:// Bulk delete
  const bulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} sources?`)) return;

    setLoading(true);

    try {
      await apiPostJson('/sources/bulk-delete', { ids: Array.from(selectedIds) }, accessToken);
      setSources(prev => prev.filter(s => !selectedIds.has(s.id)));
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Failed to bulk delete:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedIds, accessToken]);

  // Scour single source
  const scourSource = useCallback(async (id: string) => {
    if (!permissions.canScour) return;
    
    setBusyIds(prev => new Set(prev).add(id));

    try {
      await startScour({ sourceIds: [id] });
    } catch (error) {
      console.error('Failed to scour source:', error);
    } finally {
      setBusyIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [accessToken, permissions.canScour, startScour]);

  // Handle file selection for bulk upload
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const rows = await parseExcelFile(file);
      setUploadPreview(rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to parse file';
      setErr(message);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Confirm bulk upload
  const confirmBulkUpload = useCallback(async () => {
    if (!uploadPreview || uploadPreview.length === 0) return;

    setUploading(true);
    setErr(null);

    try {
      await apiPostJson('/sources/bulk', { sources: uploadPreview }, accessToken);
      setUploadPreview(null);
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload sources';
      setErr(message);
    } finally {
      setUploading(false);
    }
  }, [uploadPreview, accessToken, refresh]);

  // Toggle selection
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Select all
  const selectAll = useCallback(() => {
    if (selectedIds.size === sources.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sources.map(s => s.id)));
    }
  }, [sources, selectedIds.size]);

  // Styles
  const containerStyle: React.CSSProperties = {
    padding: '1rem',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
    flexWrap: 'wrap',
    gap: '1rem',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '1.5rem',
    fontWeight: 600,
    color: colors.magnusDarkGreen,
    margin: 0,
  };

  const actionsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.875rem',
  };

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '0.75rem',
    borderBottom: `2px solid ${colors.gray200}`,
    color: colors.gray600,
    fontWeight: 600,
    textTransform: 'uppercase',
    fontSize: '0.75rem',
  };

  const tdStyle: React.CSSProperties = {
    padding: '0.75rem',
    borderBottom: `1px solid ${colors.gray200}`,
    verticalAlign: 'middle',
  };

  const errorStyle: React.CSSProperties = {
    padding: '1rem',
    backgroundColor: colors.red50,
    border: `1px solid ${colors.red200}`,
    borderRadius: '8px',
    color: colors.red700,
    marginBottom: '1rem',
  };

  const previewStyle: React.CSSProperties = {
    ...cards.base,
    padding: '1rem',
    marginBottom: '1rem',
    backgroundColor: colors.blue50,
    border: `1px solid ${colors.blue200}`,
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>Source Manager</h2>
          {stats && (
            <p style={{ margin: '0.5rem 0 0', color: colors.gray600, fontSize: '0.875rem' }}>
              {stats.enabled} enabled / {stats.total} total sources
            </p>
          )}
        </div>

        <div style={actionsStyle}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".csv,.xlsx,.xls"
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={buttons.secondary}
          >
            ðŸ“¤ Bulk Upload
          </button>
          
          {selectedIds.size > 0 && (
            <button
              onClick={bulkDelete}
              disabled={loading}
              style={buttons.danger}
            >
              ðŸ—‘ï¸ Delete ({selectedIds.size})
            </button>
          )}
          
          <button
            onClick={refresh}
            disabled={loading}
            style={buttons.secondary}
          >
            {loading ? 'Loading...' : 'ðŸ”„ Refresh'}
          </button>
        </div>
      </div>

      {err && (
        <div style={errorStyle}>
          <strong>Error:</strong> {err}
        </div>
      )}

      {/* Bulk Upload Preview */}
      {uploadPreview && (
        <div style={previewStyle}>
          <h3 style={{ margin: '0 0 1rem', color: colors.blue700 }}>
            Preview: {uploadPreview.length} sources to upload
          </h3>
          <div style={{ maxHeight: '200px', overflow: 'auto', marginBottom: '1rem' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>URL</th>
                  <th style={thStyle}>Category</th>
                </tr>
              </thead>
              <tbody>
                {uploadPreview.slice(0, 10).map((row, i) => (
                  <tr key={i}>
                    <td style={tdStyle}>{row.name}</td>
                    <td style={tdStyle}>{row.url}</td>
                    <td style={tdStyle}>{row.category || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {uploadPreview.length > 10 && (
              <p style={{ textAlign: 'center', color: colors.gray500, margin: '0.5rem 0' }}>
                ...and {uploadPreview.length - 10} more
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={confirmBulkUpload}
              disabled={uploading}
              style={buttons.primary}
            >
              {uploading ? 'Uploading...' : 'Confirm Upload'}
            </button>
            <button
              onClick={() => setUploadPreview(null)}
              style={buttons.secondary}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Sources Table */}
      {loading && sources.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: colors.gray500 }}>
          Loading sources...
        </div>
      ) : sources.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: colors.gray500 }}>
          No sources configured. Use bulk upload to add sources.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>
                  <input
                    type="checkbox"
                    checked={selectedIds.size === sources.length && sources.length > 0}
                    onChange={selectAll}
                  />
                </th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>URL</th>
                <th style={thStyle}>Category</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Last Scoured</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sources.map(source => {
                const isBusy = busyIds.has(source.id);
                const isSelected = selectedIds.has(source.id);

                return (
                  <tr 
                    key={source.id}
                    style={{ 
                      backgroundColor: isSelected ? colors.blue50 : 'transparent',
                      opacity: isBusy ? 0.6 : 1,
                    }}
                  >
                    <td style={tdStyle}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(source.id)}
                      />
                    </td>
                    <td style={tdStyle}>
                      <strong>{source.name || 'Unnamed'}</strong>
                    </td>
                    <td style={{ ...tdStyle, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <a 
                        href={source.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ color: colors.magnusDarkGreen }}
                      >
                        {source.url}
                      </a>
                    </td>
                    <td style={tdStyle}>{source.category || '-'}</td>
                    <td style={tdStyle}>
                      <button
                        onClick={() => toggleEnabled(source.id, !source.enabled)}
                        disabled={isBusy}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: 'none',
                          cursor: isBusy ? 'not-allowed' : 'pointer',
                          backgroundColor: source.enabled ? colors.success + '20' : colors.gray200,
                          color: source.enabled ? colors.success : colors.gray600,
                          fontSize: '0.75rem',
                          fontWeight: 500,
                        }}
                      >
                        {source.enabled ? 'âœ“ Enabled' : 'Disabled'}
                      </button>
                    </td>
                    <td style={tdStyle}>
                      {source.last_scoured_at 
                        ? new Date(source.last_scoured_at).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        {permissions.canScour && (
                          <button
                            onClick={() => scourSource(source.id)}
                            disabled={isBusy}
                            title="Scour this source"
                            style={{
                              ...buttons.icon,
                              padding: '4px 8px',
                              fontSize: '0.875rem',
                            }}
                          >
                            ðŸ”
                          </button>
                        )}
                        <button
                          onClick={() => deleteSource(source.id)}
                          disabled={isBusy}
                          title="Delete source"
                          style={{
                            ...buttons.icon,
                            padding: '4px 8px',
                            fontSize: '0.875rem',
                            color: colors.red600,
                          }}
                        >
                          ðŸ—‘ï¸
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default SourceManagerInline;
