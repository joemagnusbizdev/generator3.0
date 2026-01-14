import React from 'react';
import { useScour } from './ScourContext';

const ScourStatusBarInline: React.FC = () => {
  const {
    isScouring,
    scourJob,
    jobId,
    lastResult,
    lastError,
    lastStartedAt,
    lastFinishedAt,
  } = useScour();

  // Don't show if no activity
  if (!isScouring && !lastResult && !lastError && !scourJob) {
    return null;
  }

  // Current job in progress
  if (isScouring && scourJob) {
    const progress = scourJob.total > 0 
      ? Math.round((scourJob.processed / scourJob.total) * 100) 
      : 0;

    return (
      <div style={{
        padding: '12px 16px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '8px',
        marginBottom: '16px',
        color: 'white',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="spinner" style={{
            width: '20px',
            height: '20px',
            border: '3px solid rgba(255,255,255,0.3)',
            borderTop: '3px solid white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>
              Scour in Progress
            </div>
            <div style={{ fontSize: '13px', opacity: 0.9 }}>
              Processing {scourJob.processed} of {scourJob.total} sources • 
              {scourJob.created} alerts created • 
              {scourJob.duplicatesSkipped || 0} duplicates skipped
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700 }}>
            {progress}%
          </div>
        </div>
        
        {/* Progress bar */}
        <div style={{
          marginTop: '8px',
          height: '6px',
          background: 'rgba(255,255,255,0.2)',
          borderRadius: '3px',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            background: 'white',
            transition: 'width 0.3s ease',
            borderRadius: '3px',
          }} />
        </div>
      </div>
    );
  }

  // Completed - show last result
  if (lastResult && !isScouring) {
    return (
      <div style={{
        padding: '12px 16px',
        background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
        borderRadius: '8px',
        marginBottom: '16px',
        color: 'white',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '24px' }}>✓</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>
              Scour Completed
            </div>
            <div style={{ fontSize: '13px', opacity: 0.9 }}>
              {lastResult.processed} sources processed • 
              {lastResult.created} alerts created • 
              {lastResult.duplicatesSkipped} duplicates • 
              {lastResult.errorCount} errors
            </div>
          </div>
          {lastFinishedAt && (
            <div style={{ fontSize: '11px', opacity: 0.8 }}>
              {new Date(lastFinishedAt).toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Error state
  if (lastError && !isScouring) {
    return (
      <div style={{
        padding: '12px 16px',
        background: 'linear-gradient(135deg, #eb3349 0%, #f45c43 100%)',
        borderRadius: '8px',
        marginBottom: '16px',
        color: 'white',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '24px' }}>⚠</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>
              Scour Failed
            </div>
            <div style={{ fontSize: '13px', opacity: 0.9 }}>
              {lastError}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default ScourStatusBarInline;