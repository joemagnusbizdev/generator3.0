// ============================================================================
// SECTION 1 / 4  FOUNDATION (ENV  CORS  TYPES  HELPERS)
// DROP-IN: paste this at the TOP of your edge function file
// ============================================================================

/// <reference lib="deno.unstable" />

// ----------------------------------------------------------------------------
// ENV
// ----------------------------------------------------------------------------
export const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") ?? "").trim();
export const SERVICE_ROLE_KEY = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();

export const OPENAI_API_KEY =
  (Deno.env.get("OPENAI_API_KEY") ?? Deno.env.get("OPENAI_KEY") ?? "").trim();

export const BRAVE_SEARCH_API_KEY =
  (Deno.env.get("BRAVE_SEARCH_API_KEY") ?? Deno.env.get("BRAVE_API_KEY") ?? "").trim();

export const WP_URL = (Deno.env.get("WP_URL") ?? "").trim();
export const WP_USER = (Deno.env.get("WP_USER") ?? "").trim();
export const WP_APP_PASSWORD = (Deno.env.get("WP_APP_PASSWORD") ?? "").trim();

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

// ----------------------------------------------------------------------------
// CORS
// ----------------------------------------------------------------------------
export const corsHeaders: Record<string, string> = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, ...headers },
  });
}

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------
export type Severity = "critical" | "warning" | "caution" | "informative";

export interface Alert {
  id: string;
  title: string;
  summary: string;
  recommendations?: string | null;
  location: string;
  country: string;
  region?: string | null;
  event_type?: string | null;
  severity: Severity;
  status: "draft" | "approved" | "dismissed" | "published";
  source_url?: string | null;
  article_url?: string | null;
  sources?: string | null;
  event_start_date?: string | null;
  event_end_date?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  radius?: number | null;
  geojson?: any;
  ai_generated: boolean;
  ai_model?: string | null;
  ai_confidence?: number | null;
  generation_metadata?: any;
  wordpress_post_id?: number | null;
  wordpress_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScourJob {
  id: string;
  status: "running" | "done" | "error";
  sourceIds: string[];
  daysBack: number;
  processed: number;
  created: number;
  duplicatesSkipped: number;
  errorCount: number;
  errors: string[];
  created_at: string;
  updated_at: string;
  total: number;
  autoScourTriggered?: boolean;
}

// ----------------------------------------------------------------------------
// UTILITIES
// ----------------------------------------------------------------------------
export const nowIso = () => new Date().toISOString();

export function toIsoOrNull(v?: string | null) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export function utf8Safe(s?: string | null) {
  if (!s) return s;
  // normalize common broken sequences
  return s
    .replace(/\u00c3\u00a0/g, "")
    .replace(/\u00c3\u00a9/g, "")
    .replace(/\u00c3\u00b6/g, "")
    .replace(/\u00c3\u00bc/g, "")
    .replace(/\u00ef\u00bf\u00bd/g, "");
}

export function geojsonSummary(geojson: any): string {
  try {
    if (!geojson || !geojson.type) return "Invalid GeoJSON";
    if (geojson.type === "FeatureCollection") return `${geojson.features?.length ?? 0} features`;
    if (geojson.type === "Feature") return "Single feature";
    return geojson.type;
  } catch {
    return "Invalid GeoJSON";
  }
}

export function extractLatLngFromGeoJSON(geojson: any): {
  latitude: number | null;
  longitude: number | null;
  polygon: string | null;
} {
  try {
    if (geojson?.type === "FeatureCollection") {
      const polygon = JSON.stringify(geojson);
      const coords = geojson.features?.[0]?.geometry?.coordinates?.[0];
      if (coords && coords.length) {
        return {
          longitude: Number(coords[0][0]) ?? null,
          latitude: Number(coords[0][1]) ?? null,
          polygon,
        };
      }
      return { latitude: null, longitude: null, polygon };
    }
  } catch {
    /* noop */
  }
  return { latitude: null, longitude: null, polygon: null };
}

// ----------------------------------------------------------------------------
// SUPABASE REST (SERVICE ROLE ONLY)
// ----------------------------------------------------------------------------
export async function querySupabaseRest(pathOrUrl: string, options: RequestInit = {}) {
  const url = pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `${SUPABASE_URL}/rest/v1${pathOrUrl}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
      "Content-Type": "application/json; charset=utf-8",
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Supabase ${res.status}: ${t}`);
  }

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;
  return await res.json();
}

