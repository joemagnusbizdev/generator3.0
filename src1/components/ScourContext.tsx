import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { apiPostJson, apiFetchJson } from '../lib/utils/api';

interface ScourJob {
  id: string;
  status: 'running' | 'done' | 'error';
  total: number;
  processed: number;
  created: number;
  ai_engaged?: boolean;
  message?: string;
}

interface ScourContextType {
  isScouring: boolean;
  scourJob: ScourJob | null;
  startScour: (accessToken?: string) => Promise<void>;
  stopScour: () => void;
}

const ScourContext = createContext<ScourContextType | undefined>(undefined);

export function ScourProvider({ children, accessToken }: { children: React.ReactNode; accessToken?: string }) {
  const [isScouring, setIsScouring] = useState(false);
  const [scourJob, setScourJob] = useState<ScourJob | null>(null);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  // Poll job status
  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const result = await apiFetchJson<{ ok: boolean; job: ScourJob }>(
        `/scour/status?jobId=${jobId}`,
        accessToken
      );

      if (result.ok && result.job) {
        setScourJob(result.job);

        // If job is done or error, stop polling
        if (result.job.status === 'done' || result.job.status === 'error') {
          setIsScouring(false);
          if (pollInterval) {
            clearInterval(pollInterval);
            setPollInterval(null);
          }
          console.log('Scour job completed:', result.job);
        }
      }
    } catch (err) {
      console.error('Error polling scour status:', err);
    }
  }, [accessToken, pollInterval]);

  // Start scour
  const startScour = useCallback(async (token?: string) => {
    const authToken = token || accessToken;

    try {
      setIsScouring(true);
      
      // Get all enabled sources
      const sourcesResult = await apiFetchJson<{ ok: boolean; sources: any[] }>(
        '/sources',
        authToken
      );

      if (!sourcesResult.ok || !sourcesResult.sources) {
        throw new Error('Failed to load sources');
      }

      const sourceIds = sourcesResult.sources.filter(s => s.enabled).map(s => s.id);

      if (sourceIds.length === 0) {
        alert('No enabled sources. Please enable at least one source.');
        setIsScouring(false);
        return;
      }

      // Start scour job
      const result = await apiPostJson<{ ok: boolean; jobId: string; total: number }>(
        '/scour-sources',
        { sourceIds, daysBack: 14 },
        authToken
      );

      if (result.ok) {
        const newJob: ScourJob = {
          id: result.jobId,
          status: 'running',
          total: result.total,
          processed: 0,
          created: 0,
        };
        setScourJob(newJob);
        console.log('Scour job started:', result.jobId);

        // Start polling
        const interval = setInterval(() => {
          pollJobStatus(result.jobId);
        }, 3000); // Poll every 3 seconds
        setPollInterval(interval);
      } else {
        throw new Error('Failed to start scour');
      }
    } catch (err: any) {
      console.error('Error starting scour:', err);
      alert('Failed to start scour: ' + err.message);
      setIsScouring(false);
    }
  }, [accessToken, pollJobStatus]);

  // Stop scour
  const stopScour = useCallback(() => {
    setIsScouring(false);
    setScourJob(null);
    if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }
  }, [pollInterval]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [pollInterval]);

  return (
    <ScourContext.Provider value={{ isScouring, scourJob, startScour, stopScour }}>
      {children}
    </ScourContext.Provider>
  );
}

export function useScour() {
  const context = useContext(ScourContext);
  if (context === undefined) {
    throw new Error('useScour must be used within a ScourProvider');
  }
  return context;
}