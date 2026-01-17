/**
 * TrendsView - Display and manage trends
 */
import React, { useState, useEffect, useCallback } from 'react';
import { apiFetchJson, apiPostJson } from '../lib/utils/api';
import { colors, styles, combine } from '../styles/inline';
import { cards, buttons, badges, typography } from '../styles/designSystem';

// ============================================================================
// Types
// ============================================================================

interface Trend {
  id: string;
  title?: string;
  description?: string;
  predictive_analysis?: string;
  status?: 'open' | 'monitoring' | 'closed' | string;
  country?: string;
  countries?: string[];
  region?: string;
  event_type?: string;
  incident_count?: number;
  alert_ids?: string[];
  first_seen?: string;
  last_seen?: string;
  updated_at?: string;
  severity?: string;
  auto_generated?: boolean;
}

interface TrendsViewProps {
  accessToken?: string;
  permissions?: {
    canViewTrends?: boolean;
  };
}

// ============================================================================
// Component
// ============================================================================

export function TrendsView({
  accessToken,
  permissions,
}: TrendsViewProps): JSX.Element | null {
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'monitoring' | 'closed'>('all');
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fetch trends
  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);

    try {
      const data = await apiFetchJson<Trend[]>('/trends', accessToken);
      setTrends(Array.isArray(data) ? data : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load trends';
      setErr(message);
      setTrends([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Filter trends
  const filteredTrends = trends.filter(t => {
    if (filter === 'all') return true;
    return t.status === filter;
  });

  // Export HTML report
  const handleExportReport = async (trendId: string) => {
    setExportingId(trendId);
    try {
      const result = await apiPostJson<{ ok: boolean; html?: string; error?: string; reportId?: string }>(
        `/trends/${trendId}/generate-brief`,
        {},
        accessToken
      );
      
      if (!result.ok || !result.html) {
        throw new Error(result.error ?? 'Failed to generate report');
      }
      
      // Create blob and download
      const blob = new Blob([result.html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MAGNUS-Situational-Brief-${result.reportId ?? trendId}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed';
      alert(`Export failed: ${message}`);
    } finally {
      setExportingId(null);
    }
  };

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

  const filtersStyle: React.CSSProperties = {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1rem',
  };

  const filterBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '0.5rem 1rem',
    borderRadius: '20px',
    border: `1px solid ${active ? colors.magnusDarkGreen : colors.gray300}`,
    backgroundColor: active ? colors.magnusDarkGreen : 'white',
    color: active ? 'white' : colors.gray700,
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: 500,
    transition: 'all 0.2s ease',
  });

  const cardStyle: React.CSSProperties = {
    ...cards.base,
    marginBottom: '1rem',
    padding: '1.25rem',
  };

  const cardHeaderStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '0.75rem',
  };

  const trendTitleStyle: React.CSSProperties = {
    fontSize: '1.125rem',
    fontWeight: 600,
    color: colors.magnusDarkText,
    margin: 0,
    flex: 1,
  };

  const metaStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.75rem',
    marginBottom: '0.5rem',
    fontSize: '0.875rem',
    color: colors.gray600,
  };

  const statusBadge = (status?: string): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      padding: '4px 10px',
      borderRadius: '12px',
      fontSize: '0.75rem',
      fontWeight: 600,
      textTransform: 'uppercase',
    };

    switch (status) {
      case 'open':
        return { ...baseStyle, backgroundColor: colors.danger + '20', color: colors.danger };
      case 'monitoring':
        return { ...baseStyle, backgroundColor: colors.warning + '20', color: colors.warning };
      case 'closed':
        return { ...baseStyle, backgroundColor: colors.gray200, color: colors.gray600 };
      default:
        return { ...baseStyle, backgroundColor: colors.blue100, color: colors.blue700 };
    }
  };

  const errorStyle: React.CSSProperties = {
    padding: '1rem',
    backgroundColor: colors.red50,
    border: `1px solid ${colors.red200}`,
    borderRadius: '8px',
    color: colors.red700,
    marginBottom: '1rem',
  };

  const emptyStyle: React.CSSProperties = {
    textAlign: 'center',
    padding: '3rem',
    color: colors.gray500,
    backgroundColor: colors.gray100,
    borderRadius: '12px',
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h2 style={titleStyle}>Trends</h2>
        <button
          onClick={refresh}
          disabled={loading}
          style={buttons.secondary}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Filters */}
      <div style={filtersStyle}>
        {(['all', 'open', 'monitoring', 'closed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={filterBtnStyle(filter === f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && (
              <span style={{ marginLeft: '4px', opacity: 0.8 }}>
                ({trends.filter(t => t.status === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {err && (
        <div style={errorStyle}>
          <strong>Error:</strong> {err}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: colors.gray500 }}>
          Loading trends...
        </div>
      ) : filteredTrends.length === 0 ? (
        <div style={emptyStyle}>
          <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>
            No trends found
          </p>
          <p style={{ fontSize: '0.875rem' }}>
            {filter !== 'all' 
              ? `No ${filter} trends. Try selecting a different filter.`
              : 'Trends will appear here as patterns are detected across alerts.'}
          </p>
        </div>
      ) : (
        <div>
          <p style={{ marginBottom: '1rem', color: colors.gray600 }}>
            {filteredTrends.length} trend{filteredTrends.length !== 1 ? 's' : ''}
          </p>

          {filteredTrends.map(trend => (
            <div key={trend.id} style={cardStyle}>
              <div style={cardHeaderStyle}>
                <h3 style={trendTitleStyle}>{trend.title || 'Untitled Trend'}</h3>
                <span style={statusBadge(trend.status)}>
                  {trend.status || 'unknown'}
                </span>
              </div>

              {trend.description && (
                <p style={{ 
                  margin: '0 0 0.75rem', 
                  color: colors.gray600,
                  lineHeight: 1.5,
                }}>
                  {trend.description}
                </p>
              )}

              <div style={metaStyle}>
                {trend.country && (
                  <span>ÃƒÂ°Ã…Â¸Ã…â€™Ã‚Â {trend.country}</span>
                )}
                {trend.region && (
                  <span>ÃƒÂ°Ã…Â¸Ã¢â‚¬â€Ã‚ÂºÃƒÂ¯Ã‚Â¸Ã‚Â {trend.region}</span>
                )}
                {trend.event_type && (
                  <span>ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ {trend.event_type}</span>
                )}
                {trend.incident_count != null && (
                  <span>ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã…Â  {trend.incident_count} incidents</span>
                )}
                {trend.severity && (
                  <span style={{ 
                    padding: '2px 6px',
                    backgroundColor: colors.warning + '20',
                    borderRadius: '4px',
                  }}>
                    ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â {trend.severity}
                  </span>
                )}
              </div>

              <div style={{ 
                fontSize: '0.75rem', 
                color: colors.gray500,
                display: 'flex',
                gap: '1rem',
                marginTop: '0.5rem',
              }}>
                {trend.first_seen && (
                  <span>First seen: {new Date(trend.first_seen).toLocaleDateString()}</span>
                )}
                {trend.last_seen && (
                  <span>Last seen: {new Date(trend.last_seen).toLocaleDateString()}</span>
                )}
                {trend.updated_at && (
                  <span>Updated: {new Date(trend.updated_at).toLocaleDateString()}</span>
                )}
              </div>
              
              {/* Predictive Analysis */}
              {trend.predictive_analysis && (
                <div style={{
                  marginTop: '0.75rem',
                  padding: '0.75rem',
                  backgroundColor: colors.blue50,
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  color: colors.blue800,
                }}>
                  <strong>Predictive Analysis:</strong> {trend.predictive_analysis}
                </div>
              )}
              
              {/* Countries involved (for multi-country trends) */}
              {trend.countries && trend.countries.length > 1 && (
                <div style={{
                  marginTop: '0.5rem',
                  fontSize: '0.75rem',
                  color: colors.gray600,
                }}>
                  Countries involved: {trend.countries.join(', ')}
                </div>
              )}
              
              {/* Action buttons */}
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                marginTop: '1rem',
                paddingTop: '0.75rem',
                borderTop: `1px solid ${colors.gray200}`,
              }}>
                <button
                  onClick={() => setExpandedId(expandedId === trend.id ? null : trend.id)}
                  style={{
                    ...buttons.secondary,
                    fontSize: '0.75rem',
                    padding: '0.5rem 0.75rem',
                  }}
                >
                  {expandedId === trend.id ? 'ÃƒÂ¢Ã¢â‚¬â€œÃ‚Â² Collapse' : 'ÃƒÂ¢Ã¢â‚¬â€œÃ‚Â¼ Details'}
                </button>
                
                <button
                  onClick={() => handleExportReport(trend.id)}
                  disabled={exportingId === trend.id}
                  style={{
                    ...buttons.primary,
                    fontSize: '0.75rem',
                    padding: '0.5rem 0.75rem',
                    opacity: exportingId === trend.id ? 0.7 : 1,
                  }}
                >
                  {exportingId === trend.id ? 'ÃƒÂ¢Ã‚ÂÃ‚Â³ Generating...' : 'ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Å¾ Export Report'}
                </button>
              </div>
              
              {/* Expanded details */}
              {expandedId === trend.id && (
                <div style={{
                  marginTop: '1rem',
                  padding: '1rem',
                  backgroundColor: colors.gray50,
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                }}>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <strong>Trend ID:</strong> {trend.id}
                  </div>
                  {trend.alert_ids && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <strong>Alert IDs:</strong> {trend.alert_ids.length} alerts
                    </div>
                  )}
                  {trend.auto_generated && (
                    <div style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      backgroundColor: colors.magnusDarkGreen + '20',
                      color: colors.magnusDarkGreen,
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                    }}>
                      Auto-generated by AI
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TrendsView;