export async function safeQuerySupabaseRest(pathOrUrl: string, options: RequestInit = {}) {
  try {
    return await querySupabaseRest(pathOrUrl, options);
  } catch (e: any) {
    const m = String(e?.message || "");
    if (m.includes("PGRST205") || m.includes("404")) return null;
    throw e;
  }
}

// ----------------------------------------------------------------------------
// KV HELPERS (app_kv)
// ----------------------------------------------------------------------------
export async function getKV(key: string) {
  try {
    const r = await querySupabaseRest(
      `/app_kv?key=eq.${encodeURIComponent(key)}&select=value`
    );
    return r?.[0]?.value ?? null;
  } catch {
    return null;
  }
}

export async function setKV(key: string, value: any) {
  const payload = { key, value, updated_at: nowIso() };
  try {
    await querySupabaseRest(`/app_kv?key=eq.${encodeURIComponent(key)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
  } catch {
    await querySupabaseRest(`/app_kv`, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
  }
}

// ----------------------------------------------------------------------------
// WORDPRESS AUTH (BASE64)
// ----------------------------------------------------------------------------
export function wpAuthHeader() {
  if (!WP_URL || !WP_USER || !WP_APP_PASSWORD) return null;
  const token = btoa(`${WP_USER}:${WP_APP_PASSWORD}`);
  return `Basic ${token}`;
}

// ============================================================================
// END SECTION 1 / 4
// ============================================================================
// ============================================================================
// SECTION 2 / 4  AI EXTRACTION  SCRAPING  SCOUR ENGINE
// DROP-IN: paste DIRECTLY AFTER SECTION 1
// ============================================================================

/* ---------------------------------------------------------------------------
   HTML  TEXT SCRAPER
--------------------------------------------------------------------------- */

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function scrapeUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; MagnusScour/1.0; +https://magnusafety.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) return "";
    const html = await res.text();
    return stripHtml(html).slice(0, 20000);
  } catch {
    return "";
  }
}

/* ---------------------------------------------------------------------------
   BRAVE SEARCH
--------------------------------------------------------------------------- */

async function fetchWithBraveSearch(
  query: string,
  daysBack = 14
): Promise<string> {
  if (!BRAVE_SEARCH_API_KEY) return "";

  try {
    const freshness = `pd${daysBack}`;
    const url =
      `https://api.search.brave.com/res/v1/web/search` +
      `?q=${encodeURIComponent(query)}` +
      `&count=20&freshness=${freshness}`;

    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": BRAVE_SEARCH_API_KEY,
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return "";

    const data = await res.json();
    const results = data.web?.results || [];

    return results
      .map(
        (r: any) =>
          `TITLE: ${r.title}\nURL: ${r.url}\nDESC: ${r.description || ""}\n`
      )
      .join("\n");
  } catch {
    return "";
  }
}

/* ---------------------------------------------------------------------------
   AI EXTRACTION (ALERT GENERATION)
--------------------------------------------------------------------------- */

async function extractAlertsWithAI(
  content: string,
  sourceUrl: string,
  sourceName: string,
  existingAlerts: Alert[],
  daysBack: number
): Promise<Alert[]> {
  if (!OPENAI_API_KEY) return [];

  const now = nowIso();
  const cutoff = new Date(Date.now() - daysBack * 86400000)
    .toISOString()
    .split("T")[0];

  const existingStr = existingAlerts
    .slice(0, 30)
    .map(a => `- ${a.title} (${a.location}, ${a.country})`)
    .join("\n");

  const prompt = `
You are a MAGNUS travel safety analyst.

RULES:
- ONLY events from ${cutoff} onwards
- Avoid duplicates similar to:
${existingStr}

For EACH alert return:
{
  "title": "...",
  "summary": "100-200 words",
  "location": "City / Area",
  "country": "Country",
  "region": "Optional",
  "event_type": "Category",
  "severity": "critical|warning|caution|informative",
  "event_start_date": "YYYY-MM-DD",
  "event_end_date": "YYYY-MM-DD"
}

CONTENT:
${content.slice(0, 12000)}

Return ONLY JSON array.
`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You extract travel safety alerts." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 3500,
    }),
  });

  if (!res.ok) return [];

  const data = await res.json();
  let parsed: any[] = [];

  try {
    parsed = JSON.parse(data.choices[0]?.message?.content ?? "[]");
  } catch {
    const match = data.choices[0]?.message?.content?.match(/\[[\s\S]*\]/);
    if (match) parsed = JSON.parse(match[0]);
  }

  if (!Array.isArray(parsed)) return [];

  return parsed.map(a => ({
    id: crypto.randomUUID(),
    title: utf8Safe(a.title),
    summary: utf8Safe(a.summary),
    recommendations: utf8Safe(a.recommendations ?? null),
    location: utf8Safe(a.location),
    country: utf8Safe(a.country),
    region: utf8Safe(a.region ?? null),
    event_type: utf8Safe(a.event_type ?? null),
    severity: a.severity,
    status: "draft",
    source_url: sourceUrl,
    article_url: sourceUrl,
    sources: sourceName,
    event_start_date: a.event_start_date ?? null,
    event_end_date: a.event_end_date ?? null,
    ai_generated: true,
    ai_model: "gpt-4o-mini",
    ai_confidence: 0.75,
    generation_metadata: {
      extracted_at: now,
      source: sourceName,
      daysBack,
    },
    created_at: now,
    updated_at: now,
  }));
}

