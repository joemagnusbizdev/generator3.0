/// <reference lib="deno.unstable" />

import { generateMAGNUSHTMLWrapper, formatPlainTextAsHTML } from "./html-utils.ts";

console.log("=== Clever Function (Minimal Router) ===");

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const BRAVE_API_KEY = Deno.env.get("BRAVRE_SEARCH_API_KEY");

// Try multiple naming conventions for WordPress credentials
let WP_URL = Deno.env.get("WORDPRESS_URL") || Deno.env.get("WP_URL");
let WP_USER = Deno.env.get("WORDPRESS_USER") || Deno.env.get("WP_USER") || Deno.env.get("WORDPRESS_USERNAME");
let WP_APP_PASSWORD = Deno.env.get("WORDPRESS_PASSWORD") || Deno.env.get("WP_PASSWORD") || Deno.env.get("WP_APP_PASSWORD");

// Log WordPress configuration status with detailed debug info
console.log("[WordPress Config - Debug]");
console.log(`  Checking environment variables...`);
const allEnvKeys = Object.keys(Deno.env.toObject());
const wpRelatedKeys = allEnvKeys.filter(k => k.toLowerCase().includes('wp') || k.toLowerCase().includes('wordpress'));
console.log(`  Found WP-related env vars: ${wpRelatedKeys.join(", ") || "None"}`);
console.log(`  WORDPRESS_URL: ${WP_URL ? "✅ SET" : "❌ NOT SET"}`);
console.log(`  WORDPRESS_USER: ${WP_USER ? "✅ SET" : "❌ NOT SET"}`);
console.log(`  WORDPRESS_PASSWORD: ${WP_APP_PASSWORD ? "✅ SET" : "❌ NOT SET"}`);

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, cache-control, pragma, x-requested-with",
};

function json(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function nowIso() {
  return new Date().toISOString();
}

async function querySupabaseRest(endpoint: string, options: RequestInit = {}) {
  const url = `${supabaseUrl}/rest/v1${endpoint}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${serviceKey}`,
        "apikey": serviceKey,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Supabase error ${response.status}: ${text}`);
    }

    const text = await response.text();
    if (!text || text.trim() === '') return null;
    
    return JSON.parse(text);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getKV(key: string) {
  try {
    const result = await querySupabaseRest(`/app_kv?key=eq.${encodeURIComponent(key)}&select=value`);
    if (!result || result.length === 0) return null;
    const rawValue = result[0]?.value ?? null;
    if (rawValue === null) return null;
    // Parse JSON string back to object if it's stored as string
    if (typeof rawValue === 'string') {
      try {
        return JSON.parse(rawValue);
      } catch {
        // If parse fails, return the raw value
        return rawValue;
      }
    }
    return rawValue;
  } catch (e: any) {
    return null;
  }
}

async function setKV(key: string, value: any) {
  try {
    // Try to update first
    const existing = await getKV(key);
    if (existing !== null) {
      await querySupabaseRest(`/app_kv?key=eq.${encodeURIComponent(key)}`, {
        method: 'PATCH',
        body: JSON.stringify({ value: JSON.stringify(value) }),
      });
    } else {
      // Insert if doesn't exist
      await querySupabaseRest(`/app_kv`, {
        method: 'POST',
        body: JSON.stringify({ key, value: JSON.stringify(value) }),
      });
    }
    return true;
  } catch (e: any) {
    console.error(`[KV] Failed to set ${key}:`, e);
    return false;
  }
}

// ============================================================================
// COMPREHENSIVE HEALTH CHECK
// ============================================================================

async function runHealthCheck(): Promise<any> {
  const results: Record<string, any> = {
    timestamp: nowIso(),
    checks: {},
    allHealthy: true,
  };

  // Check Claude AI
  results.checks.claude = await checkClaude();
  if (!results.checks.claude.ok) results.allHealthy = false;

  // Check OpenAI
  results.checks.openai = await checkOpenAI();
  if (!results.checks.openai.ok) results.allHealthy = false;

  // Check Brave Search API
  results.checks.brave = await checkBrave();
  if (!results.checks.brave.ok) results.allHealthy = false;

  // Check WordPress API
  results.checks.wordpress = await checkWordPress();
  if (!results.checks.wordpress.ok) results.allHealthy = false;

  // Check OpenCage Geocoding
  results.checks.opencage = await checkOpenCage();
  if (!results.checks.opencage.ok) results.allHealthy = false;

  // Check Supabase
  results.checks.supabase = await checkSupabase();
  if (!results.checks.supabase.ok) results.allHealthy = false;

  // Check database tables
  results.checks.database = await checkDatabase();
  if (!results.checks.database.ok) results.allHealthy = false;

  return results;
}

async function checkClaude(): Promise<any> {
  try {
    if (!ANTHROPIC_API_KEY) {
      return { ok: false, message: "ANTHROPIC_API_KEY not configured" };
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Say "OK"' }]
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      return { ok: true, message: "Claude API responsive" };
    } else {
      const text = await response.text();
      return { ok: false, message: `Claude API error ${response.status}` };
    }
  } catch (e: any) {
    return { ok: false, message: e.message };
  }
}

async function checkOpenAI(): Promise<any> {
  try {
    if (!OPENAI_API_KEY) {
      return { ok: false, message: "OPENAI_API_KEY not configured" };
    }

    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      return { ok: true, message: "OpenAI API responsive" };
    } else {
      return { ok: false, message: `OpenAI API error ${response.status}` };
    }
  } catch (e: any) {
    return { ok: false, message: e.message };
  }
}

async function checkBrave(): Promise<any> {
  try {
    if (!BRAVE_API_KEY) {
      return { ok: false, message: "BRAVE_API_KEY not configured" };
    }

    const response = await fetch('https://api.search.brave.com/res/v1/web/search?q=test', {
      headers: { 'Accept': 'application/json', 'X-Subscription-Token': BRAVE_API_KEY },
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok || response.status === 401) {
      // 401 means API key issue but service is reachable
      return { ok: response.ok, message: response.ok ? "Brave API responsive" : "Brave API key issue" };
    } else {
      return { ok: false, message: `Brave API error ${response.status}` };
    }
  } catch (e: any) {
    return { ok: false, message: e.message };
  }
}

async function checkWordPress(): Promise<any> {
  try {
    if (!WP_URL || !WP_USER || !WP_APP_PASSWORD) {
      return { ok: false, message: "WordPress credentials not configured" };
    }

    const token = btoa(`${WP_USER}:${WP_APP_PASSWORD}`);
    const response = await fetch(`${WP_URL}/wp-json/wp/v2/rss-feed?per_page=1`, {
      headers: { 'Authorization': `Basic ${token}` },
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      return { ok: true, message: "WordPress API responsive" };
    } else {
      return { ok: false, message: `WordPress API error ${response.status}` };
    }
  } catch (e: any) {
    return { ok: false, message: e.message };
  }
}

async function checkOpenCage(): Promise<any> {
  try {
    const apiKey = Deno.env.get("OPENCAGE_API_KEY");
    if (!apiKey) {
      return { ok: false, message: "OPENCAGE_API_KEY not configured" };
    }

    const response = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=Paris&key=${apiKey}&limit=1`, {
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      return { ok: true, message: "OpenCage API responsive" };
    } else {
      return { ok: false, message: `OpenCage API error ${response.status}` };
    }
  } catch (e: any) {
    return { ok: false, message: e.message };
  }
}

