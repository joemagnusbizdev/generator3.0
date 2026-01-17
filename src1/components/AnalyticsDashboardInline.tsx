/**
 * AnalyticsDashboardInline - Analytics Dashboard
 * 
 * Displays alert metrics with breakdowns by:
 * - Time Period: This Week, This Month, Year-to-Date
 * - Dimensions: Severity, Event Type, Country
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetchJson } from '../lib/utils/api';
import { colors } from '../styles/inline';
import { buttons } from '../styles/designSystem';

// ============================================================================
// Types
// ============================================================================

interface AlertRow {
  id: string;
  status?: string | null;
  created_at?: string | null;
  country?: string | null;
  severity?: string | null;
  event_type?: string | null;
  wordpress_post_id?: string | number | null;
}

interface AnalyticsDashboardInlineProps {
  apiBase: string;
  accessToken?: string;
  permissions: {
    canAccessAnalytics?: boolean;
    canViewDetailedStats?: boolean;
    canExportAnalytics?: boolean;
  };
}

// ============================================================================
// Helpers
// ============================================================================

function safeArr<T>(val: unknown): T[] {
  return Array.isArray(val) ? val : [];
}

function getStartOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Monday
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getStartOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function getStartOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
}

function groupAndCount<T>(
  arr: T[],
  keyFn: (item: T) => string
): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of arr) {
    const key = keyFn(item) || 'Unknown';
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

function mapToSortedArray(map: Map<string, number>): [string, number][] {
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function percentChange(current: number, previous: number): { value: number; direction: 'up' | 'down' | 'same' } {
  if (previous === 0) return { value: current > 0 ? 100 : 0, direction: current > 0 ? 'up' : 'same' };
  const change = ((current - previous) / previous) * 100;
  return {
    value: Math.abs(Math.round(change)),
    direction: change > 0 ? 'up' : change < 0 ? 'down' : 'same',
  };
}

// ============================================================================
// Styles
// ============================================================================

const COLORS = {
  bg: '#F9F8F6',
  card: '#FFFFFF',
  border: '#E5E7EB',
  text: '#192622',
  muted: '#6B7280',
  primary: '#144334',
  accent: '#F88A35',
  success: '#059669',
  warning: '#D97706',
  danger: '#DC2626',
  info: '#2563EB',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: COLORS.danger,
  warning: COLORS.warning,
  caution: COLORS.info,
  informative: COLORS.muted,
  unknown: '#9CA3AF',
};

// ============================================================================
// Sub-Components
// ============================================================================

interface PeriodCardProps {
  title: string;
  subtitle: string;
  total: number;
  posted: number;
  comparison?: { value: number; direction: 'up' | 'down' | 'same'; label: string };
  isActive: boolean;
  onClick: () => void;
}

function PeriodCard({ title, subtitle, total, posted, comparison, isActive, onClick }: PeriodCardProps): JSX.Element {
  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: isActive ? COLORS.primary : COLORS.card,
        borderRadius: '12px',
        padding: '1.25rem',
        border: `2px solid ${isActive ? COLORS.primary : COLORS.border}`,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        minWidth: '180px',
      }}
    >
      <div style={{ 
        fontSize: '0.75rem', 
        color: isActive ? 'rgba(255,255,255,0.7)' : COLORS.muted,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: '0.25rem',
      }}>
        {title}
      </div>
      <div style={{ 
        fontSize: '0.7rem', 
        color: isActive ? 'rgba(255,255,255,0.5)' : COLORS.muted,
        marginBottom: '0.75rem',
      }}>
        {subtitle}
      </div>
      <div style={{ 
        fontSize: '2.5rem', 
        fontWeight: 700, 
        color: isActive ? 'white' : COLORS.primary,
        lineHeight: 1,
      }}>
        {formatNumber(total)}
      </div>
      <div style={{ 
        fontSize: '0.75rem', 
        color: isActive ? 'rgba(255,255,255,0.7)' : COLORS.muted,
        marginTop: '0.5rem',
      }}>
        {formatNumber(posted)} posted to WP
      </div>
      {comparison && comparison.value > 0 && (
        <div style={{
          marginTop: '0.5rem',
          fontSize: '0.7rem',
          color: isActive 
            ? 'rgba(255,255,255,0.8)' 
            : comparison.direction === 'up' ? COLORS.success : comparison.direction === 'down' ? COLORS.danger : COLORS.muted,
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}>
          {comparison.direction === 'up' ? 'Ã¢â€ â€˜' : comparison.direction === 'down' ? 'Ã¢â€ â€œ' : 'Ã¢â€ â€™'}
          {comparison.value}% {comparison.label}
        </div>
      )}
    </div>
  );
}

interface BreakdownTableProps {
  title: string;
  icon: string;
  data: [string, number][];
  total: number;
  colorFn?: (key: string) => string;
  maxRows?: number;
}

function BreakdownTable({ title, icon, data, total, colorFn, maxRows = 10 }: BreakdownTableProps): JSX.Element {
  const displayData = data.slice(0, maxRows);
  const hasMore = data.length > maxRows;
  
  return (
    <div style={{
      backgroundColor: COLORS.card,
      borderRadius: '12px',
      border: `1px solid ${COLORS.border}`,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem 1.25rem',
        borderBottom: `1px solid ${COLORS.border}`,
        backgroundColor: '#FAFAFA',
      }}>
        <h3 style={{
          margin: 0,
          fontSize: '1rem',
          fontWeight: 600,
          color: COLORS.text,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <span>{icon}</span> {title}
        </h3>
      </div>
      
      {/* Table */}
      <div style={{ padding: '0.5rem 0' }}>
        {displayData.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: COLORS.muted, fontSize: '0.875rem' }}>
            No data for this period
          </div>
        ) : (
          <>
            {/* Column Headers */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 80px 100px',
              padding: '0.5rem 1.25rem',
              fontSize: '0.7rem',
              color: COLORS.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              borderBottom: `1px solid ${COLORS.border}`,
            }}>
              <div>Name</div>
              <div style={{ textAlign: 'right' }}>Count</div>
              <div style={{ textAlign: 'right' }}>% of Total</div>
            </div>
            
            {/* Rows */}
            {displayData.map(([key, count], index) => {
              const percent = total > 0 ? Math.round((count / total) * 100) : 0;
              const barColor = colorFn ? colorFn(key.toLowerCase()) : COLORS.primary;
              
              return (
                <div
                  key={key}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 80px 100px',
                    padding: '0.75rem 1.25rem',
                    alignItems: 'center',
                    borderBottom: index < displayData.length - 1 ? `1px solid ${COLORS.border}` : 'none',
                    backgroundColor: index % 2 === 0 ? 'white' : '#FAFAFA',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '3px',
                      backgroundColor: barColor,
                      flexShrink: 0,
                    }} />
                    <span style={{ 
                      fontSize: '0.875rem', 
                      color: COLORS.text,
                      fontWeight: 500,
                    }}>
                      {key}
                    </span>
                  </div>
                  <div style={{ 
                    textAlign: 'right', 
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: COLORS.text,
                  }}>
                    {formatNumber(count)}
                  </div>
                  <div style={{ 
                    textAlign: 'right',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '0.5rem',
                  }}>
                    <div style={{
                      width: '60px',
                      height: '8px',
                      backgroundColor: COLORS.border,
                      borderRadius: '4px',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${percent}%`,
                        height: '100%',
                        backgroundColor: barColor,
                        borderRadius: '4px',
                      }} />
                    </div>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      color: COLORS.muted,
                      minWidth: '35px',
                    }}>
                      {percent}%
                    </span>
                  </div>
                </div>
              );
            })}
            
            {hasMore && (
              <div style={{
                padding: '0.75rem 1.25rem',
                fontSize: '0.75rem',
                color: COLORS.muted,
                textAlign: 'center',
                backgroundColor: '#FAFAFA',
              }}>
                +{data.length - maxRows} more items
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface SummaryStatProps {
  label: string;
  value: number | string;
  icon: string;
  color?: string;
}

function SummaryStat({ label, value, icon, color = COLORS.primary }: SummaryStatProps): JSX.Element {
  return (
    <div style={{
      backgroundColor: COLORS.card,
      borderRadius: '10px',
      padding: '1rem',
      border: `1px solid ${COLORS.border}`,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{icon}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '0.7rem', color: COLORS.muted, textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function AnalyticsDashboardInline({
  apiBase,
  accessToken,
  permissions,
}: AnalyticsDashboardInlineProps): JSX.Element | null {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'ytd'>('month');

  // Permission check
  if (!permissions.canAccessAnalytics) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: colors.gray500 }}>
        <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>Ã°Å¸â€â€™ Access Restricted</p>
        <p>You don't have permission to view analytics.</p>
      </div>
    );
  }

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);

    try {
      const alertsRes = await apiFetchJson<{ ok?: boolean; alerts?: AlertRow[] } | AlertRow[]>(
        '/alerts?limit=5000', 
        accessToken
      ).catch(() => []);

      const alertsData = Array.isArray(alertsRes) ? alertsRes : (alertsRes as any)?.alerts ?? [];
      setAlerts(safeArr<AlertRow>(alertsData).filter((a) => typeof a.id === 'string'));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load analytics data';
      setErr(message);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Calculate date ranges
  const now = new Date();
  const startOfThisWeek = getStartOfWeek(now);
  const startOfThisMonth = getStartOfMonth(now);
  const startOfThisYear = getStartOfYear(now);
  
  // Previous periods for comparison
  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
  const endOfLastWeek = new Date(startOfThisWeek);
  endOfLastWeek.setMilliseconds(-1);
  
  const startOfLastMonth = new Date(startOfThisMonth);
  startOfLastMonth.setMonth(startOfLastMonth.getMonth() - 1);
  const endOfLastMonth = new Date(startOfThisMonth);
  endOfLastMonth.setMilliseconds(-1);

  // Filter alerts by period
  const alertsThisWeek = useMemo(() => 
    alerts.filter(a => a.created_at && new Date(a.created_at) >= startOfThisWeek),
    [alerts, startOfThisWeek]
  );
  
  const alertsLastWeek = useMemo(() => 
    alerts.filter(a => {
      if (!a.created_at) return false;
      const d = new Date(a.created_at);
      return d >= startOfLastWeek && d <= endOfLastWeek;
    }),
    [alerts, startOfLastWeek, endOfLastWeek]
  );
  
  const alertsThisMonth = useMemo(() => 
    alerts.filter(a => a.created_at && new Date(a.created_at) >= startOfThisMonth),
    [alerts, startOfThisMonth]
  );
  
  const alertsLastMonth = useMemo(() => 
    alerts.filter(a => {
      if (!a.created_at) return false;
      const d = new Date(a.created_at);
      return d >= startOfLastMonth && d <= endOfLastMonth;
    }),
    [alerts, startOfLastMonth, endOfLastMonth]
  );
  
  const alertsYTD = useMemo(() => 
    alerts.filter(a => a.created_at && new Date(a.created_at) >= startOfThisYear),
    [alerts, startOfThisYear]
  );

  // Get currently selected alerts
  const selectedAlerts = useMemo(() => {
    switch (selectedPeriod) {
      case 'week': return alertsThisWeek;
      case 'month': return alertsThisMonth;
      case 'ytd': return alertsYTD;
      default: return alertsThisMonth;
    }
  }, [selectedPeriod, alertsThisWeek, alertsThisMonth, alertsYTD]);

  // Compute breakdowns for selected period
  const breakdowns = useMemo(() => {
    const bySeverity = mapToSortedArray(groupAndCount(selectedAlerts, a => {
      const s = (a.severity ?? 'unknown').toLowerCase();
      // Capitalize first letter
      return s.charAt(0).toUpperCase() + s.slice(1);
    }));
    
    const byEventType = mapToSortedArray(groupAndCount(selectedAlerts, a => 
      a.event_type ?? 'Unknown'
    ));
    
    const byCountry = mapToSortedArray(groupAndCount(selectedAlerts, a => 
      a.country ?? 'Unknown'
    ));
    
    const posted = selectedAlerts.filter(a => a.wordpress_post_id != null).length;
    const draft = selectedAlerts.filter(a => a.status === 'draft').length;
    const approved = selectedAlerts.filter(a => a.status === 'approved').length;
    const dismissed = selectedAlerts.filter(a => a.status === 'dismissed').length;

    return {
      bySeverity,
      byEventType,
      byCountry,
      total: selectedAlerts.length,
      posted,
      draft,
      approved,
      dismissed,
    };
  }, [selectedAlerts]);

  // Period labels
  const weekLabel = `${startOfThisWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const ytdLabel = `Jan 1 - ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  // Comparisons
  const weekComparison = percentChange(alertsThisWeek.length, alertsLastWeek.length);
  const monthComparison = percentChange(alertsThisMonth.length, alertsLastMonth.length);

  // Styles
  const containerStyle: React.CSSProperties = {
    padding: '1.5rem',
    backgroundColor: COLORS.bg,
    minHeight: '100%',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
    flexWrap: 'wrap',
    gap: '1rem',
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: '3rem', color: COLORS.muted }}>
          Loading analytics...
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div>
          <h2 style={{ 
            fontSize: '1.5rem', 
            fontWeight: 600, 
            color: COLORS.primary, 
            margin: 0,
            marginBottom: '0.25rem',
          }}>
            Ã°Å¸â€œÅ  Analytics Dashboard
          </h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: COLORS.muted }}>
            Alert metrics by time period
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          style={{
            ...buttons.secondary,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          Ã¢â€ Â» Refresh
        </button>
      </div>

      {err && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#FEF2F2',
          border: `1px solid ${COLORS.danger}`,
          borderRadius: '8px',
          color: COLORS.danger,
          marginBottom: '1.5rem',
        }}>
          <strong>Error:</strong> {err}
        </div>
      )}

      {/* Period Selection Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem',
      }}>
        <PeriodCard
          title="This Week"
          subtitle={weekLabel}
          total={alertsThisWeek.length}
          posted={alertsThisWeek.filter(a => a.wordpress_post_id).length}
          comparison={{ ...weekComparison, label: 'vs last week' }}
          isActive={selectedPeriod === 'week'}
          onClick={() => setSelectedPeriod('week')}
        />
        <PeriodCard
          title="This Month"
          subtitle={monthLabel}
          total={alertsThisMonth.length}
          posted={alertsThisMonth.filter(a => a.wordpress_post_id).length}
          comparison={{ ...monthComparison, label: 'vs last month' }}
          isActive={selectedPeriod === 'month'}
          onClick={() => setSelectedPeriod('month')}
        />
        <PeriodCard
          title="Year to Date"
          subtitle={ytdLabel}
          total={alertsYTD.length}
          posted={alertsYTD.filter(a => a.wordpress_post_id).length}
          isActive={selectedPeriod === 'ytd'}
          onClick={() => setSelectedPeriod('ytd')}
        />
      </div>

      {/* Summary Stats for Selected Period */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: '0.75rem',
        marginBottom: '2rem',
      }}>
        <SummaryStat label="Total Alerts" value={formatNumber(breakdowns.total)} icon="Ã°Å¸â€œâ€¹" color={COLORS.primary} />
        <SummaryStat label="Posted to WP" value={formatNumber(breakdowns.posted)} icon="Ã°Å¸â€œÂ¤" color={COLORS.success} />
        <SummaryStat label="Drafts" value={formatNumber(breakdowns.draft)} icon="Ã°Å¸â€œÂ" color={COLORS.warning} />
        <SummaryStat label="Approved" value={formatNumber(breakdowns.approved)} icon="Ã¢Å“â€¦" color={COLORS.info} />
        <SummaryStat label="Dismissed" value={formatNumber(breakdowns.dismissed)} icon="Ã°Å¸Å¡Â«" color={COLORS.muted} />
      </div>

      {/* Selected Period Label */}
      <div style={{
        marginBottom: '1rem',
        padding: '0.75rem 1rem',
        backgroundColor: COLORS.primary,
        color: 'white',
        borderRadius: '8px',
        fontSize: '0.875rem',
        fontWeight: 500,
      }}>
        Breakdown for: {selectedPeriod === 'week' ? `This Week (${weekLabel})` : selectedPeriod === 'month' ? monthLabel : `Year to Date (${ytdLabel})`}
      </div>

      {/* Breakdown Tables */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
        gap: '1.5rem',
      }}>
        {/* By Severity */}
        <BreakdownTable
          title="By Severity"
          icon="Ã¢Å¡Â Ã¯Â¸Â"
          data={breakdowns.bySeverity}
          total={breakdowns.total}
          colorFn={(key) => SEVERITY_COLORS[key] ?? COLORS.muted}
          maxRows={5}
        />

        {/* By Event Type */}
        <BreakdownTable
          title="By Event Type"
          icon="Ã°Å¸â€œâ€¹"
          data={breakdowns.byEventType}
          total={breakdowns.total}
          colorFn={() => COLORS.accent}
          maxRows={10}
        />

        {/* By Country */}
        <BreakdownTable
          title="By Country"
          icon="Ã°Å¸Å’Â"
          data={breakdowns.byCountry}
          total={breakdowns.total}
          colorFn={() => COLORS.info}
          maxRows={15}
        />
      </div>

      {/* Footer */}
      <div style={{ 
        marginTop: '2rem', 
        padding: '1rem', 
        textAlign: 'center',
        fontSize: '0.75rem',
        color: COLORS.muted,
        borderTop: `1px solid ${COLORS.border}`,
      }}>
        Data refreshed: {new Date().toLocaleString()} Ã¢â‚¬Â¢ Total alerts in database: {formatNumber(alerts.length)}
      </div>
    </div>
  );
}

export default AnalyticsDashboardInline;

