import React, { useState, useMemo } from 'react';
import { apiPatchJson } from '../lib/utils/api';

export interface Source {
  id: string;
  name: string;
  url: string;
  country?: string;
  type?: string;          // NEW
  trust_score?: number;   // NEW
  query?: string;         // NEW
  enabled: boolean;
  created_at: string;
  last_success?: string;  // NEW
  last_error?: string;    // NEW
  health_status?: 'healthy' | 'warning' | 'error' | 'unknown'; // NEW
}

interface SourceTableProps {
  sources: Source[];
  onSourceUpdated: () => void;
  accessToken?: string;
}

type SortKey = 'name' | 'trust' | 'updated' | 'type';
type FilterType = string | null;
type FilterStatus = 'enabled' | 'disabled' | 'all';

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

function getTrustScoreColor(score?: number) {
  const s = score || 0.5;
  if (s >= 0.8) return '#d4edda';  // Green
  if (s >= 0.6) return '#fff3cd';  // Yellow
  return '#f8d7da';                 // Red
}

function getHealthStatusEmoji(health?: string) {
  switch (health) {
    case 'healthy': return '✅';
    case 'warning': return '⚠️';
    case 'error': return '❌';
    default: return '❓';
  }
}

export function SourceTable({ sources, onSourceUpdated, accessToken }: SourceTableProps) {
  const [testing, setTesting] = useState<Set<string>>(new Set());
  const [testResults, setTestResults] = useState<Map<string, { ok: boolean; status?: number }>>(new Map());
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<FilterType>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [sortBy, setSortBy] = useState<SortKey>('name');
  
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
      if (filterStatus === 'enabled' && !source.enabled) return false;
      if (filterStatus === 'disabled' && source.enabled) return false;
      
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

  // Count by status
  const enabledCount = sources.filter(s => s.enabled).length;
  const disabledCount = sources.length - enabledCount;

  return (
    <div>
      {/* Controls */}
      <div style={{ marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', fontSize: '0.875rem' }}>
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.25rem' }}>🔍 Search</label>
          <input
            type="text"
            placeholder="Source name, URL, country..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '4px',
              border: '1px solid #d1d5db',
              fontSize: '0.875rem'
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.25rem' }}>📋 Type Filter</label>
          <select
            value={filterType || ''}
            onChange={(e) => {
              setFilterType(e.target.value || null);
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '4px',
              border: '1px solid #d1d5db',
              fontSize: '0.875rem'
            }}
          >
            <option value="">All Types</option>
            {SOURCE_TYPES.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.25rem' }}>📊 Status</label>
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value as FilterStatus);
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '4px',
              border: '1px solid #d1d5db',
              fontSize: '0.875rem'
            }}
          >
            <option value="all">All ({sources.length})</option>
            <option value="enabled">Enabled ({enabledCount})</option>
            <option value="disabled">Disabled ({disabledCount})</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.25rem' }}>📈 Sort By</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '4px',
              border: '1px solid #d1d5db',
              fontSize: '0.875rem'
            }}
          >
            <option value="name">Name (A-Z)</option>
            <option value="trust">Trust Score (High→Low)</option>
            <option value="type">Type</option>
          </select>
        </div>
      </div>

      {/* Results Summary */}
      <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#666' }}>
        Showing {paginatedSources.length} of {sorted.length} sources
        {search && ` (filtered by "${search}")`}
        {filterType && ` (type: ${filterType})`}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left', minWidth: '150px' }}>Name</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', minWidth: '100px' }}>Type</th>
              <th style={{ padding: '0.75rem', textAlign: 'center', minWidth: '80px' }}>Trust</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', minWidth: '100px' }}>Country</th>
              <th style={{ padding: '0.75rem', textAlign: 'center', minWidth: '80px' }}>Health</th>
              <th style={{ padding: '0.75rem', textAlign: 'center', minWidth: '80px' }}>Status</th>
              <th style={{ padding: '0.75rem', textAlign: 'center', minWidth: '120px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedSources.map(source => {
              const testResult = testResults.get(source.id);
              const isTesting = testing.has(source.id);
              const trustScore = source.trust_score || 0.5;
              
              return (
                <tr key={source.id} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: !source.enabled ? '#fafafa' : '#fff' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 'bold', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {source.name}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{
                      padding: '2px 8px',
                      backgroundColor: '#e8f4f8',
                      color: '#0066cc',
                      borderRadius: '3px',
                      fontSize: '0.7rem',
                      fontWeight: 'bold'
                    }}>
                      {source.type || 'generic-rss'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <span style={{
                      padding: '2px 6px',
                      backgroundColor: getTrustScoreColor(trustScore),
                      borderRadius: '3px',
                      fontSize: '0.7rem',
                      fontWeight: 'bold'
                    }}>
                      {trustScore.toFixed(2)}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    {source.country || '-'}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '1.2rem' }}>
                    {getHealthStatusEmoji(source.health_status)}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.7rem',
                      fontWeight: 'bold',
                      backgroundColor: source.enabled ? '#dcfce7' : '#fee2e2',
                      color: source.enabled ? '#166534' : '#991b1b'
                    }}>
                      {source.enabled ? '✓ ON' : '✗ OFF'}
                    </span>
                    {testResult && (
                      <div style={{ marginTop: '0.25rem', fontSize: '0.7rem' }}>
                        {testResult.ok ? (
                          <span style={{ color: '#16a34a' }}>✓ OK</span>
                        ) : (
                          <span style={{ color: '#dc2626' }}>✗ FAIL</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <button
                      onClick={() => handleToggleEnabled(source.id, source.enabled)}
                      style={{
                        padding: '0.25rem 0.5rem',
                        marginRight: '0.25rem',
                        fontSize: '0.7rem',
                        borderRadius: '3px',
                        border: '1px solid #d1d5db',
                        backgroundColor: '#fff',
                        cursor: 'pointer'
                      }}
                      title={source.enabled ? 'Disable source' : 'Enable source'}
                    >
                      {source.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => handleTestSource(source.id, source.url)}
                      disabled={isTesting}
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.7rem',
                        borderRadius: '3px',
                        border: '1px solid #d1d5db',
                        backgroundColor: isTesting ? '#e5e7eb' : '#fff',
                        cursor: isTesting ? 'not-allowed' : 'pointer'
                      }}
                      title="Test source URL (HEAD request)"
                    >
                      {isTesting ? '...' : 'Test'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center' }}>
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
            ← Previous
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
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