async function checkSupabase(): Promise<any> {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/alerts?limit=1`, {
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      return { ok: true, message: "Supabase REST API responsive" };
    } else {
      return { ok: false, message: `Supabase error ${response.status}` };
    }
  } catch (e: any) {
    return { ok: false, message: e.message };
  }
}

async function checkDatabase(): Promise<any> {
  try {
    // Check if key tables exist by trying to query each one
    const requiredTables = ['alerts', 'sources', 'app_kv'];
    const existingTables: string[] = [];
    const missingTables: string[] = [];

    for (const table of requiredTables) {
      try {
        await querySupabaseRest(`/${table}?limit=1`);
        existingTables.push(table);
      } catch (e) {
        missingTables.push(table);
      }
    }

    // Also check that trends are stored in KV
    const trendsInKv = await getKV("trends-list");
    existingTables.push("trends (in KV)");

    if (missingTables.length === 0) {
      return { ok: true, message: `All required tables exist`, tables: existingTables };
    } else {
      return { ok: false, message: `Missing tables: ${missingTables.join(", ")}` };
    }
  } catch (e: any) {
    return { ok: false, message: e.message };
  }
}

Deno.serve({ skipJwtVerification: true }, async (req) => {
  const method = req.method;
  const url = req.url;
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const urlObj = new URL(req.url);
    const path = urlObj.pathname;

    console.log(`[${method}] ${path}`);
    
    // Comprehensive health check
    if (path.endsWith("/health") && method === "GET") {
      const health = await runHealthCheck();
      return json(health, health.allHealthy ? 200 : 503);
    }

    // POST /scour/run - Proxy to scour-worker (avoids CORS issues) - ASYNC, NON-BLOCKING
    if ((path === "/scour/run" || path === "/clever-function/scour/run") && method === "POST") {
      try {
        const body = await req.json();
        const jobId = body.jobId;
        
        // Start scour-worker in background WITHOUT WAITING
        // This returns immediately so the function doesn't timeout
        // The frontend will poll /scour/status/{jobId} to get progress
        fetch(`${supabaseUrl}/functions/v1/scour-worker`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }).catch(e => {
          console.error(`[POST /scour/run] Background scour-worker job failed:`, e);
        });

        // Return immediately with queued status
        return json({
          ok: true,
          jobId: jobId,
          status: "queued",
          message: "Scour job queued. Check status via polling."
        });
      } catch (error: any) {
        console.error('[POST /scour/run] Error:', error);
        return json({ ok: false, error: error?.message }, 500);
      }
    }

    // GET /scour/status - Get current scour job status
    if ((path === "/scour/status" || path === "/clever-function/scour/status") && method === "GET") {
      try {
        // Check if a specific jobId was provided
        const jobId = url.searchParams.get("jobId");
        
        if (jobId) {
          // Return specific job by ID (regardless of status)
          const jobData = await getKV(`scour-job-${jobId}`);
          return json({ ok: true, job: jobData });
        }
        
        // Return all active scour jobs
        const allJobs = await querySupabaseRest(`/app_kv?key=like.scour-job-*&select=key,value`);
        
        if (allJobs && Array.isArray(allJobs)) {
          const activeJobs = [];
          for (const entry of allJobs) {
            const jobData = typeof entry.value === 'string' ? JSON.parse(entry.value) : entry.value;
            if (jobData && (jobData.status === 'running' || jobData.status === 'pending')) {
              activeJobs.push({
                id: jobData.id || entry.key.replace('scour-job-', ''),
                status: jobData.status,
                phase: jobData.phase,
                processed: jobData.processed || 0,
                total: jobData.total || 0,
                created: jobData.created || 0,
                sources_count: jobData.sources?.length || 0,
                started_at: jobData.started_at,
                current_source: jobData.current_source,
              });
            }
          }
          
          return json({
            ok: true,
            active_jobs: activeJobs,
            has_active_job: activeJobs.length > 0,
            job_count: activeJobs.length,
          });
        }
        
        return json({
          ok: true,
          active_jobs: [],
          has_active_job: false,
          job_count: 0,
        });
      } catch (e: any) {
        console.error(`[scour/status] Error:`, e);
        return json({ 
          ok: true,
          active_jobs: [],
          has_active_job: false,
          job_count: 0,
        });
      }
    }

    // GET /scour/status/:jobId - Get specific job status
    if ((path.startsWith("/scour/status/") || path.startsWith("/clever-function/scour/status/")) && method === "GET") {
      // Extract jobId from path, handling both /scour/status/{jobId} and /clever-function/scour/status/{jobId}
      const jobId = path.split('/').pop();
      if (!jobId) {
        return json({ ok: false, error: "Missing jobId parameter" }, 400);
      }

      try {
        // Query the app_kv table for job status
        const statusKey = `scour-job-${jobId}`;
        console.log(`[/scour/status] Querying app_kv for key: ${statusKey}`);
        
        let result;
        try {
          result = await querySupabaseRest(`/app_kv?key=eq.${encodeURIComponent(statusKey)}&select=value`);
        } catch (queryErr: any) {
          console.error(`[/scour/status] Query failed:`, queryErr.message);
          // Return unknown status instead of erroring
          return json({
            ok: true,
            job: {
              id: jobId,
              status: "unknown",
              processed: 0,
              total: 0,
              created: 0,
              phase: "unknown",
              activityLog: [],
            },
          });
        }
        
        console.log(`[/scour/status] Query result: ${result ? (Array.isArray(result) ? `${result.length} rows` : 'object') : 'null'}`);
        
        if (result && result.length > 0) {
          try {
            const rawValue = result[0].value;
            console.log(`[/scour/status] Raw value type: ${typeof rawValue}`);
            
            let jobData;
            if (typeof rawValue === 'string') {
              jobData = JSON.parse(rawValue);
            } else if (typeof rawValue === 'object') {
              jobData = rawValue;
            } else {
              console.warn(`[/scour/status] Unexpected value type: ${typeof rawValue}`);
              jobData = { status: "unknown", activityLog: [] };
            }
            
            console.log(`[/scour/status] Parsed jobData keys: ${Object.keys(jobData).join(', ')}`);
            console.log(`[/scour/status] Has activityLog: ${!!jobData.activityLog}`);
            if (jobData.activityLog) {
              console.log(`[/scour/status] ActivityLog is array: ${Array.isArray(jobData.activityLog)}, length: ${jobData.activityLog.length}`);
            }
            console.log(`[/scour/status] Retrieved job ${jobId}: status=${jobData.status}, processed=${jobData.processed}, logs=${jobData.activityLog?.length || 0}`);
            
            return json({
              ok: true,
              job: jobData,
            });
          } catch (parseErr: any) {
            console.error(`[/scour/status] Parse error:`, parseErr.message);
            // Return what we can even if parsing fails
            return json({
              ok: true,
              job: {
                id: jobId,
                status: "error",
                processed: 0,
                total: 0,
                created: 0,
                phase: "unknown",
                activityLog: [],
                parseError: parseErr.message,
              },
            });
          }
        }

        // If not found in app_kv, return default job data
        console.log(`[/scour/status] Job ${jobId} not found in app_kv (0 rows returned)`);
        return json({
          ok: true,
          job: {
            id: jobId,
            status: "unknown",
            processed: 0,
            total: 0,
            created: 0,
            phase: "unknown",
            activityLog: [],
          },
        });
      } catch (e: any) {
        console.error(`[scour/status] Unexpected error:`, e.message, e.stack);
        return json({ 
          ok: false, 
          error: `Failed to get job status: ${e.message}`
        }, 500);
      }
    }

    // GET /scour/logs - Get live logs from current job
    if ((path.startsWith("/scour/logs") || path.startsWith("/clever-function/scour/logs")) && method === "GET") {
      const jobId = urlObj.searchParams.get("jobId");
      const limit = parseInt(urlObj.searchParams.get("limit") || "50", 10);
      
      if (!jobId) {
        return json({ ok: false, error: "Missing jobId parameter" }, 400);
      }

      try {
        // Get job status which includes logs
        const statusKey = `scour-job-${jobId}`;
        const result = await querySupabaseRest(`/app_kv?key=eq.${encodeURIComponent(statusKey)}&select=value`);
        
        if (result && result.length > 0) {
          const jobData = typeof result[0].value === 'string' 
            ? JSON.parse(result[0].value) 
            : result[0].value;
          
          // Extract activity log and return last N entries
          const logs = jobData.activityLog || [];
          const recentLogs = logs.slice(-limit);
          
          return json({
            ok: true,
            jobId,
            logs: recentLogs,
            totalLogs: logs.length,
            phase: jobData.phase,
            status: jobData.status,
          });
        }

        return json({
          ok: true,
          jobId,
          logs: [],
          totalLogs: 0,
          phase: "unknown",
          status: "unknown",
        });
      } catch (e: any) {
        console.error(`[scour/logs] Error:`, e);
        return json({ 
          ok: false, 
          error: `Failed to get logs: ${e.message}` 
        }, 500);
      }
    }

    // POST /alerts - Create a new alert
    if ((path === "/alerts" || path === "/clever-function/alerts") && method === "POST") {
      try {
        const body = await req.json();
        
        // Valid columns in alerts table
        const validColumns = new Set([
          'id', 'title', 'summary', 'location', 'country', 'region',
          'event_type', 'severity', 'status',
          'source_id', 'source_url', 'article_url', 'sources',
          'event_start_date', 'event_end_date',
          'ai_generated', 'ai_model', 'ai_confidence', 'generation_metadata',
          'wordpress_post_id', 'wordpress_url', 'exported_at', 'export_error', 'export_error_at',
          'trend_id', 'created_at', 'updated_at',
          // UI sends these but they need special handling
          'latitude', 'longitude', 'radiusKm', 'geo_json', 'geojson'
        ]);

        // Build the alert payload
        const alertPayload: any = {
          id: crypto.randomUUID(),
          status: body.status || "draft",
          created_at: nowIso(),
          updated_at: nowIso(),
        };

        // Copy valid columns
        for (const [key, value] of Object.entries(body)) {
          if (key === 'radiusKm' || key === 'latitude' || key === 'longitude' || key === 'geo_json' || key === 'geojson') {
            // These go into generation_metadata
            if (!alertPayload.generation_metadata) {
              alertPayload.generation_metadata = {};
            }
            if (typeof alertPayload.generation_metadata === 'string') {
              alertPayload.generation_metadata = JSON.parse(alertPayload.generation_metadata);
            }
            
            if (key === 'radiusKm') {
              alertPayload.generation_metadata.radiusKm = value;
            } else if (key === 'latitude') {
              alertPayload.generation_metadata.latitude = value;
            } else if (key === 'longitude') {
              alertPayload.generation_metadata.longitude = value;
            } else if (key === 'geo_json' || key === 'geojson') {
              alertPayload.generation_metadata.geoJSON = key === 'geo_json' ? value : (typeof value === 'string' ? JSON.parse(value) : value);
            }
          } else if (validColumns.has(key) && key !== 'id' && key !== 'created_at' && key !== 'updated_at') {
            alertPayload[key] = value;
          }
        }

        // Ensure generation_metadata is a JSON string if it exists
        if (alertPayload.generation_metadata && typeof alertPayload.generation_metadata !== 'string') {
          alertPayload.generation_metadata = JSON.stringify(alertPayload.generation_metadata);
        }

        const newAlert = await querySupabaseRest("/alerts", {
          method: "POST",
          body: JSON.stringify(alertPayload),
          headers: {
            "Prefer": "return=representation"
          }
        });
        
        return json({ ok: true, alert: newAlert && newAlert[0] ? newAlert[0] : newAlert });
      } catch (error: any) {
        console.error('[POST /alerts] Error:', error);
        return json({ ok: false, error: error?.message }, 500);
      }
    }

    // GET /alerts - Get all alerts with optional filtering
    if ((path === "/alerts" || path === "/clever-function/alerts") && method === "GET") {
      try {
        const status = urlObj.searchParams.get("status");
        const limit = urlObj.searchParams.get("limit") || "10000";
        let endpoint = `/alerts?order=created_at.desc&limit=${limit}`;
        if (status) {
          endpoint = `/alerts?status=eq.${encodeURIComponent(status)}&order=created_at.desc&limit=${limit}`;
        }
        const alerts = await querySupabaseRest(endpoint);
        return json({ ok: true, alerts: alerts || [] });
      } catch (error: any) {
        return json({ ok: false, error: error?.message }, 500);
      }
    }

    // GET /alerts/review
    if (path.endsWith("/alerts/review") && method === "GET") {
      try {
        const page = parseInt(urlObj.searchParams.get("page") || "1", 10);
        const pageSize = parseInt(urlObj.searchParams.get("pageSize") || "5000", 10);
        const offset = (page - 1) * pageSize;
        
        const alerts = await querySupabaseRest(
          `/alerts?status=eq.draft&order=created_at.desc&limit=${pageSize}&offset=${offset}`
        );
        
        const countResponse = await querySupabaseRest(
          `/alerts?status=eq.draft&select=id`
        );
        const totalCount = Array.isArray(countResponse) ? countResponse.length : 0;
        
        // Filter out stale alerts on the backend (belt and suspenders approach)
        // Only show alerts from last 14 days OR with ongoing events (end_date in future)
        const now = new Date();
        const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        
        const filteredAlerts = (alerts || []).filter((alert: any) => {
          const createdAt = alert.created_at ? new Date(alert.created_at) : null;
          
          // Check if alert is from the last 14 days
          if (createdAt && createdAt >= fourteenDaysAgo) {
            return true;
          }
          
          // Check if it's related to an ongoing event (event_end_date is in future)
          if (alert.event_end_date) {
            const eventEndDate = new Date(alert.event_end_date);
            if (eventEndDate > now) {
              // Event is ongoing, include alert
              return true;
            }
          }
          
          // Reject stale alerts (older than 14 days without ongoing event)
          console.log(`[alerts/review] Filtering out stale alert: "${alert.title}" (created ${createdAt}, event_end ${alert.event_end_date})`);
          return false;
        });
        
        return json({ 
          ok: true, 
          alerts: filteredAlerts,
          pagination: {
            page,
            pageSize,
            total: totalCount,
            pages: Math.ceil(totalCount / pageSize)
          }
        });
      } catch (error: any) {
        console.error('[alerts/review] Error:', error);
        return json({ ok: false, error: error?.message || String(error) }, 500);
      }
    }

    // POST /scour-sources-v2
    if (path.endsWith("/scour-sources-v2") && method === "POST") {
      try {
        console.log('[scour-sources-v2] Request received');
        const body = await req.json().catch(() => ({}));
        const jobId = body.jobId || `scour-${crypto.randomUUID()}`;
        const batchOffset = body.batchOffset || 0;
        const batchSize = body.batchSize || 10;
        
        console.log(`[scour-sources-v2] Calling worker with jobId: ${jobId}`);
        
        const workerResponse = await fetch(
          `${supabaseUrl}/functions/v1/scour-worker`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceKey}`,
              'apikey': serviceKey,
            },
            body: JSON.stringify({
              jobId,
              daysBack: body.daysBack,
              batchOffset,
              batchSize,
            }),
          }
        );
        
        console.log(`[scour-sources-v2] Worker response status: ${workerResponse.status}`);
        const result = await workerResponse.json();
        console.log(`[scour-sources-v2] Worker result:`, result);
        
        const responseStatus = workerResponse.status;
        console.log(`[scour-sources-v2] Returning status: ${responseStatus}`);
        return json({ ok: true, jobId, ...result }, responseStatus);
      } catch (err: any) {
        console.error('[scour-sources-v2] Error:', err);
        return json({ ok: false, error: err.message }, 500);
      }
    }

    // POST /scour-early-signals
    if (path.endsWith("/scour-early-signals") && method === "POST") {
      try {
        console.log('[Early Signals] Starting Early Signals request');
        const body = await req.json().catch(() => ({}));
        const jobId = crypto.randomUUID();
        
        console.log(`[Early Signals] Created jobId: ${jobId}`);
        
        // Store in KV that this is an early signals job
        try {
          await setKV(`scour-job-${jobId}`, {
            id: jobId,
            status: "running",
            phase: "early_signals",
            total: 25, // Start with just 25 base queries
            processed: 0,
            created: 0,
            duplicatesSkipped: 0,
            lowConfidenceSkipped: 0,
            errorCount: 0,
            currentActivity: "Early Signals queued...",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            activityLog: [],
          });
          console.log(`[Early Signals] Job stored in KV with key: scour-job-${jobId}`);
        } catch (kvErr: any) {
          console.warn(`[Early Signals] KV storage failed: ${kvErr.message}`);
          // Continue anyway - the job will still be created
        }

        // Call scour-worker to start early signals in background
        console.log('[Early Signals] Calling scour-worker with earlySignalsOnly=true');
        fetch(`${supabaseUrl}/functions/v1/scour-worker`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
            'apikey': serviceKey,
          },
          body: JSON.stringify({
            jobId,
            earlySignalsOnly: true,
          }),
        }).catch(e => {
          console.error(`[Early Signals] Background job ${jobId} failed:`, e);
        });

        // Return immediately with queued status
        return json({
          ok: true,
          jobId,
          status: 'queued',
          phase: 'early_signals',
          message: 'Early Signals job queued. Check status via polling.'
        });
      } catch (error: any) {
        console.error('[Early Signals] Error:', error);
        return json({ ok: false, error: error?.message }, 500);
      }
    }

    // POST /scour-group - Scour a group of sources
    if (path.endsWith("/scour-group") && method === "POST") {
      try {
        console.log('[scour-group] Request received');
        const body = await req.json().catch(() => ({}));
        const sourceIds = body.source_ids || [];
        const groupId = body.group_id || 'unknown';
        
        if (!sourceIds || sourceIds.length === 0) {
          return json({ ok: false, error: 'No sources provided' }, 400);
        }

        console.log(`[scour-group] Scour group ${groupId} with ${sourceIds.length} sources`);
        
        const jobId = `scour-${crypto.randomUUID()}`;
        
        // Store job in KV
        await setKV(`scour-job-${jobId}`, {
          id: jobId,
          status: 'running',
          phase: 'source_scour',
          group_id: groupId,
          total: sourceIds.length,
          processed: 0,
          created: 0,
          duplicates: 0,
          errors: 0,
          disabled_sources: [],
          current_source: null,
          started_at: nowIso(),
          updated_at: nowIso(),
        });

        // Call scour worker with this specific group
        const workerResponse = await fetch(
          `${supabaseUrl}/functions/v1/scour-worker`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceKey}`,
              'apikey': serviceKey,
            },
            body: JSON.stringify({
              jobId,
              groupId,
              sourceIds,
              daysBack: 30,
            }),
          }
        );

        const result = await workerResponse.json();
        
        // Update job status
        await setKV(`scour-job-${jobId}`, {
          id: jobId,
          status: 'completed',
          phase: 'source_scour',
          group_id: groupId,
          completed_at: nowIso(),
          results: result.results,
        });

        return json({
          ok: true,
          jobId,
          group_id: groupId,
          results: result.results || {
            alerts_created: 0,
            duplicates_skipped: 0,
            errors: 0,
            disabled_sources: 0,
            disabled_source_ids: [],
          },
        });
      } catch (err: any) {
        console.error('[scour-group] Error:', err);
        return json({ ok: false, error: err.message }, 500);
      }
    }

    // POST /scour/stop/:jobId
    if (path.includes("/scour/stop") && method === "POST") {
      try {
        const parts = path.split("/");
        const jobIdIndex = parts.findIndex(p => p === "stop") + 1;
        const jobId = parts[jobIdIndex];

        if (!jobId) {
          return json({ ok: false, error: "Job ID required" }, 400);
        }

        // Set stop flag for this specific job
        await setKV(`scour-stop-${jobId}`, { stopped: true, at: nowIso() });
        console.log(`🛑 Scour stop requested for job: ${jobId}`);

        // Also stop all other scour jobs that might be running
        try {
          const activeJobs = await querySupabaseRest(`/app_kv?key=like.scour-job-*&select=key,value`);
          if (activeJobs && Array.isArray(activeJobs)) {
            const stoppedJobs = [];
            for (const entry of activeJobs) {
              const entryJobId = entry.key?.replace('scour-job-', '');
              if (entryJobId && entryJobId !== jobId) {
                // Only stop if job is actually running (not already done/stopped)
                const jobValue = typeof entry.value === 'string' ? JSON.parse(entry.value) : entry.value;
                if (jobValue?.status === 'running') {
                  await setKV(`scour-stop-${entryJobId}`, { stopped: true, at: nowIso() });
                  stoppedJobs.push(entryJobId);
                  console.log(`🛑 Also stopped concurrent job: ${entryJobId}`);
                }
              }
            }
            if (stoppedJobs.length > 0) {
              console.log(`🛑 Stopped ${stoppedJobs.length} concurrent scour job(s)`);
            }
          }
        } catch (e) {
          console.warn(`Could not check for other running jobs: ${e}`);
        }

        return json({ 
          ok: true, 
          message: `Scour job ${jobId} stop requested (and any others)` 
        });
      } catch (err: any) {
        return json({ ok: false, error: err.message }, 500);
      }
    }

    // POST /force-stop-scour - HARD STOP: Immediately kill ALL running scour/early signal jobs
    if ((path === "/force-stop-scour" || path.endsWith("/force-stop-scour")) && method === "POST") {
      try {
        console.log(`🛑 [FORCE STOP] Received hard stop request - terminating all scour and early signal operations`);
        let stoppedCount = 0;
        
        // 1. Stop ALL running scour jobs with hard stop flags
        try {
          const activeJobs = await querySupabaseRest(`/app_kv?key=like.scour-job-*&select=key,value`);
          if (activeJobs && Array.isArray(activeJobs)) {
            for (const entry of activeJobs) {
              const jobId = entry.key?.replace('scour-job-', '');
              if (jobId) {
                const jobValue = typeof entry.value === 'string' ? JSON.parse(entry.value) : entry.value;
                
                // Only stop jobs that are NOT already completed
                if (jobValue?.status !== 'completed' && jobValue?.status !== 'cancelled') {
                  // Set HARD STOP flag immediately
                  await setKV(`scour-stop-${jobId}`, { stopped: true, at: nowIso(), by: 'force-stop-endpoint' });
                  
                  // Mark job as cancelled
                  await querySupabaseRest(`/app_kv?key=eq.${encodeURIComponent(entry.key)}`, {
                    method: "PATCH",
                    body: JSON.stringify({ value: JSON.stringify({ ...jobValue, status: "cancelled", cancelled_at: nowIso(), cancelled_by: 'force-stop' }) })
                  });
                  
                  stoppedCount++;
                  console.log(`🛑 Hard stopped scour job: ${jobId}`);
                }
              }
            }
          }
        } catch (e) {
          console.warn(`Error stopping scour jobs: ${e}`);
        }
        
        // 2. Stop all early signal jobs as well
        try {
          const earlySignalJobs = await querySupabaseRest(`/app_kv?key=like.early-signals-*&select=key,value`);
          if (earlySignalJobs && Array.isArray(earlySignalJobs)) {
            for (const entry of earlySignalJobs) {
              const jobId = entry.key?.replace('early-signals-', '');
              if (jobId) {
                // Set hard stop flag for early signals
                await setKV(`early-signals-stop-${jobId}`, { stopped: true, at: nowIso() });
                console.log(`🛑 Hard stopped early signals job: ${jobId}`);
              }
            }
          }
        } catch (e) {
          console.warn(`Error stopping early signals: ${e}`);
        }
        
        console.log(`🛑 [FORCE STOP COMPLETE] Stopped ${stoppedCount} scour job(s) - all operations halted`);
        return json({
          ok: true,
          message: `Hard stop executed - ${stoppedCount} scour job(s) terminated`,
          stopped_jobs: stoppedCount,
          status: 'hard-stop-complete'
        });
      } catch (err: any) {
        console.error(`Force stop error: ${err.message}`);
        return json({ ok: false, error: err.message }, 500);
      }
    }

    // POST /cleanup - FULL CACHE CLEANUP: Delete ALL job records from KV
    if ((path === "/cleanup" || path.endsWith("/cleanup")) && method === "POST") {
      try {
        console.log(`🧹 [CLEANUP] Starting full cache cleanup - clearing all job data`);
        let deletedCount = 0;

        // Get all job-related keys from app_kv
        const patterns = ['scour-job-', 'scour-stop-', 'early-signals-'];
        
        for (const pattern of patterns) {
          try {
            const entries = await querySupabaseRest(`/app_kv?key=like.${pattern}*&select=key`);
            if (entries && Array.isArray(entries)) {
              for (const entry of entries) {
                // Delete each entry
                await querySupabaseRest(`/app_kv?key=eq.${encodeURIComponent(entry.key)}`, {
                  method: 'DELETE',
                });
                deletedCount++;
                console.log(`🧹 Deleted KV entry: ${entry.key}`);
              }
            }
          } catch (e) {
            console.warn(`Error cleaning up ${pattern} entries:`, e);
          }
        }

        console.log(`🧹 [CLEANUP COMPLETE] Deleted ${deletedCount} KV entries`);
        return json({
          ok: true,
          message: `Cache cleanup complete - deleted ${deletedCount} job entries`,
          deleted_count: deletedCount,
          status: 'cleanup-complete'
        });
      } catch (err: any) {
        console.error(`Cleanup error: ${err.message}`);
        return json({ ok: false, error: err.message }, 500);
      }
    }

    // POST /trends/rebuild - Rebuild trend definitions from dismissed alerts only
    if ((path === "/trends/rebuild" || path === "/clever-function/trends/rebuild") && method === "POST") {
      try {
        console.log("[Trends] Starting rebuild...");
        
        // Get ONLY dismissed alerts in the last 14 days (not approved - those are already published)
        // Trends help identify patterns in rejected/dismissed alerts for future improvements
        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        console.log(`[Trends] Rebuild: Filtering dismissed alerts from ${fourteenDaysAgo} onwards`);
        
        const dismissedAlerts = await querySupabaseRest(
          `/alerts?status=eq.dismissed&created_at=gte.${encodeURIComponent(fourteenDaysAgo)}&order=created_at.desc`
        );
        
        const allAlerts = Array.isArray(dismissedAlerts) ? dismissedAlerts : [];
        
        console.log(`[Trends] Found ${allAlerts.length} dismissed alerts in last 14 days for trend analysis`);
        if (allAlerts.length > 0) {
          const oldestAlert = allAlerts.reduce((oldest, a) => {
            const aDate = new Date(a.created_at).getTime();
            const oldestDate = new Date(oldest.created_at).getTime();
            return aDate < oldestDate ? a : oldest;
          });
          const newestAlert = allAlerts.reduce((newest, a) => {
            const aDate = new Date(a.created_at).getTime();
            const newestDate = new Date(newest.created_at).getTime();
            return aDate > newestDate ? a : newest;
          });
          console.log(`[Trends] Alert date range: ${oldestAlert.created_at} to ${newestAlert.created_at}`);
        }
        
        // Group alerts by country + event_type combination to find patterns
        // Also look for named events (e.g., "hurricane melissa" appearing in title/description)
        const trendGroups: Record<string, any[]> = {};
        
        for (const alert of allAlerts) {
          let trendKey = "";
          const titleLower = (alert.title || "").toLowerCase();
          const descLower = (alert.description || "").toLowerCase();
          const combined = `${titleLower} ${descLower}`;
          
          // Look for named events
          const namedEventMatches = combined.match(
            /(hurricane|typhoon|storm|earthquake|flood|wildfire|volcano|outbreak|crisis|attack|conflict|unrest)\s+([a-z]+)/gi
          );
          
          if (namedEventMatches && namedEventMatches.length > 0) {
            const namedEvent = namedEventMatches[0].toLowerCase();
            trendKey = `${alert.country}|${namedEvent}`;
          } else {
            const eventType = alert.event_type || "general";
            trendKey = `${alert.country}|${eventType}`;
          }
          
          if (!trendGroups[trendKey]) {
            trendGroups[trendKey] = [];
          }
          trendGroups[trendKey].push(alert);
        }
        
        // Create trend DEFINITIONS (no alert_ids - alerts will be queried dynamically)
        const trends: any[] = [];
        console.log(`[Trends] Processing ${Object.keys(trendGroups).length} distinct trend groups...`);
        for (const [key, alerts] of Object.entries(trendGroups)) {
          console.log(`[Trends] Group "${key}": ${alerts.length} alerts (threshold: 3, will ${alerts.length >= 3 ? "CREATE" : "SKIP"})`);
          if (alerts.length >= 3) {
            const [country, trendName] = key.split("|");
            const trendId = crypto.randomUUID();
            
            // Determine if this is a named event or event_type
            const isNamedEvent = trendName.match(/^(hurricane|typhoon|storm|earthquake|flood|wildfire|volcano|outbreak|crisis|attack|conflict|unrest)\s+/i);
            const categoryType = isNamedEvent ? "named_event" : "event_type";
            
            const severityOrder: Record<string, number> = {
              critical: 4,
              warning: 3,
              caution: 2,
              informative: 1,
            };
            
            let highestSeverity = "informative";
            let highestScore = 0;
            for (const alert of alerts) {
              const score = severityOrder[alert.severity] || 0;
              if (score > highestScore) {
                highestScore = score;
                highestSeverity = alert.severity || "informative";
              }
            }
            
            const lastSeenAt = alerts.length > 0 
              ? alerts.reduce((latest, a) => {
                  const aTime = new Date(a.created_at || 0).getTime();
                  const latestTime = new Date(latest.created_at || 0).getTime();
                  return aTime > latestTime ? a : latest;
                }).created_at
              : nowIso();
            
            // Trend definition: stores search criteria, not alert_ids
            const trend = {
              id: trendId,
              country,
              category: trendName,
              count: alerts.length,  // Count at rebuild time (for display)
              highest_severity: highestSeverity,
              last_seen_at: lastSeenAt,
              search_category: trendName,  // Used for dynamic queries
              category_type: categoryType,  // "event_type" or "named_event"
              created_at: nowIso(),
              updated_at: nowIso(),
              status: "active"
            };
            
            trends.push(trend);
            await setKV(`trend-${trendId}`, trend);
            console.log(`[Trends] Created trend: ${trendName} (${country}) [${categoryType}] - will dynamically query for matching alerts`);
          }
        }
        
        await setKV("trends-list", trends);
        console.log(`[Trends] Rebuild complete: ${trends.length} trend definitions created`);
        return json({ 
          ok: true, 
          trends, 
          count: trends.length,
          diagnostics: {
            total_dismissed_alerts_analyzed: allAlerts.length,
            date_window: `${fourteenDaysAgo} to now`,
            trend_groups_found: Object.keys(trendGroups).length,
            trends_created: trends.length,
            note: "Trends are created from DISMISSED alerts only - helps identify patterns in rejected content"
          }
        });
      } catch (err: any) {
        console.error("[Trends] Rebuild error:", err);
        return json({ ok: false, error: err.message }, 500);
      }
    }
        
        // Group alerts by country + event_type combination
    // GET /trends - List all trends
    if ((path === "/trends" || path === "/clever-function/trends") && method === "GET") {
      try {
        const trendsRaw = await getKV("trends-list");
        let trends: any[] = [];
        
        if (trendsRaw) {
          // Parse if it's a string (from KV storage)
          if (typeof trendsRaw === 'string') {
            trends = JSON.parse(trendsRaw);
          } else {
            trends = Array.isArray(trendsRaw) ? trendsRaw : [];
          }
        }
        
        return json({ ok: true, trends });
      } catch (err: any) {
        console.error("[Trends] List error:", err);
        return json({ ok: false, error: err.message }, 500);
      }
    }

    // GET /trends/:id/alerts - Get alerts for a specific trend
    if (path.includes("/trends/") && path.includes("/alerts") && method === "GET") {
      console.log(`[TRENDS-ALERTS-ENDPOINT] Matched! Path: ${path}, checking for /trends/ and /alerts`);
      try {
        const parts = path.split("/");
        const trendIdx = parts.indexOf("trends");
        const trendId = trendIdx >= 0 && trendIdx < parts.length - 1 ? parts[trendIdx + 1] : null;
        
        console.log(`[Trends] GET /trends/:id/alerts request - extracting trendId from path: ${path}`);
        console.log(`[Trends] Path parts: ${JSON.stringify(parts)}, trendIdx: ${trendIdx}, trendId: ${trendId}`);
        
        if (!trendId) {
          console.error("[Trends] No trend ID found in path");
          return json({ ok: false, error: "Trend ID required" }, 400);
        }
        
        // Get trend from KV
        const trendRaw = await getKV(`trend-${trendId}`);
        console.log(`[Trends] Fetched trend from KV: ${typeof trendRaw}, ${trendRaw ? 'has value' : 'NULL'}`);
        
        if (!trendRaw) {
          console.error(`[Trends] Trend not found in KV: trend-${trendId}`);
          return json({ ok: false, error: "Trend not found" }, 404);
        }
        
        // Parse trend data if it's a string
        const trend = typeof trendRaw === 'string' ? JSON.parse(trendRaw) : trendRaw;
        
        console.log(`[Trends] Fetching alerts for trend ${trendId}:`);
        console.log(`  Raw trend object: ${JSON.stringify(trend)}`);
        
        // Dynamically query for alerts matching this trend in the last 14 days
        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const country = trend.country;
        const searchCategory = trend.search_category || trend.category;
        const categoryType = trend.category_type || "event_type";
        
        // Build query based on whether this is a named event or event_type
        let queryEndpoint = `/alerts?country=eq.${encodeURIComponent(country)}&created_at=gte.${encodeURIComponent(fourteenDaysAgo)}&order=created_at.desc`;
        
        // For event_types (like "Natural Disaster"), filter by event_type
        // For named events, we'd need to search title/description (not implemented yet)
        if (categoryType === "event_type") {
          queryEndpoint += `&event_type=eq.${encodeURIComponent(searchCategory)}`;
        }
        
        console.log(`[Trends] Alert fetch for trend ${trendId}:`);
        console.log(`  - Trend data: ${JSON.stringify({country, searchCategory, categoryType})}`);
        console.log(`  - Query endpoint: ${queryEndpoint}`);
        
        try {
          const alertsRaw = await querySupabaseRest(queryEndpoint);
          const alertsArray = Array.isArray(alertsRaw) ? alertsRaw : [];
          
          console.log(`[Trends] Query for trend ${trendId}:`);
          console.log(`  Full URL that was called: ${supabaseUrl}/rest/v1${queryEndpoint}`);
          console.log(`  Raw response length: ${Array.isArray(alertsRaw) ? alertsRaw.length : 'not an array'}`);
          if (alertsArray.length > 0) {
            console.log(`  First 3 alerts:`);
            for (let i = 0; i < Math.min(3, alertsArray.length); i++) {
              console.log(`    [${i}] ${alertsArray[i].country} - ${alertsArray[i].event_type} - ${alertsArray[i].title?.substring(0, 50)}`);
            }
          }
          console.log(`  Found ${alertsArray.length} alerts matching ${country}/${searchCategory} (${categoryType})`);
          
          const responseObj = { 
            ok: true, 
            trend, 
            alerts: alertsArray,
            debug: {
              country,
              searchCategory,
              categoryType,
              queryEndpoint,
              alertCount: alertsArray.length,
              firstAlert: alertsArray.length > 0 ? {id: alertsArray[0].id, country: alertsArray[0].country, event_type: alertsArray[0].event_type, title: alertsArray[0].title} : null
            }
          };
          
          console.log(`[Trends] Returning response with ${alertsArray.length} alerts`);
          return json(responseObj);
        } catch (e: any) {
          console.error(`[Trends] Query error: ${e.message}`, e);
          return json({ ok: true, trend, alerts: [], error: e.message });
        }
      } catch (err: any) {
        console.error("[Trends] Get alerts error:", err);
        return json({ ok: false, error: err.message, stack: err.stack }, 500);
      }
    }

    // POST /trends/:id/generate-report - Generate a Claude report for a trend
    if ((path.includes("/trends/") && path.includes("/generate-report")) && method === "POST") {
      try {
        const parts = path.split("/");
        const trendIdx = parts.indexOf("trends");
        const trendId = trendIdx >= 0 && trendIdx < parts.length - 1 ? parts[trendIdx + 1] : null;
        
        if (!trendId) {
          return json({ ok: false, error: "Trend ID required" }, 400);
        }
        
        // Get trend from KV
        const trendRaw = await getKV(`trend-${trendId}`);
        if (!trendRaw) {
          return json({ ok: false, error: "Trend not found" }, 404);
        }
        
        const trend = typeof trendRaw === 'string' ? JSON.parse(trendRaw) : trendRaw;
        
        // Query fresh alerts for this trend
        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const country = trend.country;
        const searchCategory = trend.search_category || trend.category;
        const categoryType = trend.category_type || "event_type";
        
        let queryEndpoint = `/alerts?country=eq.${encodeURIComponent(country)}&created_at=gte.${encodeURIComponent(fourteenDaysAgo)}&order=created_at.desc`;
        if (categoryType === "event_type") {
          queryEndpoint += `&event_type=eq.${encodeURIComponent(searchCategory)}`;
        }
        
        const alertsRaw = await querySupabaseRest(queryEndpoint);
        const alerts = Array.isArray(alertsRaw) ? alertsRaw : [];
        
        if (alerts.length === 0) {
          return json({ ok: false, error: "No alerts found for this trend" }, 404);
        }
        
        // Prepare alert summaries for Claude
        const alertSummaries = alerts.map(a => `
Title: ${a.title}
Country: ${a.country}
Event Type: ${a.event_type}
Severity: ${a.severity}
Summary: ${a.summary}
Location: ${a.location}
Created: ${a.created_at}
        `).join("\n---\n");
        
        // Generate report using Claude
        const reportPrompt = `You are an intelligence analyst. Generate a concise situational report (2-3 paragraphs) for the following trend:

Trend: ${trend.category} in ${trend.country}
Number of related alerts: ${alerts.length}
Date Range: Last 14 days

Recent Alerts:
${alertSummaries}

Please provide:
1. A brief summary of the situation
2. Key risks and implications
3. Recommended actions

Keep the report professional and focused on intelligence analysis.`;

        const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": ANTHROPIC_API_KEY || "",
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-3-haiku-20240307",
            max_tokens: 1000,
            messages: [{
              role: "user",
              content: reportPrompt
            }]
          })
        });
        
        if (!claudeResponse.ok) {
          const errorText = await claudeResponse.text();
          throw new Error(`Claude API error: ${claudeResponse.status} - ${errorText}`);
        }
        
        const claudeData = await claudeResponse.json();
        const reportContent = claudeData.content?.[0]?.text || "Failed to generate report";
        
        // Convert plain text content to HTML format
        const formattedHTML = formatPlainTextAsHTML(reportContent);
        const htmlReport = generateMAGNUSHTMLWrapper(
          `Intelligence Report: ${trend.category}`,
          formattedHTML,
          undefined,
          {
            "Country": trend.country,
            "Category": trend.category,
            "Alerts Analyzed": String(alerts.length),
          }
        );
        
        const report = {
          id: crypto.randomUUID(),
          trend_id: trendId,
          trend_name: trend.category,
          country: trend.country,
          alert_count: alerts.length,
          content: reportContent,
          html: htmlReport,
          generated_at: nowIso(),
          alerts_analyzed: alerts.map(a => ({ id: a.id, title: a.title, severity: a.severity }))
        };
        
        console.log(`[Trends] Generated report for ${trend.country} ${trend.category}`);
        
        return json({ ok: true, report });
      } catch (err: any) {
        console.error("[Trends] Report generation error:", err);
        return json({ ok: false, error: err.message }, 500);
      }
    }

    // DELETE /trends/:id - Delete a trend
    if ((path.includes("/trends/") && !path.includes("/alerts") && !path.includes("/rebuild") && !path.includes("/generate-report")) && method === "DELETE") {
      try {
        const parts = path.split("/");
        const trendIdx = parts.indexOf("trends");
        const trendId = trendIdx >= 0 && trendIdx < parts.length - 1 ? parts[trendIdx + 1] : null;
        
        if (!trendId) {
          return json({ ok: false, error: "Trend ID required" }, 400);
        }
        
        // Delete from KV storage
        await querySupabaseRest(`/app_kv?key=eq.trend-${trendId}`, {
          method: "DELETE"
        });
        
        console.log(`[Trends] Deleted trend ${trendId}`);
        return json({ ok: true, message: "Trend deleted successfully" });
      } catch (err: any) {
        console.error("[Trends] Delete error:", err);
        return json({ ok: false, error: err.message }, 500);
      }
    }








    // POST /alerts/:id/approve-only - Approve without WordPress
    if (path.includes("/alerts/") && path.includes("/approve-only") && method === "POST") {
      try {
        const alertId = path.split("/").filter(p => p).find((_, i, arr) => arr[i-1] === "alerts");
        if (!alertId) return json({ ok: false, error: "Alert ID required" }, 400);
        const result = await approveOnly(alertId);
        return json({ ok: true, alert: result });
      } catch (err: any) {
        return json({ ok: false, error: err.message }, 500);
      }
    }

    // POST /alerts/:id/dismiss - Dismiss alert
    if (path.includes("/alerts/") && path.includes("/dismiss") && method === "POST") {
      try {
        const alertId = path.split("/").filter(p => p).find((_, i, arr) => arr[i-1] === "alerts");
        if (!alertId) return json({ ok: false, error: "Alert ID required" }, 400);
        const result = await dismissAlert(alertId);
        return json({ ok: true, alert: result });
      } catch (err: any) {
        return json({ ok: false, error: err.message }, 500);
      }
    }

    // POST /alerts/:id/approve - Approve and publish to WordPress
    if (path.includes("/alerts/") && path.includes("/approve") && method === "POST" && !path.includes("approve-only")) {
      try {
        const alertId = path.split("/").filter(p => p).find((_, i, arr) => arr[i-1] === "alerts");
        if (!alertId) return json({ ok: false, error: "Alert ID required" }, 400);
        const result = await approveAndPublishToWP(alertId);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (err: any) {
        return json({ ok: false, error: err.message }, 500);
      }
    }

    // POST /alerts/:id/post-to-wp - Post to WordPress (alias for approve)
    if (path.includes("/alerts/") && path.includes("/post-to-wp") && method === "POST") {
      try {
        const alertId = path.split("/").filter(p => p).find((_, i, arr) => arr[i-1] === "alerts");
        if (!alertId) return json({ ok: false, error: "Alert ID required" }, 400);
        const result = await approveAndPublishToWP(alertId);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (err: any) {
        return json({ ok: false, error: err.message }, 500);
      }
    }

    // POST /alerts/:id/publish - Publish to WordPress (alias for approve)
    if (path.includes("/alerts/") && path.includes("/publish") && method === "POST") {
      try {
        const alertId = path.split("/").filter(p => p).find((_, i, arr) => arr[i-1] === "alerts");
        if (!alertId) return json({ ok: false, error: "Alert ID required" }, 400);
        const result = await approveAndPublishToWP(alertId);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (err: any) {
        return json({ ok: false, error: err.message }, 500);
      }
    }

    // POST /alerts/:id/delete - Delete alert (workaround for Supabase DELETE routing limitation)
    if (path.includes("/alerts/") && path.includes("/delete") && method === "POST") {
      try {
        const parts = path.split("/");
        const alertId = parts[parts.length - 2]; // ID is before "/delete"
        if (!alertId) {
          return json({ ok: false, error: "Alert ID required" }, 400);
        }

        console.log(`[Alerts] DELETE via POST: alertId=${alertId}, fullPath=${path}`);

        // Delete the alert from Supabase
        const result = await querySupabaseRest(`/alerts?id=eq.${encodeURIComponent(alertId)}`, {
          method: "DELETE",
        });

        console.log(`[Alerts] DELETE result:`, result);

        return json({ ok: true, deleted: alertId });
      } catch (err: any) {
        console.error(`[Alerts] DELETE error:`, err);
        return json({ ok: false, error: err.message }, 500);
      }
    }

    // GET /admin/users - List all users from Supabase Auth
    if ((path === "/admin/users" || path.endsWith("/admin/users")) && method === "GET") {
      try {
        // Use Supabase Admin Auth API to fetch users
        const adminUrl = `${supabaseUrl}/auth/v1/admin/users`;
        const response = await fetch(adminUrl, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${serviceKey}`,
            "apikey": serviceKey,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const error = await response.text();
          console.error("[Admin] Auth API error:", error);
          return json({ ok: true, users: [] });
        }

        const data = await response.json();
        const users = data.users || [];

        // Transform to standard format
        const formattedUsers = users.map((u: any) => ({
          id: u.id,
          email: u.email,
          name: u.user_metadata?.name || null,
          role: u.user_metadata?.role || "operator",
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
        }));

        return json({ ok: true, users: formattedUsers });
      } catch (err: any) {
        console.error("[Admin] Error fetching users:", err);
        return json({ ok: false, error: err.message }, 500);
      }
    }

    // GET /analytics/sources - Get sources with pagination and search
    if ((path === "/analytics/sources" || path.endsWith("/analytics/sources")) && method === "GET") {
      try {
        const page = parseInt(urlObj.searchParams.get("page") || "1", 10);
        const pageSize = parseInt(urlObj.searchParams.get("pageSize") || "50", 10);
        const search = urlObj.searchParams.get("search") || "";
        const offset = (page - 1) * pageSize;

        let countQuery = "/sources?select=id";
        let dataQuery = `/sources?order=id.desc&limit=${pageSize}&offset=${offset}`;

        // Add search filter if provided
        if (search.trim()) {
          const searchPattern = `%${encodeURIComponent(search.trim())}%`;
          countQuery += `&name=ilike.${searchPattern}`;
          dataQuery += `&name=ilike.${searchPattern}`;
        }

        // Get total count
        const countResponse = await querySupabaseRest(countQuery);
        const total = Array.isArray(countResponse) ? countResponse.length : 0;

        // Get paginated sources
        const sources = await querySupabaseRest(dataQuery);

        // Count enabled sources
        const allSources = await querySupabaseRest("/sources?select=id,enabled");
        const enabledCount = Array.isArray(allSources) 
          ? allSources.filter((s: any) => s.enabled === true).length 
          : 0;

        return json({
          ok: true,
          sources: sources || [],
          total,
          page,
          pageSize,
          pages: Math.ceil(total / pageSize),
          stats: { enabled: enabledCount },
        });
      } catch (error: any) {
        console.error("[Analytics] Error fetching sources:", error);
        return json({ ok: false, error: error?.message }, 500);
      }
    }

    // PATCH /alerts/:id - Update an alert
    if (path.match(/\/alerts\/[a-f0-9\-]+$/) && method === "PATCH") {
      try {
        const alertId = path.split("/").pop();
        if (!alertId) return json({ ok: false, error: "Alert ID required" }, 400);

        const body = await req.json().catch(() => ({}));
        
        // Update the alert in Supabase
        const updated = await querySupabaseRest(`/alerts?id=eq.${encodeURIComponent(alertId)}`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ ...body, updated_at: nowIso() }),
        });

        if (!updated || updated.length === 0) {
          return json({ ok: false, error: "Alert not found" }, 404);
        }

        return json({ ok: true, alert: updated[0] });
      } catch (err: any) {
        console.error(`[Alerts] PATCH error:`, err);
        return json({ ok: false, error: err.message }, 500);
      }
    }

    // DELETE /alerts/:id - Delete an alert
    // Must come after PATCH and handle any path with /alerts/ and DELETE method
    console.log(`[DELETE CHECK] path=${path}, method=${method}, includes_alerts=${path.includes("/alerts/")}`);
    if (path.includes("/alerts/") && method === "DELETE") {
      console.log(`[DELETE MATCHED] Processing delete for path: ${path}`);
      try {
        // Extract alertId - it's the last UUID-like segment
        const parts = path.split("/");
        const alertId = parts[parts.length - 1];
        
        if (!alertId || alertId.length < 10) {
          console.error(`[DELETE] Invalid alert ID: ${alertId}`);
          return json({ ok: false, error: "Invalid Alert ID" }, 400);
        }

        console.log(`[DELETE] Deleting alert ID: ${alertId}`);

        // Delete the alert from Supabase
        const result = await querySupabaseRest(`/alerts?id=eq.${encodeURIComponent(alertId)}`, {
          method: "DELETE",
        });

        console.log(`[DELETE] Delete result:`, result);

        return json({ ok: true, deleted: alertId });
      } catch (err: any) {
        console.error(`[DELETE] Error:`, err);
        return json({ ok: false, error: err.message }, 500);
      }
    }

    // Catch-all 404
    console.log(`[Router] No route matched for: ${method} ${path}`);
    return json({ ok: false, error: `Route not found: ${method} ${path}` }, 404);

  } catch (e: any) {
    console.error(`[Router] Unhandled error:`, e);
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
});