/* ---------------------------------------------------------------------------
   SCOUR WORKER
--------------------------------------------------------------------------- */

export async function runScourWorker(
  jobId: string,
  sourceIds: string[],
  daysBack: number
) {
  const stats = {
    processed: 0,
    created: 0,
    duplicatesSkipped: 0,
    errors: [] as string[],
  };

  const existingAlerts =
    (await querySupabaseRest(
      `/alerts?select=id,title,location,country,summary&limit=300`
    )) || [];

  for (const sourceId of sourceIds) {
    try {
      const sources =
        (await querySupabaseRest(`/sources?id=eq.${sourceId}`)) || [];
      const source = sources[0];
      if (!source?.url) continue;

      let content = await fetchWithBraveSearch(
        `${source.name} travel safety`,
        daysBack
      );

      if (content.length < 500) {
        content = await scrapeUrl(source.url);
      }

      if (content.length < 200) continue;

      const extracted = await extractAlertsWithAI(
        content,
        source.url,
        source.name,
        existingAlerts,
        daysBack
      );

      for (const alert of extracted) {
 const dup = existingAlerts.some((e: any) => {
          const samePlace = e.country === alert.country && e.location === alert.location;
          const similarTitle = e.title.toLowerCase().includes(alert.title.toLowerCase().slice(0, 15));
          // If it's the same place and a similar title, it's a duplicate
          return samePlace && similarTitle;
        });

        if (dup) {
          stats.duplicatesSkipped++;
          continue;
        }

        await querySupabaseRest(`/alerts`, {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(alert),
        });

        existingAlerts.push(alert);
        stats.created++;
      }

      stats.processed++;
// Replace the catch block inside the for-loop of runScourWorker:
    } catch (e: any) {
      const errMsg = `Source ${sourceId} failed: ${e?.message || e}`;
      console.error(errMsg);
      stats.errors.push(errMsg);
      // Update KV intermittently so the UI doesn't look "stuck"
      await setKV(`scour_job:${jobId}`, {
        id: jobId,
        status: "running",
        ...stats,
        errorCount: stats.errors.length,
        updated_at: nowIso(),
      });
    }

  } // end for-loop
}   // end runScourWorker


