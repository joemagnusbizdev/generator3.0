import React, { useEffect, useState } from 'react';

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

  useEffect(() => {
    loadAndGroupSources();
    
    // Poll for new sources every 10 seconds
    const interval = setInterval(() => {
      loadAndGroupSources();
    }, 10000);

    return () => clearInterval(interval);
  }, [accessToken]);

  const addStatusMessage = (groupId: string, message: string) => {
    setStatusMessages(prev => ({ ...prev, [groupId]: message }));
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

      const groups: SourceGroup[] = [];

      // Add Early Signals as first group
      groups.push({
        id: 'early-signals',
        type: 'early_signals',
        name: 'Early Signals Scour',
        sources: [],
        status: 'pending',
        lastScourTime: undefined,
      });

      groupedByType.forEach((typeSourceList, type) => {
        for (let i = 0; i < typeSourceList.length; i += 50) {
          const batch = typeSourceList.slice(i, i + 50);
          const groupIndex = Math.floor(i / 50);
          
          // Get the most recent scour time from sources in this batch
          const mostRecentScourTime = batch
            .filter(s => s.last_scoured_at)
            .map(s => new Date(s.last_scoured_at!).getTime())
            .sort((a, b) => b - a)[0];
          
          groups.push({
            id: `${type}-${groupIndex}`,
            type,
            name: `${type.charAt(0).toUpperCase() + type.slice(1)} - Group ${groupIndex + 1} (${batch.length} sources)`,
            sources: batch,
            status: 'pending',
            lastScourTime: mostRecentScourTime ? new Date(mostRecentScourTime).toISOString() : undefined,
          });
        }
      });

      setSourceGroups(groups);
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

    try {
      if (groupId === 'early-signals') {
        addStatusMessage(groupId, 'Triggering early signals...');
        
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scour-worker`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              jobId: 'early-signals-' + Date.now(),
              earlySignalsOnly: true,
            }),
          }
        );

        if (!response.ok) throw new Error(`Failed: ${response.status}`);
        
        const result = await response.json();
        const alerts = result.created || 0;
        const dupes = result.duplicatesSkipped || 0;
        const errors = result.errorCount || 0;
        
        setSourceGroups(prev =>
          prev.map(g =>
            g.id === groupId
              ? { 
                  ...g, 
                  status: 'completed', 
                  results: { 
                    alerts_created: alerts, 
                    duplicates_skipped: dupes, 
                    errors: errors, 
                    disabled_sources: 0, 
                    disabled_source_ids: [] 
                  } 
                }
              : g
          )
        );
        
        // Reload sources to get updated last_scoured_at from database (for multi-user sync)
        await loadAndGroupSources();
        addStatusMessage(groupId, `Complete: ${alerts} alerts, ${dupes} dupes`);
      } else {
        addStatusMessage(groupId, `Scouring ${group.sources.length} sources...`);

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scour-worker`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              jobId: groupId,
              sourceIds: group.sources.map(s => s.id),
            }),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Scour failed');
        }

        const result = await response.json();
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
        setSourceGroups(prev =>
          prev.map(g =>
            g.id === groupId
              ? { 
                  ...g, 
                  status: 'completed', 
                  // Remove disabled sources from the group
                  sources: g.sources.filter(s => !disabledSourceIds.includes(s.id)),
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
        
        // Reload sources to get updated last_scoured_at from database (for multi-user sync)
        await loadAndGroupSources();

        if (disabledSourceIds.length > 0) {
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
      }

      const allDone = sourceGroups.every(g => g.id === groupId || g.status === 'completed');
      if (allDone) setAllComplete(true);
    } catch (e: any) {
      // Show error but keep any accumulated results
      const errorMsg = `Error: ${e.message}`;
      addStatusMessage(groupId, errorMsg);
      setSourceGroups(prev => prev.map(g => 
        g.id === groupId 
          ? { ...g, status: 'error', error: e.message } 
          : g
      ));
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
            disabled={!runningGroupId}
            className={`text-xs px-3 py-1 rounded ${
              runningGroupId
                ? 'bg-red-600 text-white hover:bg-red-700 cursor-pointer'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Force Stop
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
