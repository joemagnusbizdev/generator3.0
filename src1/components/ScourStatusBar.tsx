import React from 'react';

interface ScourStatusBarProps {
  job: {
    id: string;
    status: 'running' | 'done' | 'error';
    total: number;
    processed: number;
    created: number;
    ai_engaged?: boolean;
  } | null;
  isRunning: boolean;
}

export function ScourStatusBar({ job, isRunning }: ScourStatusBarProps) {
  if (!job && !isRunning) return null;

  const progress = job ? (job.processed / job.total) * 100 : 0;
  const isComplete = job?.status === 'done';

  return (
    <div style={{
      padding: '1rem',
      backgroundColor: isComplete ? '#d4edda' : '#fff3cd',
      border: `1px solid ${isComplete ? '#c3e6cb' : '#ffc107'}`,
      borderRadius: '8px',
      marginBottom: '1rem'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h4 style={{ margin: 0, fontSize: '1rem' }}>
          {isComplete ? ' Scour Complete' : ' Scour in Progress'}
        </h4>
        {job?.ai_engaged && (
          <span style={{
            padding: '0.25rem 0.5rem',
            backgroundColor: '#007bff',
            color: 'white',
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontWeight: 'bold'
          }}>
             AI ENGAGED
          </span>
        )}
      </div>

      {job && (
        <>
          <div style={{
            width: '100%',
            height: '20px',
            backgroundColor: '#e9ecef',
            borderRadius: '10px',
            overflow: 'hidden',
            marginBottom: '0.5rem'
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              backgroundColor: isComplete ? '#28a745' : '#ffc107',
              transition: 'width 0.3s ease'
            }} />
          </div>

          <div style={{ fontSize: '0.875rem', color: '#666' }}>
            <strong>{job.processed}</strong> / {job.total} sources processed
            {job.created > 0 && `  ${job.created} alerts created`}
          </div>
        </>
      )}
    </div>
  );
}