// ============================================================================
// END SECTION 2 / 4
// ============================================================================
// ============================================================================
// SECTION 3 / 4  WORDPRESS (ACF) + ALERT ACTION HELPERS
// DROP-IN: paste DIRECTLY AFTER SECTION 2
// ============================================================================

// ---------------------------------------------------------------------------
// ALERT HELPERS
// ---------------------------------------------------------------------------

async function fetchAlertById(id: string): Promise<Alert | null> {
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

// ---------------------------------------------------------------------------
// WORDPRESS  ACF SCHEMA MAPPING (LOCKED)
// ACF field names you provided:
// mainland (Select)
// intelligence_topics (Select)
// the_location (Text)
// latitude (Text)
// longitude (Text)
// radius (Number)
// polygon (Text)
// start (Date Time Picker)
// end (Date Time Picker)
// severity (Select)
// NOTE: recommendations/sources are NOT in your list; included ONLY if present
//       in WP/ACF. If they don't exist, WP will ignore them harmlessly.
// ---------------------------------------------------------------------------

function buildWpFieldsFromAlert(alert: Alert) {
  const { latitude, longitude, polygon } = extractLatLngFromGeoJSON(alert.geojson);

  // Use explicit DB fields if present; else fall back to geojson centroid-ish values
  const lat = alert.latitude ?? latitude;
  const lng = alert.longitude ?? longitude;

  // Polygon field in your ACF is TEXT: store stringified GeoJSON
  const polyText = alert.geojson ? JSON.stringify(alert.geojson) : polygon;

  // DateTime Picker expects ISO; provide ISO if possible
  const startIso = toIsoOrNull(alert.event_start_date);
  const endIso = toIsoOrNull(alert.event_end_date);

  return {
    // ACF expects select values; if your DB doesn't store them, send null.
    // (WP/ACF will ignore nulls; safer than sending wrong option keys)
    mainland: (alert as any).mainland ?? null,
    intelligence_topics: (alert as any).intelligence_topics ?? (alert.event_type ?? null),

    the_location: `${alert.location}, ${alert.country}`,

    latitude: lat == null ? "" : String(lat),
    longitude: lng == null ? "" : String(lng),
    radius: alert.radius ?? null,

    polygon: polyText ?? "",

    start: startIso,
    end: endIso,

    severity: alert.severity,

    // Optional extras (safe if ACF doesn't have these fields)
    recommendations: alert.recommendations ?? "",
    sources: alert.article_url || alert.source_url || "",
  };
}

async function postToWordPress(alert: Alert) {
  const auth = wpAuthHeader();
  if (!auth || !WP_URL) throw new Error("WordPress credentials not configured");

  const fields = buildWpFieldsFromAlert(alert);

  const wpPayload = {
    title: alert.title || "Travel Alert",
    status: "publish",
    fields,
  };

  const wpRes = await fetch(`${WP_URL}/wp-json/wp/v2/posts`, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(wpPayload),
  });

  if (!wpRes.ok) {
    const t = await wpRes.text();
    throw new Error(`WordPress error ${wpRes.status}: ${t}`);
  }

  return await wpRes.json();
}

// ---------------------------------------------------------------------------
// APPROVE + PUBLISH (USED BY /alerts/:id/approve)
// Also supports legacy /post-to-wp endpoint
// ---------------------------------------------------------------------------


