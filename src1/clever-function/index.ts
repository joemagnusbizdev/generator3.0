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
        const dup = existingAlerts.some(
          (e: any) =>
            e.country === alert.country &&
            e.location === alert.location &&
            e.title.slice(0, 30).toLowerCase() ===
              alert.title.slice(0, 30).toLowerCase()
        );

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
    } catch (e: any) {
      stats.errors.push(String(e?.message || e));
    }
  }

  await setKV(`scour_job:${jobId}`, {
    id: jobId,
    status: "done",
    processed: stats.processed,
    created: stats.created,
    duplicatesSkipped: stats.duplicatesSkipped,
    errorCount: stats.errors.length,
    errors: stats.errors,
    updated_at: nowIso(),
  });

  return stats;
}

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
// SECTION 4 / 4  SINGLE Deno.serve ROUTER (ALL ENDPOINTS)
// DROP-IN: paste DIRECTLY AFTER SECTION 3
// ============================================================================

function stripPrefix(p: string) {
  // support both:
  // /health  AND /clever-function/health
  if (p.startsWith("/clever-function/")) return p.replace("/clever-function", "");
  return p;
}

function parseIdFromPath(p: string): string | null {
  // /alerts/:id or /alerts/:id/action
  const parts = p.split("/").filter(Boolean);
  const idx = parts.indexOf("alerts");
  if (idx === -1) return null;
  return parts[idx + 1] ?? null;
}

async function batchInsert(table: string, records: any[], chunkSize = 100) {
  const results: any[] = [];
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    const inserted = await querySupabaseRest(`/${table}`, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(chunk),
    });
    if (Array.isArray(inserted)) results.push(...inserted);
  }
  return results;
}

async function respondNotFound(path: string) {
  return json({ ok: false, error: "Not found", path }, 404);
}

