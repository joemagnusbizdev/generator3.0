/**
 * ScourStatusBarInline - Status bar showing current scour job status
 */
import React from 'react';
import { useScour } from './ScourContext';
import { colors } from '../styles/inline';

// ============================================================================
// Component
// ============================================================================

export function ScourStatusBarInline(): JSX.Element | null {
  const { 
    jobId, 
    isScouring, 
    lastResult, 
    lastError,
    lastStartedAt,
    lastFinishedAt,
  } = useScour();

  // Don't render if no active job and no recent activity
  if (!jobId && !isScouring && !lastResult && !lastError) {
    return null;
  }

  const barStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: isScouring ? colors.magnusDarkGreen : (lastError ? colors.red[600] : colors.grayscale[700]),
    color: 'white',
    padding: '0.75rem 1rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.875rem',
    zIndex: 1000,
    boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
  };

  const leftStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  };

  const rightStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    fontSize: '0.75rem',
    opacity: 0.9,
  };

  const spinnerStyle: React.CSSProperties = {
    width: '16px',
    height: '16px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: 'white',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  };

  const progressStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  };

  const statStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  };

  // Build status message
  let statusMessage = '';
  if (isScouring && jobId) {
    statusMessage = `Scouring... Job ${jobId.slice(0, 8)}`;
  } else if (lastError) {
    statusMessage = `Error: ${lastError}`;
  } else if (lastResult?.status === 'done') {
    statusMessage = 'Scour completed';
  } else if (lastResult?.skipped) {
    statusMessage = `Skipped: ${lastResult.reason || 'No sources to process'}`;
  }

  // Calculate progress
  const progress = lastResult 
    ? {
        processed: lastResult.processed ?? 0,
        total: lastResult.total ?? 0,
        created: lastResult.created ?? 0,
        errors: lastResult.errorCount ?? 0,
      }
    : null;

  return (
    <>
      {/* Add keyframes for spinner animation */}
      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
      
      <div style={barStyle}>
        <div style={leftStyle}>
          {isScouring && <div style={spinnerStyle} />}
          <span style={{ fontWeight: 500 }}>{statusMessage}</span>
        </div>

        <div style={rightStyle}>
          {progress && progress.total > 0 && (
            <>
              <div style={progressStyle}>
                <span style={statStyle}>
                  📊 {progress.processed}/{progress.total}
                </span>
              </div>
              
              {progress.created > 0 && (
                <span style={statStyle}>
                  ✅ {progress.created} created
                </span>
              )}
              
              {progress.errors > 0 && (
                <span style={{ ...statStyle, color: colors.red[300] }}>
                  ⚠️ {progress.errors} errors
                </span>
              )}
            </>
          )}

          {lastFinishedAt && !isScouring && (
            <span style={{ opacity: 0.7 }}>
              Finished: {new Date(lastFinishedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>
    </>
  );
}

export default ScourStatusBarInline;
