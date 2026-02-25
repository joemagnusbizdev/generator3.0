import React, { useEffect, useState } from 'react';
import { useScour } from './ScourContext';

interface Source {
  id: string;
  name: string;
  type: string;
  url: string;
  enabled: boolean;
  last_scoured_at?: string | null;
}

interface SourceGroup {
  id: string;
  type: string;
  name: string;
  sources: Source[];
  status: 'pending' | 'running' | 'completed' | 'error';
  results?: {
    alerts_created: number;
    duplicates_skipped: number;
    errors: number;
    disabled_sources: number;
    disabled_source_ids: string[];
  };
  error?: string;
  lastScourTime?: string;
}

interface ScourManagementProps {
  accessToken: string;
}

export default function ScourManagementInline({ accessToken }: ScourManagementProps) {
  const [sourceGroups, setSourceGroups] = useState<SourceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningGroupId, setRunningGroupId] = useState<string | null>(null);
  const [allComplete, setAllComplete] = useState(false);
  const [statusMessages, setStatusMessages] = useState<Record<string, string>>({});
  const [lastSourceCount, setLastSourceCount] = useState<number>(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activityLogs, setActivityLogs] = useState<Record<string, Array<{ time: string; message: string }>>>({});
  const [expandedActivityLogs, setExpandedActivityLogs] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAndGroupSources();
    
    // Poll for new sources every 10 seconds
    const interval = setInterval(() => {
      loadAndGroupSources();
    }, 10000);

    return () => clearInterval(interval);
  }, [accessToken]);

  // Poll for activity logs while any scour is running
  useEffect(() => {
    if (!runningGroupId) return;

    const pollActivityLogs = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clever-function/scour/status?jobId=${encodeURIComponent(runningGroupId)}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.job?.activityLog && Array.isArray(data.job.activityLog)) {
            setActivityLogs(prev => ({ ...prev, [runningGroupId]: data.job.activityLog }));
            // Auto-expand logs section when logs appear
            if (data.job.activityLog.length > 0 && !expandedActivityLogs.has(runningGroupId)) {
              setExpandedActivityLogs(prev => new Set([...prev, runningGroupId]));
            }
          }
        }
      } catch (e) {
        // Silently fail
      }
    };

    // Poll every 500ms for live updates
    const interval = setInterval(pollActivityLogs, 500);
    return () => clearInterval(interval);
  }, [runningGroupId, accessToken]);

  const addStatusMessage = (groupId: string, message: string) => {
    setStatusMessages(prev => ({ ...prev, [groupId]: message }));
  };

  // Parse log message to extract just the query and country
  const parseActivityLogMessage = (message: string): string => {
    // Format: [progress bar] N/TOTAL (%)% - "query" in Country → status
    // Extract: "query" in Country
    const match = message.match(/-\s+"([^"]+)"\s+in\s+([^→]+)→/);
    if (match) {
      return `${match[1]} • ${match[2].trim()}`;
    }
    // Fallback to original if format doesn't match
    return message.replace(/^\[[█░\s]+\]\s+\d+\/\d+\s+\(\d+%\)\s+-\s+/, '');
  };

  const loadAndGroupSources = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/sources?enabled=eq.true&select=*,last_scoured_at&order=type,name`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error('Failed to load sources');
      const sources: Source[] = await response.json();

      // Only update if source count changed
      if (sources.length === lastSourceCount) {
        return;
      }

      setLastSourceCount(sources.length);

      const groupedByType = new Map<string, Source[]>();
      sources.forEach(source => {
        const type = source.type || 'other';
        if (!groupedByType.has(type)) groupedByType.set(type, []);
        groupedByType.get(type)!.push(source);
      });

      // Use the latest sourceGroups from state callback
      setSourceGroups(prevSourceGroups => {
        const groups: SourceGroup[] = [];

        // Add Early Signals as first group, preserving its state if it exists
        const existingEarlySignals = prevSourceGroups.find(g => g.id === 'early-signals');
        console.log(`[Polling] Early signals state:`, { 
          exists: !!existingEarlySignals, 
          status: existingEarlySignals?.status,
          lastScourTime: existingEarlySignals?.lastScourTime 
        });
        groups.push({
          id: 'early-signals',
          type: 'early_signals',
          name: 'Early Signals Scour',
          sources: [],
          status: existingEarlySignals?.status || 'pending',
          lastScourTime: existingEarlySignals?.lastScourTime,
          results: existingEarlySignals?.results,
        });

        groupedByType.forEach((typeSourceList, type) => {
          for (let i = 0; i < typeSourceList.length; i += 50) {
            const batch = typeSourceList.slice(i, i + 50);
            const groupIndex = Math.floor(i / 50);
            const groupId = `${type}-${groupIndex}`;
            
            // Preserve existing group state if it exists
            const existingGroup = prevSourceGroups.find(g => g.id === groupId);
            
            // Get the most recent scour time from sources in this batch
            const mostRecentScourTime = batch
              .filter(s => s.last_scoured_at)
              .map(s => new Date(s.last_scoured_at!).getTime())
              .sort((a, b) => b - a)[0];
            
            groups.push({
              id: groupId,
              type,
              name: `${type.charAt(0).toUpperCase() + type.slice(1)} - Group ${groupIndex + 1} (${batch.length} sources)`,
              sources: batch,
              status: existingGroup?.status || 'pending',
              lastScourTime: existingGroup?.lastScourTime || (mostRecentScourTime ? new Date(mostRecentScourTime).toISOString() : undefined),
              results: existingGroup?.results,
            });
          }
        });

        return groups;
      });
      setLoading(false);
    } catch (e) {
      console.error('Failed to load sources:', e);
      setLoading(false);
    }
  };

  const runGroup = async (groupId: string) => {
    const group = sourceGroups.find(g => g.id === groupId);
    if (!group || runningGroupId !== null) return;

    setRunningGroupId(groupId);
    setSourceGroups(prev => prev.map(g => g.id === groupId ? { ...g, status: 'running' } : g));
    addStatusMessage(groupId, 'Starting...');

    const now = new Date().toISOString(); // Set timestamp at the start

    try {
      const statusMsg = groupId === 'early-signals' 
        ? 'Running web search scour...' 
        : `Scouring ${group.sources.length} sources...`;
      addStatusMessage(groupId, statusMsg);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clever-function/scour/run?t=${Date.now()}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
          body: JSON.stringify({
            jobId: groupId,
            sourceIds: groupId === 'early-signals' ? [] : group.sources.map(s => s.id),
            earlySignalsOnly: groupId === 'early-signals',
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(error.error || `Scour failed with status ${response.status}`);
      }

      const result = await response.json();
      
      // If job is queued, poll for completion instead of getting immediate results
      if (result.status === 'queued') {
        addStatusMessage(groupId, 'Job queued, polling for status...');
        
        // Poll for job completion
        let jobComplete = false;
        let pollCount = 0;
        const maxPolls = 1800; // 15 minutes with 500ms interval
        
        while (!jobComplete && pollCount < maxPolls) {
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms between polls
          pollCount++;
          
          try {
            const statusResponse = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clever-function/scour/status?jobId=${encodeURIComponent(groupId)}`,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              }
            );
            
            if (statusResponse.ok) {
              const statusData = await statusResponse.json();
              const job = statusData.job;
              
              if (job && (job.status === 'done' || job.status === 'error')) {
                jobComplete = true;
                
                // Extract results from job data
                const alerts = job.created || 0;
                const dupes = job.duplicatesSkipped || 0;
                const errors = job.errorCount || 0;
                const disabledSourceIds = job.disabled_source_ids || [];
                
                if (errors > 0 && disabledSourceIds.length === 0) {
                  addStatusMessage(groupId, `⚠️ Created ${alerts} alerts, ${dupes} dupes, ${errors} errors (sources with errors will be disabled)`);
                } else {
                  addStatusMessage(groupId, `Created ${alerts} alerts, ${dupes} dupes`);
                }
                
                // Update completion timestamp to current time
                const completionTime = new Date().toISOString();
                setSourceGroups(prev =>
                  prev.map(g =>
                    g.id === groupId
                      ? { 
                          ...g, 
                          status: job.status === 'error' ? 'error' : 'completed', 
                          lastScourTime: completionTime,
                          sources: groupId === 'early-signals' ? g.sources : g.sources.filter(s => !disabledSourceIds.includes(s.id)),
                          results: { 
                            alerts_created: alerts, 
                            duplicates_skipped: dupes, 
                            errors: errors, 
                            disabled_sources: disabledSourceIds.length, 
                            disabled_source_ids: disabledSourceIds 
                          } 
                        }
                      : g
                  )
                );
              } else if (job && job.status === 'running') {
                // Still running, show progress
                const processed = job.processed || 0;
                const total = job.total || '?';
                addStatusMessage(groupId, `Running: ${processed}/${total} sources processed...`);
              }
            }
          } catch (pollError) {
            // Polling error, continue trying
            console.log(`[Scour polling] Error polling status:`, pollError);
          }
        }
        
        if (!jobComplete) {
          throw new Error('Scour job polling timeout (15 minutes elapsed)');
        }
        
        const allDone = sourceGroups.every(g => g.id === groupId || g.status === 'completed');
        if (allDone) setAllComplete(true);
        return;
      }
      
      // Synchronous response (for non-queued jobs)
      const alerts = result.created || 0;
      const dupes = result.duplicatesSkipped || 0;
      const errors = result.errorCount || 0;
      const disabledSourceIds = result.disabled_source_ids || result.error_source_ids || [];
      
      if (errors > 0 && disabledSourceIds.length === 0) {
        addStatusMessage(groupId, `⚠️ Created ${alerts} alerts, ${dupes} dupes, ${errors} errors (sources with errors will be disabled)`);
      } else {
        addStatusMessage(groupId, `Created ${alerts} alerts, ${dupes} dupes`);
      }

      // Update group with results and disabled sources
      const completionTime = new Date().toISOString();
      setSourceGroups(prev =>
        prev.map(g =>
          g.id === groupId
            ? { 
                ...g, 
                status: 'completed', 
                lastScourTime: completionTime,
                // Remove disabled sources from the group (only for non-Early Signals)
                sources: groupId === 'early-signals' ? g.sources : g.sources.filter(s => !disabledSourceIds.includes(s.id)),
                results: { 
                  alerts_created: alerts, 
                  duplicates_skipped: dupes, 
                  errors: errors, 
                  disabled_sources: disabledSourceIds.length, 
                  disabled_source_ids: disabledSourceIds 
                } 
              }
            : g
        )
      );

      if (disabledSourceIds.length > 0 && groupId !== 'early-signals') {
        addStatusMessage(groupId, `Disabling ${disabledSourceIds.length} sources due to errors...`);
        for (const sourceId of disabledSourceIds) {
          await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/sources?id=eq.${sourceId}`,
            {
              method: 'PATCH',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ enabled: false }),
            }
          );
        }
        addStatusMessage(groupId, 'Done');
      }

      const allDone = sourceGroups.every(g => g.id === groupId || g.status === 'completed');
      if (allDone) setAllComplete(true);
    } catch (e: any) {
      const errorMsg = e.message || 'Unknown error';
      const now = new Date().toISOString();
      
      // If 504 timeout and not Early Signals, retry with batching
      if (errorMsg.includes('504') && groupId !== 'early-signals') {
        addStatusMessage(groupId, `⚠️ ${errorMsg} - Retrying with batch processing...`);
        
        try {
          // Split sources into batches of 10 and process each
          const sources = group.sources;
          const batchSize = 10;
          const batches = Math.ceil(sources.length / batchSize);
          let totalAlerts = 0;
          let totalDupes = 0;
          let totalErrors = 0;
          const allDisabledSources: string[] = [];

          for (let batch = 0; batch < batches; batch++) {
            const offset = batch * batchSize;
            addStatusMessage(groupId, `Processing batch ${batch + 1}/${batches} (${offset + 1}-${Math.min(offset + batchSize, sources.length)} of ${sources.length} sources)...`);

            const response = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clever-function/scour/run?t=${Date.now()}`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                  'Cache-Control': 'no-cache, no-store, must-revalidate',
                  'Pragma': 'no-cache',
                },
                body: JSON.stringify({
                  jobId: groupId,
                  sourceIds: sources.slice(offset, offset + batchSize).map((s: any) => s.id),
                  batchOffset: offset,
                  batchSize: batchSize,
                }),
              }
            );

            if (!response.ok) {
              const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
              throw new Error(`Batch ${batch + 1} failed: ${error.error || response.statusText}`);
            }

            const result = await response.json();
            totalAlerts += result.created || 0;
            totalDupes += result.duplicatesSkipped || 0;
            totalErrors += result.errorCount || 0;
            if (result.disabled_source_ids) {
              allDisabledSources.push(...result.disabled_source_ids);
            }
          }

          addStatusMessage(groupId, `Created ${totalAlerts} alerts (batch mode), ${totalDupes} dupes`);
          
          const batchCompletionTime = new Date().toISOString();
          setSourceGroups(prev =>
            prev.map(g =>
              g.id === groupId
                ? { 
                    ...g, 
                    status: 'completed', 
                    lastScourTime: batchCompletionTime,
                    sources: g.sources.filter(s => !allDisabledSources.includes(s.id)),
                    results: { 
                      alerts_created: totalAlerts, 
                      duplicates_skipped: totalDupes, 
                      errors: totalErrors, 
                      disabled_sources: allDisabledSources.length, 
                      disabled_source_ids: allDisabledSources 
                    } 
                  }
                : g
            )
          );
        } catch (batchError: any) {
          addStatusMessage(groupId, `Error: ${batchError.message}`);
          const errorTime = new Date().toISOString();
          setSourceGroups(prev => prev.map(g => 
            g.id === groupId 
              ? { ...g, status: 'error', error: batchError.message, lastScourTime: errorTime } 
              : g
          ));
        }
      } else {
        // Not a 504 timeout or is Early Signals - regular error handling
        addStatusMessage(groupId, `Error: ${errorMsg}`);
        const finalErrorTime = new Date().toISOString();
        setSourceGroups(prev => prev.map(g => 
          g.id === groupId 
            ? { ...g, status: 'error', error: errorMsg, lastScourTime: finalErrorTime } 
            : g
        ));
      }
    } finally {
      setRunningGroupId(null);
    }
  };

  const stopAllScours = () => {
    setRunningGroupId(null);
    setSourceGroups(prev =>
      prev.map(g => (g.status === 'running' ? { ...g, status: 'pending' } : g))
    );
    setStatusMessages({});
  };

  if (loading) {
    return <div className="text-sm text-gray-500">Loading sources...</div>;
  }

  // Get most recent scour time from any group
  const mostRecentScour = sourceGroups
    .filter(g => g.lastScourTime)
    .map(g => new Date(g.lastScourTime!).getTime())
    .sort((a, b) => b - a)[0];
  
  const formatTime = (timestamp?: string) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-4">
        <div 
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex-1 cursor-pointer flex items-center gap-2 hover:opacity-80"
        >
          <span className="text-lg">{isExpanded ? '▼' : '▶'}</span>
          <div className="flex flex-col">
            <h3 className="font-bold text-base">📊 Scour Management</h3>
            {!isExpanded && mostRecentScour && (
              <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                ⏱ Last scour: {formatTime(sourceGroups.find(g => g.lastScourTime && new Date(g.lastScourTime).getTime() === mostRecentScour)?.lastScourTime)}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={stopAllScours}
            className="text-xs px-3 py-1 rounded bg-orange-600 text-white hover:bg-orange-700 cursor-pointer font-semibold"
            style={{ opacity: 1, pointerEvents: 'auto' }}
          >
            ⊗ Force Stop
          </button>
          {allComplete && <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded">✅ Complete</span>}
        </div>
      </div>

      {isExpanded && (
        <div className="grid grid-cols-2 gap-4">
          {/* Left Column: List of Groups */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-600 uppercase">Scour Groups</h4>
            {sourceGroups.map(group => {
              const isRunning = runningGroupId === group.id;
              
              return (
                <div
                  key={group.id}
                  className={`border rounded p-2 text-xs transition-colors ${
                    group.status === 'completed'
                      ? 'bg-green-100 border-green-300'
                      : group.status === 'error'
                      ? 'bg-red-100 border-red-300'
                      : isRunning
                      ? 'bg-blue-100 border-blue-300'
                      : 'bg-white border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-xs">{group.name}</div>
                      {group.lastScourTime && (
                        <div className="text-xs font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded mt-1 inline-block">⏱ {formatTime(group.lastScourTime)}</div>
                      )}
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-1">
                      {group.status === 'pending' && (
                        <button
                          onClick={() => runGroup(group.id)}
                          disabled={runningGroupId !== null}
                          className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          Run
                        </button>
                      )}
                      {isRunning && (
                        <div className="animate-spin w-3 h-3 border-2 border-blue-400 border-t-blue-600 rounded-full" />
                      )}
                      {group.status === 'completed' && <span className="text-green-700 font-bold">✓</span>}
                      {group.status === 'error' && <span className="text-red-700 font-bold">✗</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Results and Status */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-600 uppercase">Results & Status</h4>
            {sourceGroups.map(group => {
              const statusMsg = statusMessages[group.id];
              
              return (
                <div key={group.id} className="border rounded p-2 bg-white text-xs">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-xs">{group.name}</div>
                  </div>
                  {group.lastScourTime && (
                    <div className="mb-2 font-semibold text-sm text-blue-600 bg-blue-50 px-2 py-1.5 rounded border border-blue-200">
                      ✓ Scoured: {formatTime(group.lastScourTime)}
                    </div>
                  )}
                  {statusMsg && (
                    <div className="text-xs text-gray-700 mb-2">{statusMsg}</div>
                  )}
                  
                  {/* Activity Log for running scours */}
                  {(() => {
                    const isRunning = runningGroupId === group.id;
                    const hasLogs = activityLogs[group.id];
                    const logCount = hasLogs?.length || 0;
                    
                    if (isRunning && logCount > 0) {
                      return (
                        <div className="mb-2 border rounded bg-gray-50 overflow-hidden">
                          <button
                            onClick={() => {
                              const newExpanded = new Set(expandedActivityLogs);
                              if (newExpanded.has(group.id)) {
                                newExpanded.delete(group.id);
                              } else {
                                newExpanded.add(group.id);
                              }
                              setExpandedActivityLogs(newExpanded);
                            }}
                            className="w-full text-left px-2 py-1 hover:bg-gray-200 font-semibold text-xs flex items-center justify-between"
                          >
                            <span>📋 Activity Log ({logCount})</span>
                            <span>{expandedActivityLogs.has(group.id) ? '▼' : '▶'}</span>
                          </button>
                          
                          {expandedActivityLogs.has(group.id) && (
                            <div className="max-h-48 overflow-y-auto border-t bg-white">
                              {activityLogs[group.id].slice(-15).reverse().map((log, idx) => (
                                <div
                                  key={idx}
                                  className="px-2 py-1 border-b text-xs text-gray-700 hover:bg-blue-50"
                                  title={log.message}
                                >
                                  <span className="text-gray-500 font-mono text-xs">{new Date(log.time).toLocaleTimeString()}</span>
                                  <span className="ml-2 text-gray-800">🔍 {parseActivityLogMessage(log.message)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })()}
                  {group.results && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1">
                        <span className="text-green-700">✓</span>
                        <span>{group.results.alerts_created} alerts</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-700">∼</span>
                        <span>{group.results.duplicates_skipped} dupes</span>
                      </div>
                      {group.results.errors > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="text-red-700">✗</span>
                          <span>{group.results.errors} errors</span>
                        </div>
                      )}
                      {group.results.disabled_sources > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="text-orange-700">⊘</span>
                          <span>{group.results.disabled_sources} disabled</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
