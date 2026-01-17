import React, { useState, useEffect } from 'react';
import { apiFetchJson, apiPostJson } from '../lib/utils/api';

interface AutoScourSettingsProps {
  accessToken?: string;
  isAdmin: boolean;
}

interface AutoScourStatus {
  enabled: boolean;
  intervalMinutes: number;
  lastRun: string | null;
  envEnabled: boolean;
}

export function AutoScourSettings({ accessToken, isAdmin }: AutoScourSettingsProps) {
  const [status, setStatus] = useState<AutoScourStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [running, setRunning] = useState(false);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const result = await apiFetchJson<{ ok: boolean } & AutoScourStatus>('/auto-scour/status', accessToken);
      
      if (result.ok) {
        setStatus({
          enabled: result.enabled,
          intervalMinutes: result.intervalMinutes,
          lastRun: result.lastRun,
          envEnabled: result.envEnabled,
        });
      }
    } catch (err) {
      console.error('Failed to load auto-scour status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadStatus();
    }
  }, [isAdmin, accessToken]);

  const handleToggle = async () => {
    if (!status) return;

    try {
      setToggling(true);
      const result = await apiPostJson<{ ok: boolean; enabled: boolean; message: string }>(
        '/auto-scour/toggle',
        { enabled: !status.enabled, intervalMinutes: status.intervalMinutes },
        accessToken
      );

      if (result.ok) {
        setStatus({ ...status, enabled: result.enabled });
        alert(result.message);
      }
    } catch (err: any) {
      console.error('Failed to toggle auto-scour:', err);
      alert('Failed to toggle auto-scour: ' + err.message);
    } finally {
      setToggling(false);
    }
  };

  const handleRunNow = async () => {
    try {
      setRunning(true);
      const result = await apiPostJson<{ ok: boolean; jobId: string; message: string }>(
        '/auto-scour/run-now',
        {},
        accessToken
      );

      if (result.ok) {
        alert(result.message + '\nJob ID: ' + result.jobId);
        await loadStatus();
      }
    } catch (err: any) {
      console.error('Failed to run auto-scour:', err);
      alert('Failed to run auto-scour: ' + err.message);
    } finally {
      setRunning(false);
    }
  };

  if (!isAdmin) {
    return null;
  }

  if (loading) {
    return (
      <div style={{
        padding: '1.5rem',
        backgroundColor: '#f9fafb',
        borderRadius: '0.5rem',
        border: '1px solid #e5e7eb',
      }}>
        <div style={{ color: '#6b7280' }}>Loading auto-scour settings...</div>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  const containerStyle: React.CSSProperties = {
    padding: '1.5rem',
    backgroundColor: status.enabled ? '#ecfdf5' : '#f9fafb',
    borderRadius: '0.5rem',
    border: `2px solid ${status.enabled ? '#10b981' : '#e5e7eb'}`,
    marginBottom: '2rem',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1rem',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '1.125rem',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  };

  const badgeStyle: React.CSSProperties = {
    padding: '0.25rem 0.75rem',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: '600',
    backgroundColor: status.enabled ? '#10b981' : '#6b7280',
    color: 'white',
  };

  const infoStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
    marginBottom: '1rem',
    fontSize: '0.875rem',
    color: '#4b5563',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '0.5rem 1rem',
    borderRadius: '0.375rem',
    border: 'none',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    marginRight: '0.5rem',
  };

  const toggleButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: status.enabled ? '#ef4444' : '#10b981',
    color: 'white',
  };

  const runNowButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: '#3b82f6',
    color: 'white',
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={titleStyle}>
          <span>Ã¢Å¡Â¡</span>
          <span>Auto Scour (Admin)</span>
          <span style={badgeStyle}>
            {status.enabled ? 'ENABLED' : 'DISABLED'}
          </span>
        </div>
      </div>

      <div style={infoStyle}>
        <div>
          <strong>Interval:</strong> Every {status.intervalMinutes} minutes
        </div>
        <div>
          <strong>Last Run:</strong>{' '}
          {status.lastRun ? new Date(status.lastRun).toLocaleString() : 'Never'}
        </div>
        <div>
          <strong>Env Status:</strong>{' '}
          <span style={{ color: status.envEnabled ? '#10b981' : '#ef4444' }}>
            {status.envEnabled ? 'Ã¢Å“â€œ Enabled' : 'Ã¢Å“â€” Disabled'}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button
          onClick={handleToggle}
          disabled={toggling}
          style={{
            ...toggleButtonStyle,
            opacity: toggling ? 0.6 : 1,
            cursor: toggling ? 'not-allowed' : 'pointer',
          }}
        >
          {toggling ? 'Ã¢Å¸Â³ Toggling...' : status.enabled ? 'Ã¢ÂÂ¸ Disable Auto Scour' : 'Ã¢â€“Â¶ Enable Auto Scour'}
        </button>

        {status.enabled && (
          <button
            onClick={handleRunNow}
            disabled={running}
            style={{
              ...runNowButtonStyle,
              opacity: running ? 0.6 : 1,
              cursor: running ? 'not-allowed' : 'pointer',
            }}
          >
            {running ? 'Ã¢Å¸Â³ Running...' : 'Ã°Å¸Å¡â‚¬ Run Now'}
          </button>
        )}

        <div style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#6b7280' }}>
          {status.enabled ? 'Ã°Å¸Å¸Â¢ Automatically scouring sources' : 'Ã°Å¸â€Â´ Manual scour only'}
        </div>
      </div>

      {!status.envEnabled && (
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          backgroundColor: '#fef3c7',
          color: '#92400e',
          borderRadius: '0.375rem',
          fontSize: '0.875rem',
        }}>
          Ã¢Å¡Â Ã¯Â¸Â <strong>Warning:</strong> AUTO_SCOUR_ENABLED environment variable is disabled in edge function.
          Set it to "true" in Supabase dashboard for cron to work.
        </div>
      )}
    </div>
  );
}

