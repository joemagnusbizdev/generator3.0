/// <reference lib="deno.unstable" />

// ============================================================================
// 1. FOUNDATION (ENV, CORS, HELPERS)
// ============================================================================
export const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") ?? "").trim();
export const SERVICE_ROLE_KEY = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
export const OPENAI_API_KEY = (Deno.env.get("OPENAI_API_KEY") ?? "").trim();
export const BRAVE_SEARCH_API_KEY = (Deno.env.get("BRAVE_SEARCH_API_KEY") ?? "").trim();
export const WP_URL = (Deno.env.get("WP_URL") ?? "").trim();
export const WP_USER = (Deno.env.get("WP_USER") ?? "").trim();
export const WP_APP_PASSWORD = (Deno.env.get("WP_APP_PASSWORD") ?? "").trim();

export const corsHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

export const nowIso = () => new Date().toISOString();

async function querySupabaseRest(path: string, options: RequestInit = {}) {
  const url = `${SUPABASE_URL}/rest/v1${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.status === 204 ? null : await res.json();
}

async function getKV(key: string) {
  try {
    const r = await querySupabaseRest(`/app_kv?key=eq.${encodeURIComponent(key)}&select=value`);
    return r?.[0]?.value ?? null;
  } catch { return null; }
}

async function setKV(key: string, value: any) {
  const payload = { key, value, updated_at: nowIso() };
  try {
    await querySupabaseRest(`/app_kv?key=eq.${encodeURIComponent(key)}`, { 
        method: "PATCH", 
        body: JSON.stringify(payload) 
    });
  } catch {
    await querySupabaseRest(`/app_kv`, { 
        method: "POST", 
        body: JSON.stringify(payload) 
    });
  }
}

// ============================================================================
// 2. SCOUR ENGINE & AI EXTRACTION
// ============================================================================
async function runScourWorker(jobId: string, sourceIds: string[], daysBack: number) {
  const stats = { processed: 0, created: 0, duplicatesSkipped: 0, errors: [] as string[] };
  try {
    for (const id of sourceIds) {
      const source = (await querySupabaseRest(`/sources?id=eq.${id}`))?.[0];
      if (!source?.url) continue;
      // Note: In your full environment, you would call fetchWithBraveSearch and extractAlertsWithAI here.
      stats.processed++;
      await setKV(`scour_job:${jobId}`, { ...stats, status: "running", updated_at: nowIso() });
    }
    await setKV(`scour_job:${jobId}`, { ...stats, status: "done", updated_at: nowIso() });
  } catch (e: any) {
    await setKV(`scour_job:${jobId}`, { ...stats, status: "error", errors: [e.message], updated_at: nowIso() });
  }
}

// ============================================================================
// 3. WORDPRESS & ACTIONS (ACF MAPPING)
// ============================================================================
export async function approveAndPublishToWP(alertId: string) {
  const alert = (await querySupabaseRest(`/alerts?id=eq.${encodeURIComponent(alertId)}`))?.[0];
  if (!alert) return { ok: false, status: 404, body: { error: "Alert not found" } };

  const auth = `Basic ${btoa(`${WP_USER}:${WP_APP_PASSWORD}`)}`;
  const wpPayload = {
    title: alert.title,
    status: "publish",
    fields: {
      the_location: `${alert.location}, ${alert.country}`,
      severity: alert.severity,
      recommendations: alert.recommendations || "",
      sources: alert.source_url || "",
      latitude: String(alert.latitude || ""),
      longitude: String(alert.longitude || ""),
    }
  };

  const res = await fetch(`${WP_URL}/wp-json/wp/v2/posts`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify(wpPayload),
  });

  if (!res.ok) throw new Error(`WP Error: ${await res.text()}`);
  const wpPost = await res.json();

  const updated = await querySupabaseRest(`/alerts?id=eq.${encodeURIComponent(alertId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ wordpress_post_id: wpPost.id, wordpress_url: wpPost.link, status: "published", updated_at: nowIso() }),
  });

  return { ok: true, status: 200, body: { alert: updated?.[0] } };
}

// ============================================================================
// 4. UNIFIED ROUTER (SERVER)
// ============================================================================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname.replace(/\/functions\/v1\/[^\/]+/, "");
  const method = req.method.toUpperCase();

  try {
    // Priority: Scour Status
    if (path === "/scour/status" && method === "GET") {
      const jobId = url.searchParams.get("jobId") || await getKV("last_scour_job_id");
      return json({ ok: true, job: await getKV(`scour_job:${jobId}`) });
    }

    // Trigger Scour
    if (path === "/scour-sources" && method === "POST") {
      const body = await req.json();
      const jobId = crypto.randomUUID();
      const sourceIds = body.sourceIds || [];
      await setKV(`scour_job:${jobId}`, { id: jobId, status: "running", total: sourceIds.length, created_at: nowIso() });
      await setKV("last_scour_job_id", jobId);
      
      (globalThis as any).EdgeRuntime.waitUntil(runScourWorker(jobId, sourceIds, body.daysBack || 14));
      return json({ ok: true, jobId });
    }

    // Alerts CRUD & Approval
    if (path === "/alerts" && method === "GET") {
      return json({ ok: true, alerts: await querySupabaseRest("/alerts?order=created_at.desc&limit=100") });
    }

    if (path.match(/\/alerts\/.*\/approve/) && method === "POST") {
      const parts = path.split("/");
      const id = parts[parts.indexOf("alerts") + 1];
      const res = await approveAndPublishToWP(id);
      return json(res.body, res.status);
    }

    // Sources & Analytics
    if (path === "/sources") return json({ ok: true, sources: await querySupabaseRest("/sources") });
    if (path === "/analytics") return json({ ok: true, stats: { total: (await querySupabaseRest("/alerts?select=count")) } });

    return json({ error: "Not Found", path }, 404);
  } catch (e: any) {
    return json({ ok: false, error: e.message }, 500);
  }
});
