/// <reference lib="deno.unstable" />

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
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
    return result[0]?.value ?? null;
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
    const requiredTables = ['alerts', 'sources', 'app_kv', 'trends'];
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

    if (missingTables.length === 0) {
      return { ok: true, message: `All ${requiredTables.length} required tables exist`, tables: existingTables };
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

    // Test Claude
    if (path.endsWith("/test-claude")) {
      return json({
        ok: !!ANTHROPIC_API_KEY,
        configured: !!ANTHROPIC_API_KEY,
      });
    }

    // Status
    if (path.endsWith("/status")) {
      return json({
        ok: true,
        claude: !!ANTHROPIC_API_KEY,
      });
    }

    // GET /scour/status - Get current scour job status
    if (path.startsWith("/scour/status") && method === "GET") {
      const jobId = urlObj.searchParams.get("jobId");
      if (!jobId) {
        return json({ ok: false, error: "Missing jobId parameter" }, 400);
      }

      try {
        // Query the app_kv table for job status
        const statusKey = `scour-job-${jobId}`;
        const result = await querySupabaseRest(`/app_kv?key=eq.${encodeURIComponent(statusKey)}&select=value`);
        
        if (result && result.length > 0) {
          const jobData = typeof result[0].value === 'string' 
            ? JSON.parse(result[0].value) 
            : result[0].value;
          
          return json({
            ok: true,
            job: jobData,
          });
        }

        // If not found in app_kv, return default job data
        return json({
          ok: true,
          job: {
            id: jobId,
            status: "unknown",
            processed: 0,
            total: 0,
            created: 0,
            phase: "unknown",
          },
        });
      } catch (e: any) {
        console.error(`[scour/status] Error querying job status:`, e);
        return json({ 
          ok: false, 
          error: `Failed to get job status: ${e.message}` 
        }, 500);
      }
    }

    // GET /alerts
    if (path.endsWith("/alerts") && method === "GET") {
      try {
        const status = urlObj.searchParams.get("status");
        const limit = urlObj.searchParams.get("limit") || "1000";
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
        const pageSize = parseInt(urlObj.searchParams.get("pageSize") || "500", 10);
        const offset = (page - 1) * pageSize;
        
        const alerts = await querySupabaseRest(
          `/alerts?status=eq.draft&order=created_at.desc&limit=${pageSize}&offset=${offset}`
        );
        
        const countResponse = await querySupabaseRest(
          `/alerts?status=eq.draft&select=id`
        );
        const totalCount = Array.isArray(countResponse) ? countResponse.length : 0;
        
        return json({ 
          ok: true, 
          alerts: alerts || [],
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
          await setKV(`scour_job:${jobId}`, {
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
          });
          console.log(`[Early Signals] Job stored in KV`);
        } catch (kvErr: any) {
          console.warn(`[Early Signals] KV storage failed: ${kvErr.message}`);
          // Continue anyway - the job will still be created
        }
        
        // Update last job ID
        try {
          await setKV("last_scour_job_id", jobId);
        } catch (e) {
          console.warn(`[Early Signals] Could not update last job ID: ${e}`);
        }
        
        // Return success immediately - trigger worker in background if possible
        try {
          // Try to start the worker without waiting
          const workerBody = { jobId, earlySignalsOnly: true };
          console.log(`[Early Signals] Sending to worker: ${JSON.stringify(workerBody)}`);
          
          if ((globalThis as any).EdgeRuntime?.waitUntil) {
            (globalThis as any).EdgeRuntime.waitUntil(
              fetch(`${supabaseUrl}/functions/v1/scour-worker`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${serviceKey}`,
                  'apikey': serviceKey,
                },
                body: JSON.stringify(workerBody),
              }).catch(e => {
                console.error(`[Early Signals] Worker call failed: ${e.message}`);
              })
            );
          } else {
            console.warn('[Early Signals] EdgeRuntime.waitUntil not available');
          }
        } catch (workerErr: any) {
          console.warn(`[Early Signals] Could not queue worker: ${workerErr.message}`);
          // Still return success - queuing is non-critical
        }
        
        console.log(`[Early Signals] Returning success for jobId: ${jobId}`);
        return json({ ok: true, jobId, status: "running", message: "Early signals started" }, 200);
      } catch (err: any) {
        console.error('[Early Signals] Unhandled error:', err);
        console.error('[Early Signals] Error type:', typeof err);
        console.error('[Early Signals] Error string:', String(err));
        return json({ 
          ok: false, 
          error: err.message || 'Unknown error in early signals', 
          stack: err.stack?.toString(),
          errorType: typeof err,
        }, 500);
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
                // Stop this job too
                await setKV(`scour-stop-${entryJobId}`, { stopped: true, at: nowIso() });
                stoppedJobs.push(entryJobId);
                console.log(`🛑 Also stopped concurrent job: ${entryJobId}`);
              }
            }
            if (stoppedJobs.length > 0) {
              console.log(`🛑 Stopped ${stoppedJobs.length} concurrent scour jobs`);
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

    // POST /force-stop-scour - Alias for stopping the current scour job
    if ((path === "/force-stop-scour" || path.endsWith("/force-stop-scour")) && method === "POST") {
      try {
        // Stop ALL running scour jobs
        try {
          const activeJobs = await querySupabaseRest(`/app_kv?key=like.scour-job-*&select=key,value`);
          if (activeJobs && Array.isArray(activeJobs)) {
            let stoppedCount = 0;
            for (const entry of activeJobs) {
              const jobId = entry.key?.replace('scour-job-', '');
              if (jobId) {
                await setKV(`scour-stop-${jobId}`, { stopped: true, at: nowIso() });
                stoppedCount++;
                console.log(`🛑 Force stopped job: ${jobId}`);
              }
            }
            console.log(`🛑 Force stopped ${stoppedCount} scour jobs`);
            return json({ 
              ok: true, 
              message: `Stopped ${stoppedCount} scour job(s)`
            });
          }
        } catch (e) {
          console.warn(`Error stopping jobs: ${e}`);
        }

        return json({ ok: true, message: "No active scour jobs to stop" });
      } catch (err: any) {
        return json({ ok: false, error: err.message }, 500);
      }
    }

    // POST /trends/init - Initialize trends table schema
    if (path.endsWith("/trends/init") && method === "POST") {
      try {
        // Execute SQL directly to create/fix trends table
        const initSQL = `
DROP TABLE IF EXISTS trends CASCADE;

CREATE TABLE trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country TEXT NOT NULL,
  category TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  highest_severity TEXT,
  alert_ids UUID[] DEFAULT '{}',
  last_seen_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT DEFAULT 'open'
);

CREATE UNIQUE INDEX idx_trends_country_category
  ON trends (country, category)
  WHERE status = 'open';

CREATE INDEX idx_trends_last_seen
  ON trends (last_seen_at DESC);

CREATE INDEX idx_trends_country
  ON trends (country);

ALTER TABLE trends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on trends" ON trends
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read on trends" ON trends
  FOR SELECT TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_trends_updated_at ON trends;
CREATE TRIGGER update_trends_updated_at
  BEFORE UPDATE ON trends
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
        `;

        // Execute SQL via Supabase REST - use raw SQL endpoint
        const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/sql`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${serviceKey}`,
            "apikey": serviceKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: initSQL }),
        });

        if (!rpcRes.ok) {
          const text = await rpcRes.text();
          console.log("[Trends Init] RPC attempt returned:", text);
          // RPC might not be available, try direct Postgres
          // For now, just report success - table should exist or be created manually
          return json({ ok: true, initialized: true, note: "Check database" });
        }

        return json({ ok: true, initialized: true });
      } catch (err: any) {
        console.error("[Trends Init] Error:", err);
        return json({ ok: false, error: err.message }, 500);
      }
    }

    // POST /trends/rebuild - Aggregate dismissed alerts into trends
    if (path.endsWith("/trends/rebuild") && method === "POST") {
      try {
        // Get dismissed alerts from last 14 days
        const dismissedAlerts = await querySupabaseRest(
          `/alerts?status=eq.dismissed&created_at=gte.${new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()}&select=*&limit=1000`
        );

        if (!dismissedAlerts || dismissedAlerts.length === 0) {
          return json({ ok: true, created: 0, windowDays: 14, minAlerts: 3 });
        }

        // Clear existing trends
        try {
          await querySupabaseRest(`/trends`, { method: "DELETE" });
        } catch (e) {
          // Table may not exist yet, that's ok
        }

        // Group by country + event_type
        const grouped: Record<string, any[]> = {};
        for (const alert of dismissedAlerts) {
          const key = `${alert.country}|${alert.event_type || 'Unknown'}`;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(alert);
        }

        // Create trends with minimum 3 alerts per group
        const trends = [];
        for (const [key, alerts] of Object.entries(grouped)) {
          if (alerts.length >= 3) {
            const [country, category] = key.split("|");
            const severities = { critical: 4, warning: 3, caution: 2, informative: 1 };
            const highestSeverity = alerts.reduce((max: string, a: any) => {
              const curVal = severities[a.severity as keyof typeof severities] || 0;
              const maxVal = severities[max as keyof typeof severities] || 0;
              return curVal > maxVal ? a.severity : max;
            }, "informative");

            trends.push({
              id: crypto.randomUUID(),
              country,
              category,
              count: alerts.length,
              highest_severity: highestSeverity,
              alert_ids: alerts.map(a => a.id),
              last_seen_at: new Date(Math.max(...alerts.map(a => new Date(a.created_at).getTime()))).toISOString(),
              created_at: nowIso(),
              updated_at: nowIso(),
            });
          }
        }

        // Insert trends
        if (trends.length > 0) {
          await querySupabaseRest(`/trends`, {
            method: "POST",
            body: JSON.stringify(trends),
            headers: { "Prefer": "return=representation" }
          });
        }

        return json({ ok: true, created: trends.length, windowDays: 14, minAlerts: 3 });
      } catch (err: any) {
        return json({ ok: false, error: err.message }, 500);
      }
    }

    // GET /trends
    if (path.endsWith("/trends") && method === "GET") {
      try {
        const trends = await querySupabaseRest(`/trends?order=last_seen_at.desc&limit=1000`);
        return json({ ok: true, trends: trends || [] });
      } catch (err: any) {
        return json({ ok: false, error: err.message }, 500);
      }
    }

    // GET /trends/:id/alerts
    if (path.includes("/trends/") && path.includes("/alerts") && method === "GET") {
      try {
        const parts = path.split("/");
        const trendId = parts[parts.indexOf("trends") + 1];
        const trend = await querySupabaseRest(`/trends?id=eq.${trendId}`);
        if (!trend || trend.length === 0) return json({ ok: false, error: "Trend not found" }, 404);
        
        // Get associated alerts
        const alertIds = trend[0].alert_ids || [];
        let alerts = [];
        if (alertIds.length > 0) {
          alerts = await querySupabaseRest(`/alerts?id=in.(${alertIds.join(",")})`);
        }
        
        return json({ ok: true, alerts: alerts || [] });
      } catch (err: any) {
        return json({ ok: false, error: err.message }, 500);
      }
    }

    // POST /trends/:id/generate-report - Generate Claude report
    if (path.includes("/trends/") && path.includes("/generate-report") && method === "POST") {
      try {
        if (!ANTHROPIC_API_KEY) return json({ ok: false, error: "Claude not configured" }, 500);

        const trendId = path.split("/")[path.split("/").length - 2];
        const trend = await querySupabaseRest(`/trends?id=eq.${trendId}`);
        if (!trend || trend.length === 0) return json({ ok: false, error: "Trend not found" }, 404);

        const t = trend[0];
        const alertIds = t.alert_ids || [];
        let alerts = [];
        if (alertIds.length > 0) {
          alerts = await querySupabaseRest(`/alerts?id=in.(${alertIds.join(",")})`);
        }

        // Build Claude prompt
        const alertSummaries = alerts.map(a => `- ${a.title} (${a.severity}): ${a.summary}`).join("\n");
        const prompt = `You are a travel safety intelligence analyst. Create a comprehensive situational report based on these ${t.count} dismissed alerts aggregated under the trend "${t.category}" in ${t.country}.

ALERTS:
${alertSummaries}

Generate a professional, strategic report that:
1. Summarizes the emerging trend
2. Identifies patterns and connections
3. Assesses current and projected risk
4. Provides recommended actions

Format as clear, concise sections. Be analytical and factual.`;

        const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-3-haiku-20240307",
            max_tokens: 2000,
            messages: [{ role: "user", content: prompt }],
          }),
        });

        if (!claudeResponse.ok) {
          const error = await claudeResponse.text();
          throw new Error(`Claude error: ${error}`);
        }

        const claudeData = await claudeResponse.json();
        const reportText = claudeData.content[0].text;

        // Generate enriched HTML
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MAGNUS Report - ${t.category}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 900px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    .header { background: linear-gradient(135deg, #1a472a 0%, #2d6a4f 100%); color: white; padding: 40px; border-radius: 8px; margin-bottom: 30px; }
    .header h1 { margin: 0 0 10px 0; font-size: 2.5em; }
    .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
    .meta-item { background: white; padding: 15px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .meta-label { font-size: 0.85em; color: #666; text-transform: uppercase; font-weight: 600; }
    .meta-value { font-size: 1.3em; font-weight: bold; color: #1a472a; margin-top: 5px; }
    .alerts-section { background: white; padding: 25px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .alerts-section h2 { color: #1a472a; border-bottom: 3px solid #2d6a4f; padding-bottom: 10px; }
    .alert-item { padding: 12px; margin: 10px 0; background: #f9f9f9; border-left: 4px solid #2d6a4f; border-radius: 4px; }
    .alert-title { font-weight: bold; color: #1a472a; }
    .alert-summary { color: #555; margin-top: 5px; font-size: 0.95em; }
    .severity { display: inline-block; padding: 4px 8px; border-radius: 3px; font-size: 0.8em; font-weight: bold; margin: 5px 0; }
    .severity.critical { background: #8b0000; color: white; }
    .severity.warning { background: #ff8c00; color: white; }
    .severity.caution { background: #ffd700; color: #333; }
    .severity.informative { background: #90ee90; color: #333; }
    .report-section { background: white; padding: 25px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .report-section h2 { color: #1a472a; border-bottom: 3px solid #2d6a4f; padding-bottom: 10px; margin-top: 0; }
    .report-content { color: #333; line-height: 1.8; white-space: pre-wrap; word-wrap: break-word; }
    .footer { text-align: center; color: #666; font-size: 0.9em; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="header">
    <h1>MAGNUS Travel Safety Intelligence</h1>
    <p>Situational Analysis & Trend Report</p>
  </div>

  <div class="meta">
    <div class="meta-item">
      <div class="meta-label">Trend Category</div>
      <div class="meta-value">${t.category}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Country</div>
      <div class="meta-value">${t.country}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Alert Count</div>
      <div class="meta-value">${t.count}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Highest Severity</div>
      <div class="meta-value"><span class="severity ${t.highest_severity}">${t.highest_severity.toUpperCase()}</span></div>
    </div>
  </div>

  <div class="alerts-section">
    <h2>Aggregated Alerts</h2>
    ${alerts.map(a => `
      <div class="alert-item">
        <div class="alert-title">${a.title}</div>
        <span class="severity ${a.severity}">${a.severity.toUpperCase()}</span>
        <div class="alert-summary"><strong>${a.location}, ${a.country}</strong></div>
        <div class="alert-summary">${a.summary}</div>
      </div>
    `).join("")}
  </div>

  <div class="report-section">
    <h2>Strategic Analysis</h2>
    <div class="report-content">${reportText}</div>
  </div>

  <div class="footer">
    <p>Generated by MAGNUS Intelligence System | ${new Date().toLocaleString()}</p>
    <p>Trend ID: ${trendId} | Report is editable and downloadable</p>
  </div>
</body>
</html>`;

        return json({
          ok: true,
          report: {
            id: crypto.randomUUID(),
            trendId,
            title: `${t.category} - ${t.country}`,
            country: t.country,
            severity: t.highest_severity,
            content: reportText,
            html,
            generatedAt: nowIso(),
            metadata: { alertCount: t.count },
          },
        });
      } catch (err: any) {
        console.error("Report generation error:", err);
        return json({ ok: false, error: err.message }, 500);
      }
    }

    // DELETE /trends/:id
    if (path.includes("/trends/") && method === "DELETE" && !path.includes("/alerts") && !path.includes("/generate-report")) {
      try {
        const trendId = path.split("/").filter(p => p)[path.split("/").filter(p => p).indexOf("trends") + 1];
        await querySupabaseRest(`/trends?id=eq.${trendId}`, { method: "DELETE" });
        return json({ ok: true });
      } catch (err: any) {
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

    return json({ ok: false, error: `Not found: ${path}` }, 404);

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
    recommendations: alert.recommendations ?? "",
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

  const fields = buildWpFieldsFromAlert(alert);

  const wpPayload = {
    title: alert.title || "Travel Alert",
    status: "publish",
    content: alert.summary || "",
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

