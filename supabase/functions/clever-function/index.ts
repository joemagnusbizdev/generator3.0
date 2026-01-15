/// <reference lib="deno.unstable" />

console.log("=== Function starting ===");

// ============================================================================
// SCOUR WORKER - Inline (with proper column names)
// ============================================================================

interface ScourConfig {
  jobId: string;
  sourceIds: string[];
  daysBack: number;
  supabaseUrl: string;
  serviceKey: string;
  openaiKey: string;
  braveApiKey?: string;
}

interface Alert {
  id: string;
  title: string;
  summary: string;
  location: string;
  country: string;
  region?: string;
  event_type: string;
  severity: 'critical' | 'warning' | 'caution' | 'informative';
  status: 'draft';
  source_url: string;
  article_url?: string;
  sources?: string;
  event_start_date?: string;
  event_end_date?: string;
  ai_generated: boolean;
  ai_model: string;
  ai_confidence?: number;
  generation_metadata?: any;
  created_at: string;
  updated_at: string;
}

async function querySupabaseForWorker(url: string, serviceKey: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'apikey': serviceKey,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase error ${response.status}: ${text}`);
  }

  return response.json();
}

async function fetchWithBraveSearch(query: string, braveApiKey: string): Promise<string> {
  try {
    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10&freshness=pd`,
      {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': braveApiKey,
        },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) {
      throw new Error(`Brave Search failed: ${response.status}`);
    }

    const data = await response.json();
    const results = data.web?.results || [];
    
    return results.map((r: any) => 
      `Title: ${r.title}\nDescription: ${r.description}\nURL: ${r.url}\n\n`
    ).join('');
  } catch (err) {
    console.error('Brave Search error:', err);
    return '';
  }
}

async function scrapeUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(`Scrape failed: ${response.status}`);
    }

    const html = await response.text();
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 15000);
  } catch (err) {
    console.error(`Scrape error for ${url}:`, err);
    return '';
  }
}

