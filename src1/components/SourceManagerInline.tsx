import React, { useState, useEffect, useCallback } from 'react';
import { SourceBulkUpload } from './SourceBulkUpload';
import { ScourStatusBar } from './ScourStatusBar';
import { SourceTable } from './SourceTable';
import { AutoScourSettings } from './AutoScourSettings';
import { useScour } from './ScourContext';
import { apiFetchJson } from '../lib/utils/api';

interface Source {
  id: string;
  name: string;
  url: string;
  country?: string;
  enabled: boolean;
  created_at: string;
}

interface SourceManagerInlineProps {
  accessToken?: string;
  permissions?: {
    canManageSources?: boolean;
    canScour?: boolean;
  };
  userRole?: string;
}

export default function SourceManagerInline({ accessToken, permissions, userRole }: SourceManagerInlineProps) {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { isScouring, scourJob, startScour } = useScour();

  const canManage = permissions?.canManageSources !== false;
  const canScour = permissions?.canScour !== false;
  const isAdmin = userRole === 'admin' || userRole === 'owner';

  const loadSources = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiFetchJson<{ ok: boolean; sources: Source[] }>('/sources', accessToken);
      
      if (result.ok) {
        setSources(result.sources || []);
        console.log('Loaded sources:', result.sources?.length || 0);
      } else {
        setError('Failed to load sources');
      }
    } catch (err: any) {
      console.error('Error loading sources:', err);
      setError(err.message || 'Failed to load sources');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  const handleScour = async () => {
    if (!canScour) {
      alert('You do not have permission to scour sources.');
      return;
    }

    if (sources.length === 0) {
      alert('No sources to scour. Please upload sources first.');
      return;
    }

    await startScour(accessToken);
  };

  const containerStyle: React.CSSProperties = {
    padding: '2rem',
    maxWidth: '1400px',
    margin: '0 auto',
  };

  const headerStyle: React.CSSProperties = {
    marginBottom: '2rem',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '1.875rem',
    fontWeight: 'bold',
    marginBottom: '0.5rem',
  };

  const subtitleStyle: React.CSSProperties = {
    color: '#6b7280',
    fontSize: '0.875rem',
  };

  const actionBarStyle: React.CSSProperties = {
    display: 'flex',
    gap: '1rem',
    marginBottom: '2rem',
    alignItems: 'center',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '0.75rem 1.5rem',
    borderRadius: '0.5rem',
    border: 'none',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    backgroundColor: '#3b82f6',
    color: 'white',
    transition: 'background-color 0.2s',
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: '2rem',
    backgroundColor: 'white',
    borderRadius: '0.5rem',
    padding: '1.5rem',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '1.25rem',
    fontWeight: '600',
    marginBottom: '1rem',
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>Source Management</h1>
        <p style={subtitleStyle}>
          Upload, manage, and monitor news sources for alert generation
        </p>
      </div>

      {isAdmin && (
        <AutoScourSettings
          accessToken={accessToken}
          isAdmin={isAdmin}
        />
      )}

      {canManage && (
        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>📤 Bulk Upload Sources</h2>
          <SourceBulkUpload
            accessToken={accessToken}
            onUploadComplete={(count) => {
              console.log(`Successfully uploaded ${count} sources`);
              loadSources();
            }}
          />
        </div>
      )}

      {(isScouring || scourJob) && (
        <div style={{ marginBottom: '2rem' }}>
          <ScourStatusBar
            job={scourJob}
            isRunning={isScouring}
          />
        </div>
      )}

      <div style={actionBarStyle}>
        {canScour && (
          <button
            onClick={handleScour}
            disabled={isScouring || sources.length === 0}
            style={{
              ...buttonStyle,
              backgroundColor: isScouring || sources.length === 0 ? '#9ca3af' : '#3b82f6',
              cursor: isScouring || sources.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {isScouring ? '🔄 Scouring...' : '🔍 Start Scour'}
          </button>
        )}
        
        <button
          onClick={loadSources}
          disabled={loading}
          style={{
            ...buttonStyle,
            backgroundColor: '#10b981',
          }}
        >
          {loading ? '⟳ Loading...' : '🔄 Refresh Sources'}
        </button>

        <div style={{ marginLeft: 'auto', color: '#6b7280', fontSize: '0.875rem' }}>
          {sources.length} sources • {sources.filter(s => s.enabled).length} enabled
        </div>
      </div>

      {error && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#fee2e2',
          color: '#991b1b',
          borderRadius: '0.5rem',
          marginBottom: '1rem',
        }}>
          ⚠️ {error}
        </div>
      )}

      <div style={sectionStyle}>
        <h2 style={sectionTitleStyle}>📋 Sources List</h2>
        
        {loading && sources.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
            Loading sources...
          </div>
        ) : (
          <SourceTable
            sources={sources}
            onSourceUpdated={loadSources}
            accessToken={accessToken}
          />
        )}
      </div>
    </div>
  );
}