import React, { useState, useEffect } from 'react';
import { apiFetchJson } from '../lib/utils/api';
import { useScour } from './ScourContext';
import { SourceBulkUpload } from './SourceBulkUpload';
import ScourStatusBarInline from './ScourStatusBarInline';
import { SourceTable } from './SourceTable';
import { AutoScourSettings } from './AutoScourSettings';

interface Source {
  id: string;
  name: string;
  url: string;
  country?: string;
  enabled: boolean;
  created_at: string;
}

interface SourceManagerInlineProps {
  accessToken: string;
  permissions?: {
    canManageSources?: boolean;
    canScour?: boolean;
  };
}

const SourceManagerInline: React.FC<SourceManagerInlineProps> = ({ 
  accessToken,
  permissions 
}) => {
  const [query, setQuery] = useState("");`nconst [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { isScouring, startScour } = useScour();

  const canManage = permissions?.canManageSources !== false;
  const canScour = permissions?.canScour !== false;

  const loadSources = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiFetchJson<{ ok: boolean; sources: Source[] }>(
        '/sources',
        accessToken
      );

      if (response.ok && Array.isArray(response.sources)) {
        setSources(response.sources);
        console.log(`ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ Loaded ${response.sources.length} sources`);
      } else {
        console.warn('Invalid response format:', response);
        setSources([]);
      }
    } catch (err: any) {
      console.error('Failed to load sources:', err);
      setError(err.message || 'Failed to load sources');
      setSources([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSources();
  }, [accessToken]);

  const handleStartScour = async () => {
    console.log('Ã°Å¸â€Â handleStartScour called');
    console.log('Ã°Å¸â€œÅ  sources state:', sources);
    console.log('Ã°Å¸â€œÅ  sources.length:', sources.length);
    console.log('Ã¢Å“â€¦ canScour:', canScour);
    
    if (!canScour) {
      alert('You do not have permission to run scour operations.');
      return;
    }

    const enabledSources = sources.filter(s => s.enabled);
    console.log('Ã¢Å“â€¦ enabledSources:', enabledSources.length);
    console.log('Ã°Å¸â€œâ€¹ enabledSources IDs:', enabledsources.filter(s => [s.name,s.country,s.region].join(" ").toLowerCase().includes(query.toLowerCase())).map(s => s.id));
    
    if (enabledSources.length === 0) {
      alert('No enabled sources available. Please enable at least one source before scouring.');
      return;
    }

    console.log(`ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â¡ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ Starting scour with ${enabledSources.length} enabled sources:`, 
      enabledsources.filter(s => [s.name,s.country,s.region].join(" ").toLowerCase().includes(query.toLowerCase())).map(s => s.name).join(', ')
    );

    try {
      await startScour(accessToken, {
        sourceIds: enabledsources.filter(s => [s.name,s.country,s.region].join(" ").toLowerCase().includes(query.toLowerCase())).map(s => s.id),
        daysBack: 14
      });
    } catch (err: any) {
      console.error('Start scour error:', err);
      alert(`Failed to start scour: ${err.message}`);
    }
  };

  const isAdmin = permissions?.canManageSources !== false;

  // Inline styles
  const containerStyle: React.CSSProperties = {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '24px',
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: '24px',
  };

  const headingStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 600,
    marginBottom: '12px',
    color: '#111827',
  };

  const buttonPrimaryStyle: React.CSSProperties = {
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '10px 20px',
    background: 'white',
    color: '#374151',
    border: '1px solid #D1D5DB',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
  };

  const errorStyle: React.CSSProperties = {
    padding: '12px',
    background: '#FEE2E2',
    border: '1px solid #FECACA',
    borderRadius: '6px',
    color: '#991B1B',
    marginBottom: '16px',
  };

  const emptyStateStyle: React.CSSProperties = {
    textAlign: 'center',
    padding: '40px',
    color: '#6B7280',
    background: '#F9FAFB',
    borderRadius: '8px',
    border: '1px dashed #D1D5DB',
  };

  return (
    <div style={containerStyle}>
      {/* Auto Scour Settings (Admin Only) */}
      {isAdmin && (
        <AutoScourSettings accessToken={accessToken} isAdmin={isAdmin} />
      )}

      {/* Bulk Upload Section */}
      {canManage && (
        <div style={sectionStyle}>
          <h2 style={headingStyle}>Bulk Upload Sources</h2>
          <SourceBulkUpload
            accessToken={accessToken}
            onUploadComplete={loadSources}
          />
        </div>
      )}

      {/* Scour Status Bar */}
      <ScourStatusBarInline />

      {/* Controls */}
      <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <button
          onClick={handleStartScour}
          disabled={isScouring || !canScour || sources.length === 0}
          style={{
            ...buttonPrimaryStyle,
            opacity: (isScouring || !canScour || sources.length === 0) ? 0.5 : 1,
            cursor: (isScouring || !canScour || sources.length === 0) ? 'not-allowed' : 'pointer',
          }}
        >
          {isScouring ? 'ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€šÃ‚Â³ Scouring...' : 'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â Start Scour'}
        </button>

        <button
          onClick={loadSources}
          disabled={loading}
          style={{
            ...buttonStyle,
            opacity: loading ? 0.5 : 1,
          }}
        >
          ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾ Refresh Sources
        </button>

        {sources.length > 0 && (
          <span style={{ fontSize: '14px', color: '#6B7280' }}>
            {sources.filter(s => s.enabled).length} of {sources.length} sources enabled
          </span>
        )}
      </div>

      {/* Error Display */}
      {error && <div style={errorStyle}>{error}</div>}

      {/* Loading State */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>
          Loading sources...
        </div>
      )}

      {/* Sources List */}
      {!loading && (
        <>
          <h2 style={headingStyle}>Sources ({sources.length})</h2>
          
          {sources.length === 0 ? (
            <div style={emptyStateStyle}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒâ€šÃ‚Â°</div>
              <div style={{ fontSize: '16px', fontWeight: 500, marginBottom: '8px' }}>
                No sources configured
              </div>
              <div style={{ fontSize: '14px' }}>
                Use bulk upload above to add news sources
              </div>
            </div>
          ) : (
            <SourceTable
              sources={sources}
              onSourceUpdated={loadSources}
              accessToken={accessToken}
            />
          )}
        </>
      )}
    </div>
  );
};

export default SourceManagerInline;






