/**
 * HealthCheckModal - System Health Check Popup
 * 
 * Tests all backend APIs and internal routing
 */
import React, { useState } from 'react';
import { apiFetchJson } from '../lib/utils/api';
import { colors, styles } from '../styles/inline';
import { buttons } from '../styles/designSystem';

interface HealthCheckResult {
  timestamp: string;
  checks: Record<string, any>;
  allHealthy: boolean;
}

interface HealthCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  accessToken?: string;
}

const HealthCheckModal: React.FC<HealthCheckModalProps> = ({ isOpen, onClose, accessToken }) => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<HealthCheckResult | null>(null);
  const [internalRoutes, setInternalRoutes] = useState<Record<string, any>>({});
  const [checkStarted, setCheckStarted] = useState(false);

  const runHealthCheck = async () => {
    setCheckStarted(true);
    setLoading(true);
    setResults(null);
    setInternalRoutes({});
    
    try {
      // First, test internal routing (should be faster)
      console.log('[Health Check] Starting internal route tests...');
      const routes = await testInternalRouting(accessToken);
      console.log('[Health Check] Internal routes:', routes);
      setInternalRoutes(routes);

      // Then run backend health check
      console.log('[Health Check] Starting backend health check...');
      const healthRes = await apiFetchJson<HealthCheckResult>('/health', accessToken);
      console.log('[Health Check] Backend health:', healthRes);
      setResults(healthRes as HealthCheckResult);
    } catch (e: any) {
      console.error('[Health Check] Error:', e);
      setResults({
        timestamp: new Date().toISOString(),
        checks: { error: { ok: false, message: e.message } },
        allHealthy: false,
      });
    } finally {
      setLoading(false);
    }
  };

  const testInternalRouting = async (token?: string): Promise<Record<string, any>> => {
    const routes: Record<string, any> = {
      '/alerts (GET)': { ok: false, message: 'Testing...' },
      '/admin/users (GET)': { ok: false, message: 'Testing...' },
      '/trends (GET)': { ok: false, message: 'Testing...' },
      '/status (GET)': { ok: false, message: 'Testing...' },
    };

    // Test each route with a timeout
    const testRoutes = [
      { key: '/alerts (GET)', path: '/alerts?limit=1' },
      { key: '/admin/users (GET)', path: '/admin/users' },
      { key: '/trends (GET)', path: '/trends' },
      { key: '/status (GET)', path: '/status' },
    ];

    for (const route of testRoutes) {
      try {
        console.log(`[Health Check] Testing ${route.key}...`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000); // 8 second timeout

        const res: any = await Promise.race([
          apiFetchJson(route.path, token),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout after 8s')), 8000))
        ]);

        clearTimeout(timeout);
        console.log(`[Health Check] ${route.key} response:`, res);
        routes[route.key] = {
          ok: !!res && res.ok !== false,
          message: !!res && res.ok !== false ? '✅ Responsive' : `⚠️ ${res?.error || 'Error response'}`,
        };
      } catch (e: any) {
        console.warn(`[Health Check] ${route.key} failed:`, e.message);
        routes[route.key] = {
          ok: false,
          message: `❌ ${e.message || 'Unknown error'}`,
        };
      }
    }

    return routes;
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '600px',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, marginBottom: '16px', color: colors.gray900 }}>
          🏥 System Health Check
        </h2>

        <button
          onClick={runHealthCheck}
          disabled={loading}
          style={{
            ...buttons.primary,
            width: '100%',
            marginBottom: '16px',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Running checks...' : '▶️ Run Health Check'}
        </button>

        {results && (
          <div>
            <div style={{ marginBottom: '16px', fontSize: '12px', color: colors.gray600 }}>
              Last checked: {new Date(results.timestamp).toLocaleTimeString()}
            </div>

            {/* Backend API Checks */}
            <h3 style={{ marginBottom: '12px', color: colors.gray800, fontSize: '14px', fontWeight: 600 }}>
              Backend APIs
            </h3>
            <div style={{ marginBottom: '16px', display: 'grid', gap: '8px' }}>
              {Object.entries(results.checks).map(([name, check]: [string, any]) => (
                <div
                  key={name}
                  style={{
                    padding: '12px',
                    backgroundColor: check.ok ? colors.green50 : colors.red50,
                    border: `1px solid ${check.ok ? colors.green200 : colors.red200}`,
                    borderRadius: '6px',
                    fontSize: '13px',
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                    {check.ok ? '✅' : '❌'} {name}
                  </div>
                  <div style={{ color: colors.gray600, fontSize: '12px' }}>
                    {check.message}
                  </div>
                  {check.tables && (
                    <div style={{ fontSize: '11px', marginTop: '4px', color: colors.gray500 }}>
                      Tables: {check.tables.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Internal Routing Checks */}
            <h3 style={{ marginBottom: '12px', color: colors.gray800, fontSize: '14px', fontWeight: 600 }}>
              Frontend to Backend Routes {loading ? '(Testing...)' : ''}
            </h3>
            <div style={{ marginBottom: '16px', display: 'grid', gap: '8px' }}>
              {Object.entries(internalRoutes).length > 0 ? (
                Object.entries(internalRoutes).map(([route, check]: [string, any]) => (
                  <div
                    key={route}
                    style={{
                      padding: '12px',
                      backgroundColor: check.ok ? colors.green50 : colors.red50,
                      border: `1px solid ${check.ok ? colors.green200 : colors.red200}`,
                      borderRadius: '6px',
                      fontSize: '13px',
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                      {check.ok ? '✅' : '❌'} {route}
                    </div>
                    <div style={{ color: colors.gray600, fontSize: '12px' }}>
                      {check.message}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '12px', color: colors.gray500, fontSize: '13px' }}>
                  {loading ? 'Testing routes...' : 'Run health check to test routes'}
                </div>
              )}
            </div>

            {/* Overall Status */}
            <div
              style={{
                padding: '12px',
                backgroundColor: results.allHealthy ? colors.green50 : colors.orange50,
                border: `2px solid ${results.allHealthy ? colors.green500 : colors.orange500}`,
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
                textAlign: 'center',
              }}
            >
              {results.allHealthy ? '✅ All Systems Healthy' : '⚠️ Some Systems Have Issues'}
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            ...buttons.secondary,
            width: '100%',
            marginTop: '16px',
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default HealthCheckModal;