export async function approveAndPublishToWP(alertId: string) {
  const alert = await fetchAlertById(alertId);
  if (!alert) {
    return { ok: false, status: 404, body: { ok: false, error: "Alert not found" } };
  }

  // Publish to WP
  const wpPost = await postToWordPress(alert);

  // Persist WP metadata + published status
  const updated = await patchAlertById(alertId, {
    wordpress_post_id: wpPost.id ?? null,
    wordpress_url: wpPost.link ?? null,
    status: "published",
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
}

// ---------------------------------------------------------------------------
// SIMPLE STATUS TRANSITIONS (USED BY ROUTER)
// ---------------------------------------------------------------------------

export async function dismissAlert(alertId: string) {
  const updated = await patchAlertById(alertId, { status: "dismissed" });
  return updated;
}

export async function approveOnly(alertId: string) {
  const updated = await patchAlertById(alertId, { status: "approved" });
  return updated;
}

// ============================================================================
// END SECTION 3 / 4
// ============================================================================
// ============================================================================

// ============================================================================
// SECTION 4 / 4 — SINGLE Deno.serve ROUTER (ALL ENDPOINTS)
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const method = req.method.toUpperCase();

  let path = url.pathname
    .replace("/functions/v1/clever-function", "")
    .replace("/clever-function", "");

  if (path.endsWith("/") && path.length > 1) {
    path = path.slice(0, -1);
  }

  try {
    // ----------------------------------------------------------------------
    // HEALTH
    // ----------------------------------------------------------------------
    if (path === "/health" && method === "GET") {
      return json({
        ok: true,
        time: nowIso(),
        env: {
          AI_ENABLED: !!OPENAI_API_KEY,
          SCOUR_ENABLED: true,
          WP_CONFIGURED: !!(WP_URL && WP_USER && WP_APP_PASSWORD),
        },
      });
    }

    // ----------------------------------------------------------------------
    // SCOUR STATUS
    // ----------------------------------------------------------------------
    if (path === "/scour/status" && method === "GET") {
      let jobId = url.searchParams.get("jobId") || await getKV("last_scour_job_id");
      if (!jobId) return json({ ok: true, job: null });
      const job = await getKV(`scour_job:${jobId}`);
      return json({ ok: true, job });
    }

    // ----------------------------------------------------------------------
    // SCOUR START
    // ----------------------------------------------------------------------
    if (path === "/scour-sources" && method === "POST") {
      const body = await req.json().catch(() => ({}));
      const sourceIds: string[] = body.sourceIds || [];
      const daysBack = body.daysBack || 14;

      const jobId = crypto.randomUUID();
      const job: ScourJob = {
        id: jobId,
        status: "running",
        sourceIds,
        daysBack,
        processed: 0,
        created: 0,
        duplicatesSkipped: 0,
        errorCount: 0,
        errors: [],
        created_at: nowIso(),
        updated_at: nowIso(),
        total: sourceIds.length,
      };

      await setKV(`scour_job:${jobId}`, job);
      await setKV("last_scour_job_id", jobId);

      EdgeRuntime.waitUntil(
        runScourWorker(jobId, sourceIds, daysBack).catch(async (e) => {
          const err = String(e?.message || e);
          await setKV(`scour_job:${jobId}`, {
            ...job,
            status: "error",
            errorCount: 1,
            errors: [err],
            updated_at: nowIso(),
          });
        })
      );

      return json({ ok: true, jobId, status: "running", total: job.total });
    }

    // ----------------------------------------------------------------------
    // TRENDS
    // ----------------------------------------------------------------------
    if (path === "/trends" && method === "GET") {
      const trends = await safeQuerySupabaseRest("/trends?order=created_at.desc&limit=1000");
      return json({ ok: true, trends: trends || [] });
    }

    if (path === "/trends/rebuild" && method === "POST") {
      // you already validated this logic earlier — reuse it here later
      return json({ ok: true, message: "Rebuild endpoint wired" });
    }

    return json({ ok: false, error: "Not found", path }, 404);
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
});
