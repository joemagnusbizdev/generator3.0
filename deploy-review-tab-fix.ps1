# MAGNUS Intelligence - Review Tab Fix Deployment Script
# This script deploys the fixed AlertReviewQueueInline component

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  MAGNUS Intelligence - Review Tab Fix         " -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Set project directory
$projectDir = "C:\Users\Joe Serkin\Documents\GitHub\generator3.0"
$componentPath = "$projectDir\src1\components\AlertReviewQueueInline.tsx"

# Check if project directory exists
if (-not (Test-Path $projectDir)) {
    Write-Host "ERROR: Project directory not found: $projectDir" -ForegroundColor Red
    exit 1
}

Write-Host "STEP 1: Backing up current component..." -ForegroundColor Yellow
if (Test-Path $componentPath) {
    $backupPath = "$componentPath.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item $componentPath $backupPath
    Write-Host "  Backed up to: $backupPath" -ForegroundColor Green
} else {
    Write-Host "  No existing component found (creating new)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "STEP 2: Deploying fixed component..." -ForegroundColor Yellow

$fixedComponent = @'
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

interface Alert {
  id: string;
  title: string;
  summary: string;
  location: string;
  country: string;
  region?: string;
  event_type: string;
  severity: 'critical' | 'warning' | 'caution' | 'informative';
  status: string;
  source_url: string;
  article_url?: string;
  sources?: string;
  event_start_date?: string;
  event_end_date?: string;
  ai_generated: boolean;
  ai_model?: string;
  ai_confidence?: number;
  created_at: string;
  updated_at: string;
}

export default function AlertReviewQueueInline() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState({
    severity: 'all',
    country: 'all',
  });

  useEffect(() => {
    console.log('AlertReviewQueue mounted - fetching alerts...');
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching alerts from endpoint...');
      
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('Not authenticated - please log in');
      }
      
      console.log('Token obtained, calling endpoint...');
      
      const response = await fetch(
        'https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function/alerts/review',
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch alerts: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Response data:', data);
      
      if (data.ok && data.alerts) {
        console.log(`Found ${data.alerts.length} alerts`);
        setAlerts(data.alerts);
      } else {
        console.warn('Unexpected response format:', data);
        setAlerts([]);
      }
      
    } catch (err: any) {
      console.error('Error loading alerts:', err);
      setError(err.message || 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filter.severity !== 'all' && alert.severity !== filter.severity) return false;
    if (filter.country !== 'all' && alert.country !== filter.country) return false;
    return true;
  });

  const uniqueCountries = Array.from(new Set(alerts.map(a => a.country))).sort();

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'caution': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'informative': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading alerts...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-red-600 text-xl">⚠️</span>
          <h3 className="text-red-800 font-semibold">Error Loading Alerts</h3>
        </div>
        <p className="text-red-700 mb-3">{error}</p>
        <button
          onClick={loadAlerts}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="text-6xl mb-4">📋</div>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">No Alerts Yet</h3>
        <p className="text-gray-500 mb-4">Run a scour to generate travel safety alerts</p>
        <button
          onClick={loadAlerts}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Alert Review Queue</h2>
          <p className="text-gray-600">
            {filteredAlerts.length} of {alerts.length} alerts
          </p>
        </div>
        <button
          onClick={loadAlerts}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition flex items-center gap-2"
        >
          🔄 Refresh
        </button>
      </div>

      <div className="mb-4 p-4 bg-gray-50 rounded-lg flex gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Severity
          </label>
          <select
            value={filter.severity}
            onChange={(e) => setFilter({ ...filter, severity: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="caution">Caution</option>
            <option value="informative">Informative</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Country
          </label>
          <select
            value={filter.country}
            onChange={(e) => setFilter({ ...filter, country: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Countries</option>
            {uniqueCountries.map(country => (
              <option key={country} value={country}>{country}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {filteredAlerts.map(alert => (
          <div
            key={alert.id}
            className={`p-4 border-l-4 rounded-lg shadow-sm hover:shadow-md transition ${getSeverityColor(alert.severity)}`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">{alert.title}</h3>
                <p className="text-sm opacity-90 mb-2">{alert.summary}</p>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium uppercase ml-4 ${getSeverityColor(alert.severity)}`}>
                {alert.severity}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <div>
                <span className="font-medium">Location:</span> {alert.location}, {alert.country}
              </div>
              <div>
                <span className="font-medium">Event Type:</span> {alert.event_type}
              </div>
              {alert.event_start_date && (
                <div>
                  <span className="font-medium">Start:</span> {new Date(alert.event_start_date).toLocaleDateString()}
                </div>
              )}
              {alert.event_end_date && (
                <div>
                  <span className="font-medium">End:</span> {new Date(alert.event_end_date).toLocaleDateString()}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-gray-600">
              <div className="flex items-center gap-3">
                {alert.ai_generated && (
                  <span className="flex items-center gap-1">
                    🤖 AI ({alert.ai_model}) - {Math.round((alert.ai_confidence || 0) * 100)}%
                  </span>
                )}
                {alert.sources && (
                  <span>📰 {alert.sources}</span>
                )}
              </div>
              <div>
                {new Date(alert.created_at).toLocaleString()}
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <button className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition">
                ✓ Approve
              </button>
              <button className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition">
                ✏️ Edit
              </button>
              <button className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition">
                ✗ Reject
              </button>
              {alert.article_url && (
                <a
                  href={alert.article_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition"
                >
                  🔗 Source
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
'@

# Write the fixed component
[System.IO.File]::WriteAllText($componentPath, $fixedComponent, [System.Text.UTF8Encoding]::new($false))
Write-Host "  Component deployed successfully" -ForegroundColor Green

Write-Host ""
Write-Host "STEP 3: Building project..." -ForegroundColor Yellow
Set-Location $projectDir
$buildOutput = & npm run build 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Build successful!" -ForegroundColor Green
} else {
    Write-Host "  Build failed! Output:" -ForegroundColor Red
    Write-Host $buildOutput -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  FIX DEPLOYED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Cyan
Write-Host "  1. Run: npm run dev" -ForegroundColor White
Write-Host "  2. Open: http://localhost:5173" -ForegroundColor White
Write-Host "  3. Log in with: joes@magnus.co.il" -ForegroundColor White
Write-Host "  4. Click the 'Review' tab" -ForegroundColor White
Write-Host "  5. You should see all 44 alerts!" -ForegroundColor White
Write-Host ""
Write-Host "WHAT WAS FIXED:" -ForegroundColor Cyan
Write-Host "  - Correct endpoint URL (full Supabase function path)" -ForegroundColor White
Write-Host "  - Proper authentication with session token" -ForegroundColor White
Write-Host "  - Correct response parsing (data.alerts)" -ForegroundColor White
Write-Host "  - Added filters for severity and country" -ForegroundColor White
Write-Host "  - Added refresh button" -ForegroundColor White
Write-Host "  - Added error handling and retry" -ForegroundColor White
Write-Host "  - Console logging for debugging" -ForegroundColor White
Write-Host ""