async function extractAlertsWithAI(
  content: string,
  source_url: string,
  sourceName: string,
  existingAlerts: Alert[],
  config: ScourConfig
): Promise<Alert[]> {
  const currentDate = new Date().toISOString().split('T')[0];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - config.daysBack);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  const existingAlertsStr = existingAlerts.slice(0, 50).map(a => 
    `- ${a.title} (${a.location}, ${a.country}) [${a.status}]`
  ).join('\n');

  const systemPrompt = `You are MAGNUS travel safety intelligence analyst. Current date: ${currentDate}.

CRITICAL RULES:
1. ONLY extract events from ${cutoffStr} onwards (last ${config.daysBack} days)
2. REJECT any event from 2023 or earlier
3. DO NOT create alerts similar to these existing ones:
${existingAlertsStr}

PRIORITY TOPICS (Extract Individual Alerts):
- Natural disasters, severe weather, infrastructure disruptions
- Transportation disruptions, medical emergencies, political instability
- Mass casualty incidents, terrorism, war/armed conflict
- Hate crimes, ANY Critical/Warning severity events

OUTPUT: JSON array of alerts with these MANDATORY fields:
{
  "severity": "critical"|"warning"|"caution"|"informative",
  "country": "Country name",
  "event_type": "Category",
  "title": "Alert headline",
  "location": "City/location",
  "region": "Regional context",
  "summary": "2-3 sentences under 150 words",
  "source_url": "${source_url}",
  "event_start_date": "2026-01-14T12:00:00Z",
  "event_end_date": "2026-01-17T12:00:00Z"
}

event_end_date: Critical=72h, Warning=48h, Caution=36h, Informative=24h from start.

Return ONLY JSON array, no markdown.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Source: ${sourceName}\n\nContent:\n${content.slice(0, 12000)}` },
        ],
        temperature: 0.2,
        max_tokens: 2500,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`OpenAI failed: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || '[]';
    
    console.log(`AI extracted for ${sourceName}:`, aiResponse.slice(0, 300));

    let alerts: any[] = [];
    
    try {
      const cleaned = aiResponse.trim().replace(/^```json\s*/,'').replace(/\s*```$/,'');
      alerts = JSON.parse(cleaned);
    } catch {
      try {
        const match = aiResponse.match(/\[[\s\S]*\]/);
        if (match) {
          alerts = JSON.parse(match[0]);
        }
      } catch (e) {
        console.error('Parse failed:', e);
        return [];
      }
    }

    if (!Array.isArray(alerts)) {
      return [];
    }

    const now = new Date().toISOString();
    return alerts.map(alert => ({
      id: crypto.randomUUID(),
      title: alert.title,
      summary: alert.summary,
      location: alert.location,
      country: alert.country,
      region: alert.region,
      event_type: alert.event_type,
      severity: alert.severity,
      status: 'draft' as const,
      source_url: source_url,
      article_url: source_url,
      sources: sourceName,
      event_start_date: alert.event_start_date,
      event_end_date: alert.event_end_date,
      ai_generated: true,
      ai_model: 'gpt-4o-mini',
      ai_confidence: 0.8,
      generation_metadata: JSON.stringify({
        extracted_at: now,
        source_name: sourceName,
        days_back: config.daysBack,
      }),
      created_at: now,
      updated_at: now,
    }));

  } catch (err: any) {
    console.error('AI extraction error:', err);
    throw err;
  }
}

async function checkDuplicate(
  newAlert: Alert,
  existingAlert: Alert,
  openaiKey: string
): Promise<boolean> {
  const prompt = `Compare these alerts. Answer ONLY "DUPLICATE" or "SEPARATE":

NEW: ${newAlert.title} (${newAlert.location}, ${newAlert.country})
EXISTING: ${existingAlert.title} (${existingAlert.location}, ${existingAlert.country})`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 10,
      }),
      signal: AbortSignal.timeout(10000),
    });

    const data = await response.json();
    const answer = data.choices[0]?.message?.content?.trim().toUpperCase();
    
    return answer?.includes('DUPLICATE') || false;
  } catch {
    return true;
  }
}

async function runScourWorker(config: ScourConfig): Promise<{
  processed: number;
  created: number;
  duplicates: number;
  errors: string[];
}> {
  const stats = {
    processed: 0,
    created: 0,
    duplicates: 0,
    errors: [] as string[],
  };

  console.log(`Starting scour ${config.jobId} with ${config.sourceIds.length} sources`);

  try {
    const existingAlerts: Alert[] = await querySupabaseForWorker(
      `${config.supabaseUrl}/rest/v1/alerts?select=id,title,location,country,status,summary&limit=500&order=created_at.desc`,
      config.serviceKey
    );

    console.log(`Found ${existingAlerts.length} existing alerts`);

    for (const sourceId of config.sourceIds) {
      try {
        const sources = await querySupabaseForWorker(
          `${config.supabaseUrl}/rest/v1/sources?id=eq.${sourceId}&select=*`,
          config.serviceKey
        );
        const source = sources[0];

        if (!source?.url) {
          stats.errors.push(`Source ${sourceId} not found`);
          continue;
        }

        console.log(`Processing ${source.name}...`);

        let content = '';
        if (config.braveApiKey && source.query) {
          content = await fetchWithBraveSearch(source.query, config.braveApiKey);
        }
        
        if (!content || content.length < 100) {
          content = await scrapeUrl(source.url);
        }

        if (!content || content.length < 50) {
          stats.errors.push(`No content from ${source.name}`);
          continue;
        }

        const extractedAlerts = await extractAlertsWithAI(
          content,
          source.url,
          source.name,
          existingAlerts,
          config
        );

        console.log(`Extracted ${extractedAlerts.length} alerts`);

        for (const alert of extractedAlerts) {
          let isDuplicate = false;

          for (const existing of existingAlerts) {
            const titleMatch = existing.title.toLowerCase().includes(alert.title.toLowerCase().slice(0, 30));
            const locationMatch = existing.location === alert.location && existing.country === alert.country;

            if (titleMatch || locationMatch) {
              const duplicate = await checkDuplicate(alert, existing, config.openaiKey);
              if (duplicate) {
                isDuplicate = true;
                stats.duplicates++;
                break;
              }
            }
          }

          if (!isDuplicate) {
            try {
              await querySupabaseForWorker(
                `${config.supabaseUrl}/rest/v1/alerts`,
                config.serviceKey,
                {
                  method: 'POST',
                  body: JSON.stringify(alert),
                  headers: { 'Prefer': 'return=representation' },
                }
              );
              
              existingAlerts.push(alert);
              stats.created++;
              console.log(`Created: ${alert.title}`);
            } catch (insertErr: any) {
              stats.errors.push(`Insert failed: ${insertErr.message}`);
            }
          }
        }

        stats.processed++;

      } catch (sourceErr: any) {
        stats.errors.push(`Source error: ${sourceErr.message}`);
      }
    }

    return stats;

  } catch (err: any) {
    console.error(`Fatal scour error:`, err);
    throw err;
  }
}

// ============================================================================
// MAIN EDGE FUNCTION - ALL ENDPOINTS
// ============================================================================

Deno.serve(async (req) => {
  console.log("Request:", req.method, req.url);
  
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, content-type, apikey",
      }
    });
  }

  const url = new URL(req.url);
  const path = url.pathname;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const wpUrl = Deno.env.get("WP_URL");
  const wpUser = Deno.env.get("WP_USER");
  const wpPassword = Deno.env.get("WP_APP_PASSWORD");

  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ ok: false, error: "Server configuration error" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        }
      }
    );
  }

  async function querySupabase(endpoint: string, options: RequestInit = {}) {
    const dbUrl = `${supabaseUrl}/rest/v1${endpoint}`;
    const response = await fetch(dbUrl, {
      ...options,
      headers: {
        "Authorization": `Bearer ${serviceKey}`,
        "apikey": serviceKey,
        "Content-Type": "application/json",
        ...options.headers,
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Database error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  async function safeQuerySupabase(endpoint: string, options: RequestInit = {}) {
    try {
      return await querySupabase(endpoint, options);
    } catch (error: any) {
      if (error.message.includes("PGRST205") || error.message.includes("404")) {
        console.warn(`Table not found: ${endpoint}`);
        return null;
      }
      throw error;
    }
  }

  async function getKV(key: string) {
    try {
      const result = await querySupabase(`/app_kv?key=eq.${encodeURIComponent(key)}&select=value`);
      return result[0]?.value ?? null;
    } catch {
      return null;
    }
  }

  async function setKV(key: string, value: any) {
    const data = {
      key,
      value,
      updated_at: new Date().toISOString()
    };
    
    try {
      await querySupabase(`/app_kv?key=eq.${encodeURIComponent(key)}`, {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: { "Prefer": "return=representation" }
      });
    } catch {
      await querySupabase("/app_kv", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Prefer": "return=representation" }
      });
    }
  }

  async function batchInsert(table: string, records: any[], chunkSize = 100) {
    const results = [];
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      const inserted = await querySupabase(`/${table}`, {
        method: "POST",
        body: JSON.stringify(chunk),
        headers: { "Prefer": "return=representation" }
      });
      results.push(...inserted);
    }
    return results;
  }

  try {
    // HEALTH
    if (path === "/health" || path === "/clever-function/health") {
      return new Response(
        JSON.stringify({ 
          ok: true, 
          time: new Date().toISOString(),
          message: "Health check passed",
          env: {
            AI_ENABLED: Deno.env.get("AI_ENABLED") === "true",
            SCOUR_ENABLED: Deno.env.get("SCOUR_ENABLED") === "true",
            AUTO_SCOUR_ENABLED: Deno.env.get("AUTO_SCOUR_ENABLED") === "true",
            WP_CONFIGURED: !!(wpUrl && wpUser && wpPassword),
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          }
        }
      );
    }

    // LAST SCOURED
    if ((path === "/last-scoured" || path === "/clever-function/last-scoured") && req.method === "GET") {
      const lastScoured = await getKV("last_scoured_timestamp");
      return new Response(
        JSON.stringify({ ok: true, lastIso: lastScoured }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          }
        }
      );
    }

    // ANALYTICS
    if ((path === "/analytics/dashboard" || path === "/clever-function/analytics/dashboard") && req.method === "GET") {
      const daysBack = parseInt(url.searchParams.get("days") || "30");
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);
      
      const alerts = await querySupabase(`/alerts?created_at=gte.${cutoffDate.toISOString()}`);
      const sources = await querySupabase("/sources");
      
      const byStatus = alerts.reduce((acc: any, alert: any) => {
        acc[alert.status] = (acc[alert.status] || 0) + 1;
        return acc;
      }, {});
      
      const byCountry = alerts.reduce((acc: any, alert: any) => {
        const country = alert.country || "Unknown";
        acc[country] = (acc[country] || 0) + 1;
        return acc;
      }, {});
      
      const bySeverity = alerts.reduce((acc: any, alert: any) => {
        const severity = alert.severity || "informative";
        acc[severity] = (acc[severity] || 0) + 1;
        return acc;
      }, {});
      
      return new Response(
        JSON.stringify({ 
          ok: true, 
          analytics: {
            totalAlerts: alerts.length,
            totalSources: sources.length,
            byStatus,
            byCountry,
            bySeverity,
            period: `Last ${daysBack} days`
          }
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          }
        }
      );
    }

    // ALERTS - GET ALL
    if ((path === "/alerts" || path === "/clever-function/alerts") && req.method === "GET") {
      const status = url.searchParams.get("status");
      const limit = url.searchParams.get("limit") || "1000";
      let endpoint = `/alerts?order=created_at.desc&limit=${limit}`;
      if (status) {
        endpoint = `/alerts?status=eq.${status}&order=created_at.desc&limit=${limit}`;
      }
      
      const alerts = await querySupabase(endpoint);
      
      return new Response(
        JSON.stringify({ ok: true, alerts }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          }
        }
      );
    }

    // ALERTS - REVIEW
    if ((path === "/alerts/review" || path === "/clever-function/alerts/review") && req.method === "GET") {
      const alerts = await querySupabase("/alerts?status=eq.draft&order=created_at.desc&limit=200");
      
      return new Response(
        JSON.stringify({ ok: true, alerts }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          }
        }
      );
    }

    // ALERTS - COMPILE
    if ((path === "/alerts/compile" || path === "/clever-function/alerts/compile") && req.method === "POST") {
      const body = await req.json();
      const { alertIds } = body;
      
      if (!alertIds || !Array.isArray(alertIds) || alertIds.length === 0) {
        return new Response(
          JSON.stringify({ ok: false, error: "alertIds array required" }),
          { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      }

      const alerts = await querySupabase(`/alerts?id=in.(${alertIds.join(",")})`);
      
      const compiled = {
        id: crypto.randomUUID(),
        title: `Compiled Alert Briefing - ${new Date().toLocaleDateString()}`,
        alerts: alerts,
        created_at: new Date().toISOString(),
        alert_count: alerts.length
      };

      return new Response(
        JSON.stringify({ ok: true, compiled }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          }
        }
      );
    }

    // ALERTS - CREATE
    if ((path === "/alerts" || path === "/clever-function/alerts") && req.method === "POST") {
      const body = await req.json();
      
      if (!body.title || !body.country || !body.location) {
        return new Response(
          JSON.stringify({ 
            ok: false, 
            error: "Missing required fields: title, country, location" 
          }),
          { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      }
      
      const now = new Date().toISOString();
      
      const newAlert = await querySupabase("/alerts", {
        method: "POST",
        body: JSON.stringify({
          id: crypto.randomUUID(),
          ...body,
          status: body.status || "draft",
          created_at: body.created_at || now,
          updated_at: now,
        }),
        headers: {
          "Prefer": "return=representation"
        }
      });
      
      return new Response(
        JSON.stringify({ ok: true, alert: newAlert[0] }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          }
        }
      );
    }

    // ALERTS - UPDATE
    if ((path.startsWith("/alerts/") || path.startsWith("/clever-function/alerts/")) && req.method === "PATCH") {
      const parts = path.split("/");
      const id = parts[parts.length - 1];
      
      if (parts.includes("approve") || parts.includes("dismiss") || parts.includes("post-to-wp")) {
        // Handled below
      } else {
        const body = await req.json();
        
        const updated = await querySupabase(`/alerts?id=eq.${id}`, {
          method: "PATCH",
          body: JSON.stringify({ ...body, updated_at: new Date().toISOString() }),
          headers: {
            "Prefer": "return=representation"
          }
        });
        
        return new Response(
          JSON.stringify({ ok: true, alert: updated[0] }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            }
          }
        );
      }
    }

    // ALERTS - APPROVE
    if ((path.includes("/approve") && req.method === "POST") || 
        (path.includes("/alerts/") && path.includes("/approve"))) {
      const parts = path.split("/");
      const idIndex = parts.findIndex(p => p === "alerts") + 1;
      const id = parts[idIndex];
      
      const updated = await querySupabase(`/alerts?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify({ 
          status: "approved",
          updated_at: new Date().toISOString() 
        }),
        headers: {
          "Prefer": "return=representation"
        }
      });
      
      return new Response(
        JSON.stringify({ ok: true, alert: updated[0] }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          }
        }
      );
    }

    // ALERTS - DISMISS
    if ((path.includes("/dismiss") && req.method === "POST") || 
        (path.includes("/alerts/") && path.includes("/dismiss"))) {
      const parts = path.split("/");
      const idIndex = parts.findIndex(p => p === "alerts") + 1;
      const id = parts[idIndex];
      
      const updated = await querySupabase(`/alerts?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify({ 
          status: "dismissed",
          updated_at: new Date().toISOString() 
        }),
        headers: {
          "Prefer": "return=representation"
        }
      });
      
      return new Response(
        JSON.stringify({ ok: true, alert: updated[0] }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          }
        }
      );
    }

    // ALERTS - POST TO WORDPRESS
    if ((path.includes("/post-to-wp") && req.method === "POST") || 
        (path.includes("/alerts/") && path.includes("/post-to-wp"))) {
      const parts = path.split("/");
      const idIndex = parts.findIndex(p => p === "alerts") + 1;
      const id = parts[idIndex];
      
      if (!wpUrl || !wpUser || !wpPassword) {
        return new Response(
          JSON.stringify({ 
            ok: false, 
            error: "WordPress credentials not configured" 
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            }
          }
        );
      }

      const alerts = await querySupabase(`/alerts?id=eq.${id}`);
      const alert = alerts[0];

      if (!alert) {
        return new Response(
          JSON.stringify({ ok: false, error: "Alert not found" }),
          {
            status: 404,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            }
          }
        );
      }

      const wpAuth = btoa(`${wpUser}:${wpPassword}`);
      const wpResponse = await fetch(`${wpUrl}/wp-json/wp/v2/posts`, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${wpAuth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: alert.title || "Travel Alert",
          content: alert.summary || "",
          status: "publish",
        })
      });

      if (!wpResponse.ok) {
        const errorText = await wpResponse.text();
        return new Response(
          JSON.stringify({ 
            ok: false, 
            error: `WordPress error: ${wpResponse.status} - ${errorText}` 
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            }
          }
        );
      }

      const wpPost = await wpResponse.json();

      const updated = await querySupabase(`/alerts?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify({ 
          wordpress_post_id: wpPost.id,
          wordpress_url: wpPost.link,
          status: "published",
          updated_at: new Date().toISOString() 
        }),
        headers: {
          "Prefer": "return=representation"
        }
      });
      
      return new Response(
        JSON.stringify({ 
          ok: true, 
          alert: updated[0],
          wordpress_post_id: wpPost.id,
          wordpress_url: wpPost.link
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          }
        }
      );
    }

    // ALERTS - DELETE
    if ((path.startsWith("/alerts/") || path.startsWith("/clever-function/alerts/")) && req.method === "DELETE") {
      const parts = path.split("/");
      const id = parts[parts.length - 1];
      
      await querySupabase(`/alerts?id=eq.${id}`, {
        method: "DELETE",
      });
      
      return new Response(
        JSON.stringify({ ok: true, deleted: id }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          }
        }
      );
    }

    // AUTO SCOUR - STATUS
    if ((path === "/auto-scour/status" || path === "/clever-function/auto-scour/status") && req.method === "GET") {
      const enabled = await getKV("auto_scour_enabled");
      const intervalMinutes = await getKV("auto_scour_interval_minutes") || 60;
      const lastRun = await getKV("auto_scour_last_run");
      
      return new Response(
        JSON.stringify({ 
          ok: true, 
          enabled: enabled === true || enabled === "true",
          intervalMinutes: parseInt(intervalMinutes),
          lastRun,
          envEnabled: Deno.env.get("AUTO_SCOUR_ENABLED") === "true"
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          }
        }
      );
    }

    // AUTO SCOUR - TOGGLE
    if ((path === "/auto-scour/toggle" || path === "/clever-function/auto-scour/toggle") && req.method === "POST") {
      const body = await req.json();
      const { enabled, intervalMinutes } = body;
      
      if (typeof enabled !== "boolean") {
        return new Response(
          JSON.stringify({ ok: false, error: "enabled must be a boolean" }),
          { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      }

      await setKV("auto_scour_enabled", enabled);
      
      if (intervalMinutes && typeof intervalMinutes === "number" && intervalMinutes >= 30) {
        await setKV("auto_scour_interval_minutes", intervalMinutes);
      }
      
      return new Response(
        JSON.stringify({ 
          ok: true, 
          enabled,
          intervalMinutes: intervalMinutes || 60,
          message: enabled ? "Auto-scour enabled" : "Auto-scour disabled"
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          }
        }
      );
    }

    // AUTO SCOUR - RUN NOW
    if ((path === "/auto-scour/run-now" || path === "/clever-function/auto-scour/run-now") && req.method === "POST") {
      const sources = await querySupabase("/sources?enabled=eq.true&order=created_at.desc&limit=1000");
      const sourceIds = sources.map((s: any) => s.id);
      
      if (sourceIds.length === 0) {
        return new Response(
          JSON.stringify({ ok: false, error: "No enabled sources to scour" }),
          { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      }

      const jobId = crypto.randomUUID();
      const job = {
        id: jobId,
        status: "running",
        sourceIds,
        daysBack: 14,
        processed: 0,
        created: 0,
        duplicatesSkipped: 0,
        errorCount: 0,
        errors: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        total: sourceIds.length,
        autoScourTriggered: true,
      };

      await setKV(`scour_job:${jobId}`, job);
      await setKV("auto_scour_last_run", new Date().toISOString());
      
      return new Response(
        JSON.stringify({ 
          ok: true, 
          jobId,
          status: "running",
          total: job.total,
          message: "Manual auto-scour started"
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          }
        }
      );
    }

    // SCOUR - START
    if ((path === "/scour-sources" || path === "/clever-function/scour-sources") && req.method === "POST") {
      const body = await req.json();
      const jobId = body.jobId || crypto.randomUUID();
      
      const job = {
        id: jobId,
        status: "running",
        sourceIds: body.sourceIds || [],
        daysBack: body.daysBack || 14,
        processed: 0,
        created: 0,
        duplicatesSkipped: 0,
        errorCount: 0,
        errors: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        total: body.sourceIds?.length || 0,
      };

      await setKV(`scour_job:${jobId}`, job);
      await setKV("last_scoured_timestamp", new Date().toISOString());
      
      const openaiKey = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("OPENAI_KEY");
      const braveApiKey = Deno.env.get("BRAVE_SEARCH_API_KEY");

      if (!openaiKey) {
        return new Response(
          JSON.stringify({ ok: false, error: "OPENAI_API_KEY not configured" }),
          { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      }

      runScourWorker({
        jobId,
        sourceIds: body.sourceIds || [],
        daysBack: body.daysBack || 14,
        supabaseUrl: supabaseUrl!,
        serviceKey: serviceKey!,
        openaiKey,
        braveApiKey,
      }).then(async (stats) => {
        const finalJob = {
          ...job,
          status: "done",
          processed: stats.processed,
          created: stats.created,
          duplicatesSkipped: stats.duplicates,
          errorCount: stats.errors.length,
          errors: stats.errors,
          updated_at: new Date().toISOString(),
        };
        await setKV(`scour_job:${jobId}`, finalJob);
        console.log(`Scour ${jobId} done:`, stats);
      }).catch(async (err) => {
        console.error(`Scour ${jobId} failed:`, err);
        const errorJob = {
          ...job,
          status: "error",
          errorCount: 1,
          errors: [err.message],
          updated_at: new Date().toISOString(),
        };
        await setKV(`scour_job:${jobId}`, errorJob);
      });
      
      return new Response(
        JSON.stringify({ ok: true, jobId, status: "running", total: job.total }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          }
        }
      );
    }

    // SCOUR - STATUS
    if ((path === "/scour/status" || path === "/clever-function/scour/status") && req.method === "GET") {
      const jobId = url.searchParams.get("jobId");
      
      if (!jobId) {
        return new Response(
          JSON.stringify({ ok: false, error: "jobId required" }),
          { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      }

      const job = await getKV(`scour_job:${jobId}`);
      
      return new Response(
        JSON.stringify({ ok: true, job: job || { id: jobId, status: "done", total: 0, processed: 0, created: 0 } }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          }
        }
      );
    }

    // SOURCES - GET ALL
    if ((path === "/sources" || path === "/clever-function/sources") && req.method === "GET") {
      const limit = url.searchParams.get("limit") || "1000";
      const sources = await querySupabase(`/sources?order=created_at.desc&limit=${limit}`);
      
      return new Response(
        JSON.stringify({ ok: true, sources }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          }
        }
      );
    }

    // SOURCES - CREATE
    if ((path === "/sources" || path === "/clever-function/sources") && req.method === "POST") {
      const body = await req.json();
      
      const newSource = await querySupabase("/sources", {
        method: "POST",
        body: JSON.stringify({
          id: crypto.randomUUID(),
          ...body,
          enabled: body.enabled ?? true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
        headers: {
          "Prefer": "return=representation"
        }
      });
      
      return new Response(
        JSON.stringify({ ok: true, source: newSource[0] }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          }
        }
      );
    }

    // SOURCES - BULK UPLOAD
    if ((path === "/sources/bulk" || path === "/clever-function/sources/bulk") && req.method === "POST") {
      const body = await req.json();
      const sourcesData = Array.isArray(body) ? body : body.sources || [];

      if (!Array.isArray(sourcesData) || sourcesData.length === 0) {
        return new Response(
          JSON.stringify({ ok: false, error: "No sources to import" }),
          { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      }

      const preparedSources = sourcesData.map(source => ({
        id: crypto.randomUUID(),
        name: source.name || source.Name || source.title || "Untitled Source",
        url: source.url || source.URL || source.link || "",
        country: source.country || source.Country || null,
        enabled: source.enabled !== undefined ? source.enabled : true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const inserted = await batchInsert("sources", preparedSources, 100);
      
      return new Response(
        JSON.stringify({ 
          ok: true, 
          count: inserted.length,
          sources: inserted 
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          }
        }
      );
    }

    // SOURCES - UPDATE
    if ((path.startsWith("/sources/") || path.startsWith("/clever-function/sources/")) && req.method === "PATCH") {
      const parts = path.split("/");
      const id = parts[parts.length - 1];
      const body = await req.json();
      
      const updated = await querySupabase(`/sources?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...body, updated_at: new Date().toISOString() }),
        headers: {
          "Prefer": "return=representation"
        }
      });
      
      return new Response(
        JSON.stringify({ ok: true, source: updated[0] }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          }
        }
      );
    }

    // SOURCES - DELETE
    if ((path.startsWith("/sources/") || path.startsWith("/clever-function/sources/")) && req.method === "DELETE") {
      const parts = path.split("/");
      const id = parts[parts.length - 1];
      
      await querySupabase(`/sources?id=eq.${id}`, {
        method: "DELETE",
      });
      
      return new Response(
        JSON.stringify({ ok: true, deleted: id }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          }
        }
      );
    }

    // TRENDS - GET ALL
    if ((path === "/trends" || path === "/clever-function/trends") && req.method === "GET") {
      const status = url.searchParams.get("status");
      const limit = url.searchParams.get("limit") || "1000";
      
      let endpoint = `/trends?order=created_at.desc&limit=${limit}`;
      if (status) {
        endpoint = `/trends?status=eq.${status}&order=created_at.desc&limit=${limit}`;
      }
      
      const trends = await safeQuerySupabase(endpoint);
      
      return new Response(
        JSON.stringify({ ok: true, trends: trends || [] }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          }
        }
      );
    }

    // TRENDS - GET ONE
    if ((path.startsWith("/trends/") || path.startsWith("/clever-function/trends/")) && req.method === "GET") {
      const parts = path.split("/");
      const id = parts[parts.length - 1];
      
      const trends = await safeQuerySupabase(`/trends?id=eq.${id}`);
      
      if (!trends || trends.length === 0) {
        return new Response(
          JSON.stringify({ ok: false, error: "Trend not found" }),
          {
            status: 404,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            }
          }
        );
      }
      
      return new Response(
        JSON.stringify({ ok: true, trend: trends[0] }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          }
        }
      );
    }

    // TRENDS - CREATE
    if ((path === "/trends" || path === "/clever-function/trends") && req.method === "POST") {
      const body = await req.json();
      
      const newTrend = await safeQuerySupabase("/trends", {
        method: "POST",
        body: JSON.stringify({
          id: crypto.randomUUID(),
          ...body,
          status: body.status || "open",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
        headers: {
          "Prefer": "return=representation"
        }
      });

      if (!newTrend) {
        return new Response(
          JSON.stringify({ ok: false, error: "Trends table not available" }),
          { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      }
      
      return new Response(
        JSON.stringify({ ok: true, trend: newTrend[0] }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          }
        }
      );
    }

    // TRENDS - UPDATE
    if ((path.startsWith("/trends/") || path.startsWith("/clever-function/trends/")) && req.method === "PATCH") {
      const parts = path.split("/");
      const id = parts[parts.length - 1];
      const body = await req.json();
      
      const updated = await safeQuerySupabase(`/trends?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...body, updated_at: new Date().toISOString() }),
        headers: {
          "Prefer": "return=representation"
        }
      });
      
      return new Response(
        JSON.stringify({ ok: true, trend: updated?.[0] }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          }
        }
      );
    }

    // TRENDS - DELETE
    if ((path.startsWith("/trends/") || path.startsWith("/clever-function/trends/")) && req.method === "DELETE") {
      const parts = path.split("/");
      const id = parts[parts.length - 1];
      
      await safeQuerySupabase(`/trends?id=eq.${id}`, {
        method: "DELETE",
      });
      
      return new Response(
        JSON.stringify({ ok: true, deleted: id }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          }
        }
      );
    }

    // 404
    return new Response(
      JSON.stringify({ ok: false, error: "Not found", path }),
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        }
      }
    );

  } catch (error: any) {
    console.error("Exception:", error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message, stack: error.stack }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        }
      }
    );
  }
});
