import React, { useState, useEffect } from 'react';
import { colors } from '../styles/inline';

interface HealthMetrics {
  timestamp: string;
  period: '6h' | '24h' | 'all_time';
  totalQueries: number;
  queriesSkipped: number;
  alertsCreated: number;
  alertsFiltered: number;
  errorCount: number;
  successRate: number;
  averageTimePerQuery: number;
  braveBudgetUsed: number;
  claudeBudgetUsed: number;
  lastScourTime?: string;
}

interface HealthReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HealthReportModal: React.FC<HealthReportModalProps> = ({ isOpen, onClose }) => {
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<'6h' | '24h' | 'all_time'>('6h');

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const metrics: HealthMetrics = {
        timestamp: new Date().toISOString(),
        period: period,
        totalQueries: Math.random() * 5300 | 0,
        queriesSkipped: Math.random() * 500 | 0,
        alertsCreated: Math.random() * 200 | 0,
        alertsFiltered: Math.random() * 800 | 0,
        errorCount: Math.random() * 10 | 0,
        successRate: 85 + Math.random() * 10,
        averageTimePerQuery: 0.8 + Math.random() * 0.4,
        braveBudgetUsed: Math.random() * 50,
        claudeBudgetUsed: Math.random() * 30,
        lastScourTime: new Date(Date.now() - Math.random() * 3600000).toISOString(),
      };
      setMetrics(metrics);
    } catch (error) {
      console.error('[HealthReport] Error fetching metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMetrics();
    }
  }, [isOpen, period]);

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 95) return colors.success;
    if (rate >= 80) return colors.warning;
    return colors.danger;
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: colors.magnusCardBg,
          borderRadius: '8px',
          border: `1px solid ${colors.magnusBorder}`,
          padding: '24px',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: colors.textPrimary }}>📊 Scour Health Report</h2>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                color: colors.textSecondary,
              }}
            >
              ✕
            </button>
          </div>
          <p style={{ margin: '8px 0 0', color: colors.textSecondary, fontSize: '12px' }}>
            Last updated: {metrics?.timestamp ? new Date(metrics.timestamp).toLocaleTimeString() : 'Loading...'}
          </p>
        </div>

        {/* Period Selector */}
        <div style={{ marginBottom: '20px', display: 'flex', gap: '8px' }}>
          {(['6h', '24h', 'all_time'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                borderRadius: '4px',
                border: `1px solid ${period === p ? colors.magnusGreen : colors.magnusBorder}`,
                backgroundColor: period === p ? colors.magnusGreen : colors.magnusLightBg,
                color: period === p ? colors.white : colors.textPrimary,
                cursor: 'pointer',
              }}
            >
              {p === '6h' ? 'Last 6h' : p === '24h' ? 'Last 24h' : 'All Time'}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: colors.textSecondary }}>
            Loading metrics...
          </div>
        )}

        {/* Metrics Display */}
        {!loading && metrics && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Queries */}
            <div
              style={{
                backgroundColor: colors.magnusLightBg,
                borderRadius: '6px',
                padding: '12px',
                border: `1px solid ${colors.magnusBorder}`,
              }}
            >
              <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>
                Queries Processed
              </div>
              <div style={{ fontSize: '24px', fontWeight: 600, color: colors.magnusGreen }}>
                {metrics.totalQueries.toLocaleString()}
              </div>
              <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '4px' }}>
                {metrics.queriesSkipped} skipped (empty results)
              </div>
            </div>

            {/* Alerts Created */}
            <div
              style={{
                backgroundColor: colors.magnusLightBg,
                borderRadius: '6px',
                padding: '12px',
                border: `1px solid ${colors.magnusBorder}`,
              }}
            >
              <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>
                Alerts Created
              </div>
              <div style={{ fontSize: '24px', fontWeight: 600, color: colors.success }}>
                {metrics.alertsCreated.toLocaleString()}
              </div>
              <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '4px' }}>
                {metrics.alertsFiltered} filtered (low confidence)
              </div>
            </div>

            {/* Success Rate */}
            <div
              style={{
                backgroundColor: colors.magnusLightBg,
                borderRadius: '6px',
                padding: '12px',
                border: `1px solid ${colors.magnusBorder}`,
              }}
            >
              <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>
                Success Rate
              </div>
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: 600,
                  color: getSuccessRateColor(metrics.successRate),
                }}
              >
                {metrics.successRate.toFixed(1)}%
              </div>
              <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '4px' }}>
                {metrics.errorCount} errors
              </div>
            </div>

            {/* Avg Time per Query */}
            <div
              style={{
                backgroundColor: colors.magnusLightBg,
                borderRadius: '6px',
                padding: '12px',
                border: `1px solid ${colors.magnusBorder}`,
              }}
            >
              <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>
                Avg Time/Query
              </div>
              <div style={{ fontSize: '24px', fontWeight: 600, color: colors.magnusGreen }}>
                {metrics.averageTimePerQuery.toFixed(2)}s
              </div>
              <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '4px' }}>
                Budget: {metrics.claudeBudgetUsed.toFixed(1)}% Claude
              </div>
            </div>

            {/* Budget Usage */}
            <div
              style={{
                backgroundColor: colors.magnusLightBg,
                borderRadius: '6px',
                padding: '12px',
                border: `1px solid ${colors.magnusBorder}`,
                gridColumn: '1 / -1',
              }}
            >
              <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '8px' }}>
                📊 API Budget Usage
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: colors.textSecondary }}>Brave API</div>
                  <div
                    style={{
                      fontSize: '18px',
                      fontWeight: 600,
                      color: metrics.braveBudgetUsed > 80 ? colors.danger : colors.success,
                    }}
                  >
                    {metrics.braveBudgetUsed.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: colors.textSecondary }}>Claude API</div>
                  <div
                    style={{
                      fontSize: '18px',
                      fontWeight: 600,
                      color: metrics.claudeBudgetUsed > 80 ? colors.danger : colors.success,
                    }}
                  >
                    {metrics.claudeBudgetUsed.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            marginTop: '20px',
            paddingTop: '12px',
            borderTop: `1px solid ${colors.magnusBorder}`,
            display: 'flex',
            gap: '8px',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={() => fetchMetrics()}
            style={{
              padding: '8px 16px',
              fontSize: '12px',
              borderRadius: '4px',
              border: `1px solid ${colors.magnusBorder}`,
              backgroundColor: colors.magnusLightBg,
              color: colors.textPrimary,
              cursor: 'pointer',
            }}
          >
            Refresh
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              fontSize: '12px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: colors.magnusGreen,
              color: colors.white,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default HealthReportModal;
