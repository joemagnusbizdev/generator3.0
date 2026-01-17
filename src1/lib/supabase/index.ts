/// <reference lib="deno.unstable" />

console.log("=== Function starting ===");

Deno.serve(async (req) => {
  console.log("Request received:", req.method, req.url);
  
  // Handle CORS
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
  
  console.log("Path:", path);

  // Get environment variables
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const wpUrl = Deno.env.get("WP_URL");
  const wpUser = Deno.env.get("WP_USER");
  const wpPassword = Deno.env.get("WP_APP_PASSWORD");

  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: "Server configuration error",
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

  // Helper function to query Supabase
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

  // Helper to safely query Supabase (returns null if table doesn't exist)
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

  // Helper to get/set key-value data (for scour jobs)
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

  // Helper to batch insert with chunking
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
    // ========================================================================
    // HEALTH
    // ========================================================================
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

    // GET /last-scoured
    if ((path === "/last-scoured" || path === "/clever-function/last-scoured") && req.method === "GET") {
      const lastScoured = await getKV("last_scoured_timestamp");
      return new Response(
        JSON.stringify({ 
          ok: true, 
          lastIso: lastScoured 
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

    // ========================================================================
    // ALERTS
    // ========================================================================
    
    // GET /alerts or /alerts?status=draft&limit=100
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

    // GET /alerts/review
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

    // GET /alerts/review-queue
    if ((path === "/alerts/review-queue" || path === "/clever-function/alerts/review-queue") && req.method === "GET") {
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

    // POST /alerts/compile
    if ((path === "/alerts/compile" || path === "/clever-function/alerts/compile") && req.method === "POST") {
      const body = await req.json();
      const { alertIds } = body;
      
      if (!alertIds || !Array.isArray(alertIds) || alertIds.length === 0) {
        return new Response(
          JSON.stringify({ ok: false, error: "alertIds array required" }),
          { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      }

      // Fetch the alerts
      const alerts = await querySupabase(`/alerts?id=in.(${alertIds.join(",")})`);
      
      // Compile into a single document
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

    // POST /alerts
    if ((path === "/alerts" || path === "/clever-function/alerts") && req.method === "POST") {
      const body = await req.json();
      
      const newAlert = await querySupabase("/alerts", {
        method: "POST",
        body: JSON.stringify({
          id: crypto.randomUUID(),
          ...body,
          status: body.status || "draft",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
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

    // PATCH /alerts/:id
    if ((path.startsWith("/alerts/") || path.startsWith("/clever-function/alerts/")) && req.method === "PATCH") {
      const parts = path.split("/");
      const id = parts[parts.length - 1];
      
      if (parts.includes("approve") || parts.includes("dismiss") || parts.includes("post-to-wp")) {
        // Handle these below
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

    // POST /alerts/:id/approve
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

    // POST /alerts/:id/dismiss
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

    // POST /alerts/:id/post-to-wp
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
          content: alert.description || "",
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

    // DELETE /alerts/:id
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

    // ========================================================================
    // SCOUR
    // ========================================================================

    // POST /scour-sources
    if ((path === "/scour-sources" || path === "/clever-function/scour-sources") && req.method === "POST") {
      const body = await req.json();
      const jobId = body.jobId || crypto.randomUUID();
      
      const job = {
        id: jobId,
        status: "running",
        sourceIds: body.sourceIds || [],
        maxSources: body.maxSources,
        daysBack: body.daysBack || 14,
        nextIndex: 0,
        processed: 0,
        created: 0,
        duplicatesSkipped: 0,
        lowConfidenceSkipped: 0,
        errorCount: 0,
        errors: [],
        rejections: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        total: body.sourceIds?.length || 0,
      };

      await setKV(`scour_job:${jobId}`, job);
      await setKV("last_scoured_timestamp", new Date().toISOString());
      
      return new Response(
        JSON.stringify({ 
          ok: true, 
          jobId,
          status: "running",
          total: job.total,
          message: "Scour job started"
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

    // GET /scour/status
    if ((path === "/scour/status" || path === "/clever-function/scour/status") && req.method === "GET") {
      const jobId = url.searchParams.get("jobId");
      
      if (!jobId) {
        return new Response(
          JSON.stringify({ ok: false, error: "jobId parameter required" }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            }
          }
        );
      }

      const job = await getKV(`scour_job:${jobId}`);
      
      if (!job) {
        return new Response(
          JSON.stringify({ ok: false, error: "Job not found" }),
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
        JSON.stringify({ ok: true, job }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          }
        }
      );
    }

    // ========================================================================
    // SOURCES
    // ========================================================================

    // GET /sources
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

    // GET /sources/stats
    if ((path === "/sources/stats" || path === "/clever-function/sources/stats") && req.method === "GET") {
      // Try to get stats, but return empty array if table doesn't exist
      const stats = await safeQuerySupabase("/scour_stats?order=last_scoured.desc&limit=1000");
      
      return new Response(
        JSON.stringify({ ok: true, stats: stats || [] }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          }
        }
      );
    }

    // POST /sources
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

    // POST /sources/bulk
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

    // POST /sources/bulk-delete
    if ((path === "/sources/bulk-delete" || path === "/clever-function/sources/bulk-delete") && req.method === "POST") {
      const body = await req.json();
      const { sourceIds } = body;
      
      if (!sourceIds || !Array.isArray(sourceIds) || sourceIds.length === 0) {
        return new Response(
          JSON.stringify({ ok: false, error: "sourceIds array required" }),
          { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      }

      await querySupabase(`/sources?id=in.(${sourceIds.join(",")})`, {
        method: "DELETE",
      });
      
      return new Response(
        JSON.stringify({ ok: true, deleted: sourceIds.length }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          }
        }
      );
    }

    // POST /sources/test
    if ((path === "/sources/test" || path === "/clever-function/sources/test") && req.method === "POST") {
      const body = await req.json();
      const { url: testUrl } = body;
      
      if (!testUrl) {
        return new Response(
          JSON.stringify({ ok: false, error: "url required" }),
          { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      }

      try {
        const testResponse = await fetch(testUrl, {
          method: "HEAD",
          signal: AbortSignal.timeout(12000)
        });
        
        return new Response(
          JSON.stringify({ 
            ok: true, 
            reachable: testResponse.ok,
            status: testResponse.status,
            statusText: testResponse.statusText
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            }
          }
        );
      } catch (error: any) {
        return new Response(
          JSON.stringify({ 
            ok: false, 
            reachable: false,
            error: error.message
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
    }

    // PATCH /sources/:id
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

    // DELETE /sources/:id
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

    // ========================================================================
    // TRENDS
    // ========================================================================

    // GET /trends
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

    // GET /trends/:id
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

    // POST /trends
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

    // PATCH /trends/:id
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

    // DELETE /trends/:id
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

    // ========================================================================
    // 404
    // ========================================================================
    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: "Not found",
        path,
        availableRoutes: [
          "GET /health",
          "GET /last-scoured",
          "GET /alerts",
          "GET /alerts/review",
          "GET /alerts/review-queue",
          "POST /alerts",
          "POST /alerts/compile",
          "PATCH /alerts/:id",
          "POST /alerts/:id/approve",
          "POST /alerts/:id/dismiss",
          "POST /alerts/:id/post-to-wp",
          "DELETE /alerts/:id",
          "POST /scour-sources",
          "GET /scour/status",
          "GET /sources",
          "GET /sources/stats",
          "POST /sources",
          "POST /sources/bulk",
          "POST /sources/bulk-delete",
          "POST /sources/test",
          "PATCH /sources/:id",
          "DELETE /sources/:id",
          "GET /trends",
          "GET /trends/:id",
          "POST /trends",
          "PATCH /trends/:id",
          "DELETE /trends/:id"
        ]
      }),
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
      JSON.stringify({ 
        ok: false, 
        error: error.message ?? String(error),
        stack: error.stack,
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
});