// ============================================================================
// HELPER FUNCTIONS (WORDPRESS + ALERT ACTIONS)
// ============================================================================

async function fetchAlertById(id: string) {
  const rows = await querySupabaseRest(`/alerts?id=eq.${encodeURIComponent(id)}&select=*`);
  return rows?.[0] ?? null;
}

async function patchAlertById(id: string, patch: Record<string, any>) {
  const updated = await querySupabaseRest(`/alerts?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...patch, updated_at: nowIso() }),
  });
  return updated?.[0] ?? null;
}

function buildWpFieldsFromAlert(alert: any) {
  // Convert recommendations string/array to ACF repeater format (array of objects)
  let recommendationsRepeater = [];
  
  if (alert.recommendations) {
    if (typeof alert.recommendations === 'string') {
      // Parse string recommendations into individual items
      const items = alert.recommendations
        .split(/\d+\.\s+/)
        .filter((item: string) => item.trim())
        .slice(0, 5);
      recommendationsRepeater = items.map((item: string, idx: number) => ({
        recommendation_text: item.trim(),
        acf_fc_layout: "recommendation_item"
      }));
    } else if (Array.isArray(alert.recommendations)) {
      recommendationsRepeater = alert.recommendations.map((item: any) => 
        typeof item === 'string' 
          ? { recommendation_text: item.trim(), acf_fc_layout: "recommendation_item" }
          : { ...item, acf_fc_layout: "recommendation_item" }
      );
    }
  }

  return {
    mainland: alert.mainland ?? null,
    intelligence_topics: alert.intelligence_topics ?? alert.event_type ?? null,
    the_location: `${alert.location}, ${alert.country}`,
    latitude: alert.latitude == null ? "" : String(alert.latitude),
    longitude: alert.longitude == null ? "" : String(alert.longitude),
    radius: alert.radius ?? null,
    polygon: alert.geo_json ? JSON.stringify(alert.geo_json) : "",
    start: alert.event_start_date ?? null,
    end: alert.event_end_date ?? null,
    severity: alert.severity,
    recommendations: recommendationsRepeater.length > 0 ? recommendationsRepeater : "",
    sources: alert.article_url || alert.source_url || "",
  };
}

function wpAuthHeader() {
  if (!WP_URL || !WP_USER || !WP_APP_PASSWORD) {
    return null;
  }
  const token = btoa(`${WP_USER}:${WP_APP_PASSWORD}`);
  return `Basic ${token}`;
}

async function postToWordPress(alert: any) {
  const auth = wpAuthHeader();
  
  if (!auth || !WP_URL) {
    const missing = [];
    if (!WP_URL) missing.push("WP_URL/WORDPRESS_URL");
    if (!WP_USER) missing.push("WP_USER/WORDPRESS_USER");
    if (!WP_APP_PASSWORD) missing.push("WP_PASSWORD/WORDPRESS_PASSWORD");
    throw new Error(`WordPress credentials not configured. Missing: ${missing.join(", ")}`);
  }

  console.log(`[WordPress] Posting alert "${alert.title}" to: ${WP_URL}`);

  // ENSURE recommendations are present before posting
  if (!alert.recommendations || (typeof alert.recommendations === 'string' && alert.recommendations.trim() === '')) {
    console.log(`[WordPress] ⚠️  Alert missing recommendations - generating...`);
    
    const generateRecommendations = (eventType: string, severity: string, location: string, country: string): string => {
      let recommendations = "";
      
      if (severity === "critical") {
        recommendations += "1. AVOID all travel to affected area - critical threat to traveler safety. ";
      } else if (severity === "warning") {
        recommendations += "1. RECONSIDER travel to affected area - heightened risk present. ";
      } else {
        recommendations += "1. Exercise extra caution if traveling - localized incident reported. ";
      }
      
      recommendations += "2. Check official government travel advisories for latest updates. ";
      recommendations += "3. Register with your embassy if traveling to affected region. ";
      
      if (eventType?.toLowerCase().includes("health") || eventType?.toLowerCase().includes("outbreak")) {
        recommendations += "4. Follow local health guidance and vaccination requirements. ";
        recommendations += "5. Maintain travel insurance with medical coverage.";
      } else if (eventType?.toLowerCase().includes("weather") || eventType?.toLowerCase().includes("natural")) {
        recommendations += "4. Monitor weather forecasts and local emergency alerts. ";
        recommendations += "5. Have evacuation plans and emergency supplies ready.";
      } else {
        recommendations += "4. Maintain situational awareness and avoid large gatherings. ";
        recommendations += "5. Keep emergency contacts and travel documents accessible.";
      }
      
      return recommendations;
    };
    
    alert.recommendations = generateRecommendations(
      alert.event_type || "Security Incident",
      alert.severity || "warning",
      alert.location || "the affected area",
      alert.country || "Unknown"
    );
  }

  const fields = buildWpFieldsFromAlert(alert);

  // ENSURE description/summary is present
  let content = alert.summary || alert.description || "";
  if (!content || content.trim() === "") {
    console.log(`[WordPress] ⚠️  Alert missing summary/description - using title as content`);
    content = `Alert: ${alert.title}. Location: ${alert.location}, ${alert.country}. Severity: ${alert.severity}. Event Type: ${alert.event_type}. Travelers should monitor this situation and follow local authorities' guidance.`;
  }

  const wpPayload = {
    title: alert.title || "Travel Alert",
    status: "publish",
    content: content,
    fields,
  };

  console.log(`[WordPress] Sending fields:`, JSON.stringify(fields, null, 2));

  const wpRes = await fetch(`${WP_URL}/wp-json/wp/v2/rss-feed`, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(wpPayload),
  });

  if (!wpRes.ok) {
    const text = await wpRes.text();
    console.error(`[WordPress] POST failed ${wpRes.status}:`);
    console.error(`[WordPress] Response: ${text}`);
    throw new Error(`WordPress error ${wpRes.status}: ${text.slice(0, 200)}`);
  }

  const wpPost = await wpRes.json();
  console.log(`[WordPress] ✅ Post created successfully`);
  console.log(`[WordPress] Post ID: ${wpPost.id}`);
  console.log(`[WordPress] Post URL: ${wpPost.link}`);
  console.log(`[WordPress] Post status: ${wpPost.status}`);
  console.log(`[WordPress] Post ACF fields: ${JSON.stringify(wpPost.acf || {})}`);
  console.log(`[WordPress] Full response:`, JSON.stringify(wpPost, null, 2));
  return wpPost;
}

async function approveAndPublishToWP(alertId: string) {
  const alert = await fetchAlertById(alertId);
  if (!alert) {
    return { ok: false, status: 404, body: { ok: false, error: "Alert not found" } };
  }

  try {
    // Publish to WordPress
    const wpPost = await postToWordPress(alert);

    // Update alert with WordPress metadata
    const updated = await patchAlertById(alertId, {
      wordpress_post_id: wpPost.id ?? null,
      wordpress_url: wpPost.link ?? null,
      status: "approved",
    });

    return {
      ok: true,
      status: 200,
      body: {
        ok: true,
        alert: updated,
        wordpress_post_id: wpPost.id ?? null,
        wordpress_url: wpPost.link ?? null,
      },
    };
  } catch (err: any) {
    console.error(`Failed to publish to WordPress: ${err.message}`);
    return {
      ok: false,
      status: 500,
      body: {
        ok: false,
        error: `WordPress publish failed: ${err.message}`,
        alert_id: alertId,
      },
    };
  }
}

async function dismissAlert(alertId: string) {
  const updated = await patchAlertById(alertId, { status: "dismissed" });
  return updated;
}

async function approveOnly(alertId: string) {
  const updated = await patchAlertById(alertId, { status: "approved" });
  return updated;
}