// ----------------------------------------------------------------------------
// MAIN SERVER
// ----------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  const rawPath = url.pathname;
  const path = stripPrefix(rawPath);

  try {
    // ------------------------------------------------------------------------
    // HEALTH
    // ------------------------------------------------------------------------
    if (path === "/health" && method === "GET") {
      return json({
        ok: true,
        time: nowIso(),
        env: {
          AI_ENABLED: !!OPENAI_API_KEY,
          SCOUR_ENABLED: true,
          AUTO_SCOUR_ENABLED: true,
          WP_CONFIGURED: !!(WP_URL && WP_USER && WP_APP_PASSWORD),
        },
      });
    }

    // ------------------------------------------------------------------------
    // LAST SCOURED
    // ------------------------------------------------------------------------
    if (path === "/last-scoured" && method === "GET") {
      const lastIso = await getKV("last_scoured_timestamp");
      return json({ ok: true, lastIso });
    }

    // ------------------------------------------------------------------------
    // ANALYTICS DASHBOARD
    // ------------------------------------------------------------------------
    if (path === "/analytics/dashboard" && method === "GET") {
      const daysBack = parseInt(url.searchParams.get("days") || "30", 10);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - daysBack);

      const alerts =
        (await querySupabaseRest(`/alerts?created_at=gte.${cutoff.toISOString()}`)) || [];
      const sources = (await querySupabaseRest(`/sources`)) || [];

      const byStatus = alerts.reduce((acc: any, a: any) => {
        acc[a.status] = (acc[a.status] || 0) + 1;
        return acc;
      }, {});
      const byCountry = alerts.reduce((acc: any, a: any) => {
        const c = a.country || "Unknown";
        acc[c] = (acc[c] || 0) + 1;
        return acc;
      }, {});
      const bySeverity = alerts.reduce((acc: any, a: any) => {
        const s = a.severity || "informative";
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      }, {});

      return json({
        ok: true,
        analytics: {
          totalAlerts: alerts.length,
          totalSources: sources.length,
          byStatus,
          byCountry,
          bySeverity,
          period: `Last ${daysBack} days`,
        },
      });
    }

    // ------------------------------------------------------------------------
    // ALERTS  GET ALL
    // ------------------------------------------------------------------------
    if (path === "/alerts" && method === "GET") {
      const status = url.searchParams.get("status");
      const limit = url.searchParams.get("limit") || "1000";
      let endpoint = `/alerts?order=created_at.desc&limit=${limit}`;
      if (status) endpoint = `/alerts?status=eq.${encodeURIComponent(status)}&order=created_at.desc&limit=${limit}`;
      const alerts = await querySupabaseRest(endpoint);
      return json({ ok: true, alerts: alerts || [] });
    }

    // ------------------------------------------------------------------------
    // ALERTS  REVIEW (DRAFT)
    // ------------------------------------------------------------------------
    if (path === "/alerts/review" && method === "GET") {
      const alerts = await querySupabaseRest(
        "/alerts?status=eq.draft&order=created_at.desc&limit=200"
      );
      return json({ ok: true, alerts: alerts || [] });
    }

    // ------------------------------------------------------------------------
    // ALERTS  COMPILE
    // ------------------------------------------------------------------------
    if (path === "/alerts/compile" && method === "POST") {
      const body = await req.json().catch(() => ({}));
      const alertIds: string[] = Array.isArray(body.alertIds) ? body.alertIds : [];
      if (!alertIds.length) return json({ ok: false, error: "alertIds array required" }, 400);

      const ids = alertIds.map((x) => `"${x}"`).join(",");
      const alerts = await querySupabaseRest(`/alerts?id=in.(${ids})`);
      const compiled = {
        id: crypto.randomUUID(),
        title: `Compiled Alert Briefing - ${new Date().toLocaleDateString()}`,
        alerts: alerts || [],
        created_at: nowIso(),
        alert_count: Array.isArray(alerts) ? alerts.length : 0,
      };

      return json({ ok: true, compiled });
    }

    // ------------------------------------------------------------------------
    // ALERTS  CREATE
    // ------------------------------------------------------------------------
    if (path === "/alerts" && method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (!body.title || !body.country || !body.location) {
        return json({ ok: false, error: "Missing required fields: title, country, location" }, 400);
      }

      const now = nowIso();
      const created = await querySupabaseRest("/alerts", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          ...body,
          status: body.status || "draft",
          created_at: body.created_at || now,
          updated_at: now,
        }),
      });

      return json({ ok: true, alert: created?.[0] });
    }

    // ------------------------------------------------------------------------
    // ALERTS  UPDATE (PATCH /alerts/:id)
    // ------------------------------------------------------------------------
    if (path.startsWith("/alerts/") && method === "PATCH") {
      const id = parseIdFromPath(path);
      if (!id) return respondNotFound(rawPath);

      // block action routes from falling through
      if (path.endsWith("/approve") || path.endsWith("/dismiss") || path.endsWith("/post-to-wp")) {
        return respondNotFound(rawPath);
      }

      const body = await req.json().catch(() => ({}));
      const updated = await querySupabaseRest(`/alerts?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ ...body, updated_at: nowIso() }),
      });

      return json({ ok: true, alert: updated?.[0] });
    }

    // ------------------------------------------------------------------------
    // ALERTS  DELETE (DELETE /alerts/:id)
    // ------------------------------------------------------------------------
    if (path.startsWith("/alerts/") && method === "DELETE") {
      const id = parseIdFromPath(path);
      if (!id) return respondNotFound(rawPath);

      // only allow pure /alerts/:id
      if (path.split("/").filter(Boolean).length !== 2) return respondNotFound(rawPath);

      await querySupabaseRest(`/alerts?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
      return json({ ok: true, deleted: id });
    }

    // ------------------------------------------------------------------------
    // ALERTS  DISMISS (POST /alerts/:id/dismiss)
    // ------------------------------------------------------------------------
    if (path.endsWith("/dismiss") && method === "POST") {
      const id = parseIdFromPath(path);
      if (!id) return respondNotFound(rawPath);
      const updated = await dismissAlert(id);
      return json({ ok: true, alert: updated });
    }

    // ------------------------------------------------------------------------
    // ALERTS  APPROVE (POST /alerts/:id/approve)   PUBLISHES TO WP (canonical)
    // ------------------------------------------------------------------------
    if (path.endsWith("/approve") && method === "POST") {
      const id = parseIdFromPath(path);
      if (!id) return respondNotFound(rawPath);

      const result = await approveAndPublishToWP(id);
      return json(result.body, result.status);
    }

    // ------------------------------------------------------------------------
    // LEGACY: POST TO WP (POST /alerts/:id/post-to-wp)
    // ------------------------------------------------------------------------
    if (path.endsWith("/post-to-wp") && method === "POST") {
      const id = parseIdFromPath(path);
      if (!id) return respondNotFound(rawPath);

      const result = await approveAndPublishToWP(id);
      return json(result.body, result.status);
    }

    // ------------------------------------------------------------------------
    // SCOUR  START (POST /scour-sources)
    // Body: { sourceIds?: string[], daysBack?: number, jobId?: string }
    // ------------------------------------------------------------------------
    if (path === "/scour-sources" && method === "POST") {
      const body = await req.json().catch(() => ({}));
      const jobId = body.jobId || crypto.randomUUID();
      const sourceIds: string[] = Array.isArray(body.sourceIds) ? body.sourceIds : [];
      const daysBack = typeof body.daysBack === "number" ? body.daysBack : 14;

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
      await setKV("last_scoured_timestamp", nowIso());

      // fire-and-forget; status polled via /scour/status
      EdgeRuntime.waitUntil(runScourWorker(jobId, sourceIds, daysBack).catch(async (e) => {
          const err = String(e?.message || e);
          const fail = {
            ...job,
            status: "error",
            errorCount: 1,
            errors: [err],
            updated_at: nowIso(),
          };
          await setKV(`scour_job:${jobId}`, fail);
        });

      return json({ ok: true, jobId, status: "running", total: job.total });
    }

    // ------------------------------------------------------------------------
    // SCOUR  STATUS (GET /scour/status?jobId=...)
    // If jobId missing, returns last job (last_scour_job_id).
    // ------------------------------------------------------------------------
    if (path === "/scour/status" && method === "GET") {
      let jobId = url.searchParams.get("jobId");
      if (!jobId) jobId = await getKV("last_scour_job_id");

      if (!jobId) {
        return json({ ok: true, job: null });
      }

      const job = await getKV(`scour_job:${jobId}`);
      return json({
        ok: true,
        job: job || { id: jobId, status: "done", total: 0, processed: 0, created: 0 },
      });
    }

    // ------------------------------------------------------------------------
    // AUTO-SCOUR  STATUS (GET /auto-scour/status)
    // ------------------------------------------------------------------------
    if (path === "/auto-scour/status" && method === "GET") {
      const enabled = await getKV("auto_scour_enabled");
      const intervalMinutes = await getKV("auto_scour_interval_minutes") || 60;
      const lastRun = await getKV("auto_scour_last_run");

      return json({
        ok: true,
        enabled: enabled === true || enabled === "true",
        intervalMinutes: parseInt(String(intervalMinutes), 10),
        lastRun,
        envEnabled: true,
      });
    }

    // ------------------------------------------------------------------------
    // AUTO-SCOUR  TOGGLE (POST /auto-scour/toggle)
    // Body: { enabled: boolean, intervalMinutes?: number }
    // ------------------------------------------------------------------------
    if (path === "/auto-scour/toggle" && method === "POST") {
      const body = await req.json().catch(() => ({}));
      const enabled = body.enabled;

      if (typeof enabled !== "boolean") {
        return json({ ok: false, error: "enabled must be a boolean" }, 400);
      }

      await setKV("auto_scour_enabled", enabled);

      if (typeof body.intervalMinutes === "number" && body.intervalMinutes >= 30) {
        await setKV("auto_scour_interval_minutes", body.intervalMinutes);
      }

      return json({
        ok: true,
        enabled,
        intervalMinutes: typeof body.intervalMinutes === "number" ? body.intervalMinutes : 60,
        message: enabled ? "Auto-scour enabled" : "Auto-scour disabled",
      });
    }

    // ------------------------------------------------------------------------
    // AUTO-SCOUR  RUN NOW (POST /auto-scour/run-now)
    // Starts a scour over enabled sources.
    // ------------------------------------------------------------------------
    if (path === "/auto-scour/run-now" && method === "POST") {
      const sources =
        (await querySupabaseRest("/sources?enabled=eq.true&order=created_at.desc&limit=1000")) || [];
      const sourceIds = sources.map((s: any) => s.id).filter(Boolean);

      if (!sourceIds.length) return json({ ok: false, error: "No enabled sources to scour" }, 400);

      const jobId = crypto.randomUUID();
      const job: ScourJob = {
        id: jobId,
        status: "running",
        sourceIds,
        daysBack: 14,
        processed: 0,
        created: 0,
        duplicatesSkipped: 0,
        errorCount: 0,
        errors: [],
        created_at: nowIso(),
        updated_at: nowIso(),
        total: sourceIds.length,
        autoScourTriggered: true,
      };

      await setKV(`scour_job:${jobId}`, job);
      await setKV("last_scour_job_id", jobId);
      await setKV("auto_scour_last_run", nowIso());

      runScourWorker(jobId, sourceIds, 14).catch(async (e) => {
        const err = String(e?.message || e);
        const fail = {
          ...job,
          status: "error",
          errorCount: 1,
          errors: [err],
          updated_at: nowIso(),
        };
        await setKV(`scour_job:${jobId}`, fail);
      });

      return json({ ok: true, jobId, status: "running", total: job.total, message: "Auto-scour started" });
    }

    // ------------------------------------------------------------------------
    // SOURCES  GET ALL
    // ------------------------------------------------------------------------
    if (path === "/sources" && method === "GET") {
      const limit = url.searchParams.get("limit") || "1000";
      const sources = await querySupabaseRest(`/sources?order=created_at.desc&limit=${limit}`);
      return json({ ok: true, sources: sources || [] });
    }

    // ------------------------------------------------------------------------
    // SOURCES  CREATE
    // ------------------------------------------------------------------------
    if (path === "/sources" && method === "POST") {
      const body = await req.json().catch(() => ({}));
      const created = await querySupabaseRest(`/sources`, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          ...body,
          enabled: body.enabled ?? true,
          created_at: nowIso(),
          updated_at: nowIso(),
        }),
      });

      return json({ ok: true, source: created?.[0] });
    }

    // ------------------------------------------------------------------------
    // SOURCES  BULK UPLOAD (with URL validation)
    // ------------------------------------------------------------------------
    if (path === "/sources/bulk" && method === "POST") {
      const body = await req.json().catch(() => ({}));
      const sourcesData = Array.isArray(body) ? body : body.sources || [];

      if (!Array.isArray(sourcesData) || sourcesData.length === 0) {
        return json({ ok: false, error: "No sources to import" }, 400);
      }

      const preparedSources = sourcesData
        .map((source: any) => ({
          id: crypto.randomUUID(),
          name: source.name || source.Name || source.title || "Untitled Source",
          url: source.url || source.URL || source.link || "",
          country: source.country || source.Country || null,
          enabled: source.enabled !== undefined ? source.enabled : true,
          created_at: nowIso(),
          updated_at: nowIso(),
        }))
        .filter((s: any) => {
          if (!s.url) return false;
          if (!String(s.url).match(/^https?:\/\//)) return false;
          return true;
        });

      const inserted = await batchInsert("sources", preparedSources, 100);
      return json({ ok: true, count: inserted.length, sources: inserted });
    }

    // ------------------------------------------------------------------------
    // SOURCES  BULK DELETE
    // Body: { sourceIds: string[] }
    // ------------------------------------------------------------------------
    if (path === "/sources/bulk-delete" && method === "POST") {
      const body = await req.json().catch(() => ({}));
      const sourceIds: string[] = Array.isArray(body.sourceIds) ? body.sourceIds : [];

      if (!sourceIds.length) return json({ ok: false, error: "No source IDs provided" }, 400);

      const batchSize = 100;
      let deletedCount = 0;

      for (let i = 0; i < sourceIds.length; i += batchSize) {
        const batch = sourceIds.slice(i, i + batchSize);
        const idsString = batch.map((id) => `"${id}"`).join(",");
        await querySupabaseRest(`/sources?id=in.(${idsString})`, { method: "DELETE" });
        deletedCount += batch.length;
      }

      return json({ ok: true, deleted: deletedCount, message: `Successfully deleted ${deletedCount} sources` });
    }

    // ------------------------------------------------------------------------
    // SOURCES  DELETE INVALID
    // ------------------------------------------------------------------------
    if (path === "/sources/delete-invalid" && method === "POST") {
      const allSources = (await querySupabaseRest(`/sources?select=id,name,url`)) || [];
      const invalidSources = allSources.filter((s: any) => !s.url || !String(s.url).match(/^https?:\/\//));

      if (!invalidSources.length) {
        return json({ ok: true, deleted: 0, message: "No invalid sources found" });
      }

      const ids = invalidSources.map((s: any) => s.id);
      const batchSize = 100;
      let deletedCount = 0;

      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const idsString = batch.map((id: string) => `"${id}"`).join(",");
        await querySupabaseRest(`/sources?id=in.(${idsString})`, { method: "DELETE" });
        deletedCount += batch.length;
      }

      return json({
        ok: true,
        deleted: deletedCount,
        invalidSources: invalidSources.map((s: any) => ({ name: s.name, url: s.url })),
        message: `Successfully deleted ${deletedCount} invalid sources`,
      });
    }

    // ------------------------------------------------------------------------
    // SOURCES  UPDATE (PATCH /sources/:id)
    // ------------------------------------------------------------------------
    if (path.startsWith("/sources/") && method === "PATCH") {
      const id = path.split("/").pop()!;
      const body = await req.json().catch(() => ({}));

      const updated = await querySupabaseRest(`/sources?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ ...body, updated_at: nowIso() }),
      });

      return json({ ok: true, source: updated?.[0] });
    }

    // ------------------------------------------------------------------------
    // SOURCES  DELETE (DELETE /sources/:id)
    // ------------------------------------------------------------------------
    if (path.startsWith("/sources/") && method === "DELETE") {
      const id = path.split("/").pop()!;
      await querySupabaseRest(`/sources?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
      return json({ ok: true, deleted: id });
    }

    // ------------------------------------------------------------------------
    // TRENDS  GET ALL
    // ------------------------------------------------------------------------
    if (path === "/trends" && method === "GET") {
      const status = url.searchParams.get("status");
      const limit = url.searchParams.get("limit") || "1000";
      let endpoint = `/trends?order=created_at.desc&limit=${limit}`;
      if (status) endpoint = `/trends?status=eq.${encodeURIComponent(status)}&order=created_at.desc&limit=${limit}`;
      const trends = await safeQuerySupabaseRest(endpoint);
      return json({ ok: true, trends: trends || [] });
    }

    // ------------------------------------------------------------------------
    // TRENDS  GET ONE
    // ------------------------------------------------------------------------
    if (path.startsWith("/trends/") && method === "GET") {
      const id = path.split("/").pop()!;
      const trends = await safeQuerySupabaseRest(`/trends?id=eq.${encodeURIComponent(id)}`);
      if (!trends || trends.length === 0) return json({ ok: false, error: "Trend not found" }, 404);
      return json({ ok: true, trend: trends[0] });
    }

    // ------------------------------------------------------------------------
    // TRENDS  CREATE
    // ------------------------------------------------------------------------
    if (path === "/trends" && method === "POST") {
      const body = await req.json().catch(() => ({}));
      const created = await safeQuerySupabaseRest(`/trends`, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          ...body,
          status: body.status || "open",
          created_at: nowIso(),
          updated_at: nowIso(),
        }),
      });
      if (!created) return json({ ok: false, error: "Trends table not available" }, 500);
      return json({ ok: true, trend: created[0] });
    }

    // ------------------------------------------------------------------------
    // TRENDS  UPDATE
    // ------------------------------------------------------------------------
    if (path.startsWith("/trends/") && method === "PATCH") {
      const id = path.split("/").pop()!;
      const body = await req.json().catch(() => ({}));
      const updated = await safeQuerySupabaseRest(`/trends?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ ...body, updated_at: nowIso() }),
      });
      return json({ ok: true, trend: updated?.[0] });
    }

    // ------------------------------------------------------------------------
    // TRENDS  DELETE
    // ------------------------------------------------------------------------
    if (path.startsWith("/trends/") && method === "DELETE") {
      const id = path.split("/").pop()!;
      await safeQuerySupabaseRest(`/trends?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
      return json({ ok: true, deleted: id });
    }

    return await respondNotFound(rawPath);
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
});

// ============================================================================
// END SECTION 4 / 4
// ============================================================================






