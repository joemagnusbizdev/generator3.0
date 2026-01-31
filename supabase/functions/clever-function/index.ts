/// <reference lib="deno.unstable" />

console.log("=== Clever Function (Minimal Router) ===");

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const BRAVE_API_KEY = Deno.env.get("BRAVRE_SEARCH_API_KEY");

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

Deno.serve({ skipJwtVerification: true }, async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = new URL(req.url).pathname;
    const method = req.method;

    console.log(`[${method}] ${path}`);

    // Health check
    if (path.endsWith("/health")) {
      return json({
        ok: true,
        time: nowIso(),
        env: {
          CLAUDE_ENABLED: !!ANTHROPIC_API_KEY,
          OPENAI_ENABLED: !!OPENAI_API_KEY,
          BRAVE_ENABLED: !!BRAVE_API_KEY,
        },
      });
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

    // GET /alerts
    if (path.endsWith("/alerts") && method === "GET") {
      try {
        const status = url.searchParams.get("status");
        const limit = url.searchParams.get("limit") || "1000";
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
        const page = parseInt(url.searchParams.get("page") || "1", 10);
        const pageSize = parseInt(url.searchParams.get("pageSize") || "500", 10);
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
        return json({ ok: false, error: error?.message }, 500);
      }
    }

    // POST /scour-sources-v2
    if (path.endsWith("/scour-sources-v2") && method === "POST") {
      try {
        const body = await req.json().catch(() => ({}));
        const jobId = body.jobId || `scour-${crypto.randomUUID()}`;
        const batchOffset = body.batchOffset || 0;
        const batchSize = body.batchSize || 10;
        
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
        
        const result = await workerResponse.json();
        return json({ ok: true, jobId, ...result }, workerResponse.status);
      } catch (err: any) {
        return json({ ok: false, error: err.message }, 500);
      }
    }

    // POST /scour-early-signals
    if (path.endsWith("/scour-early-signals") && method === "POST") {
      try {
        const body = await req.json().catch(() => ({}));
        const workerResponse = await fetch(
          `${supabaseUrl}/functions/v1/scour-worker`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceKey}`,
              'apikey': serviceKey,
            },
            body: JSON.stringify({ ...body, earlySignalsOnly: true }),
          }
        );
        
        const result = await workerResponse.json();
        return json(result, workerResponse.status);
      } catch (err: any) {
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

        // Set stop flag in KV storage
        await setKV(`scour-stop-${jobId}`, { stopped: true, at: nowIso() });

        return json({ 
          ok: true, 
          message: `Scour job ${jobId} stop requested` 
        });
      } catch (err: any) {
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
        if (!OPENAI_API_KEY) return json({ ok: false, error: "OpenAI not configured" }, 500);

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
            model: "claude-3-5-sonnet-20241022",
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

    return json({ ok: false, error: `Not found: ${path}` }, 404);

  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
});

