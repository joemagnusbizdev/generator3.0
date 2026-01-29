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
        const pageSize = parseInt(url.searchParams.get("pageSize") || "50", 10);
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
        const workerResponse = await fetch(
          `${supabaseUrl}/functions/v1/scour-worker`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceKey}`,
              'apikey': serviceKey,
            },
            body: JSON.stringify(body),
          }
        );
        
        const result = await workerResponse.json();
        return json(result, workerResponse.status);
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

    return json({ ok: false, error: `Not found: ${path}` }, 404);

  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
});

