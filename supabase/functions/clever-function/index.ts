/// <reference lib="deno.unstable" />
/**
 * Supabase Edge Function â€” clever-function/index.ts
 * DROP-IN REPLACEMENT â€” locked-down AI/Scour + WP export + resumable jobs
 *
 * Key fixes included:
 * âœ… NO duplicate function declarations (BOOT_ERROR fix)
 * âœ… Date inference when model omits eventStartDate (prevents mass "missing_eventStartDate" rejects)
 * âœ… Keeps all routes your UI expects
 */

import { Hono } from "npm:hono@4.6.3";
import { cors } from "npm:hono@4.6.3/cors";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

// -------------------------
// Routing prefix support
// -------------------------
const PREFIX = "/clever-function";
const app = new Hono();

type AnyHandler = (c: any) => any;

function mountGet(path: string, handler: AnyHandler) {
  app.get(path, handler);
  app.get(`${PREFIX}${path}`, handler);
}
function mountPost(path: string, handler: AnyHandler) {
  app.post(path, handler);
  app.post(`${PREFIX}${path}`, handler);
}
function mountPatch(path: string, handler: AnyHandler) {
  app.patch(path, handler);
  app.patch(`${PREFIX}${path}`, handler);
}
function mountDelete(path: string, handler: AnyHandler) {
  app.delete(path, handler);
  app.delete(`${PREFIX}${path}`, handler);
}

// -------------------------
// Env
// -------------------------
const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") ?? "").trim();
const SERVICE_KEY = (
  Deno.env.get("SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_KEY") ??
  Deno.env.get("SUPABASE_KEY") ??
  ""
).trim();

const OPENAI_API_KEY = (Deno.env.get("OPENAI_API_KEY") ?? Deno.env.get("OPENAI_KEY") ?? "").trim();
const BRAVE_API_KEY = (
  Deno.env.get("BRAVE_SEARCH_API_KEY") ??
  Deno.env.get("BRAVE_API_KEY") ??
  Deno.env.get("BRAVE_SEARCH_API_TOKEN") ??
  ""
).trim();

const CRON_SECRET = (Deno.env.get("CRON_SECRET") ?? "").trim();
const AUTO_SCOUR_ENABLED = String(Deno.env.get("AUTO_SCOUR_ENABLED") ?? "false").toLowerCase() === "true";
const ADMIN_SECRET = (Deno.env.get("ADMIN_SECRET") ?? "").trim();

// ðŸ”’ lockdown flags (default OFF)
const AI_ENABLED = String(Deno.env.get("AI_ENABLED") ?? "false").toLowerCase() === "true";
const SCOUR_ENABLED = String(Deno.env.get("SCOUR_ENABLED") ?? "false").toLowerCase() === "true";
const SCOUR_ALLOWED_EMAILS = String(Deno.env.get("SCOUR_ALLOWED_EMAILS") ?? "").trim();

const AI_DAYS_BACK = Number(Deno.env.get("AI_DAYS_BACK") ?? "14");
const AI_DAILY_LIMIT = Number(Deno.env.get("AI_DAILY_LIMIT") ?? "50");
const SCOUR_DAILY_LIMIT = Number(Deno.env.get("SCOUR_DAILY_LIMIT") ?? "30");

const WP_URL = (Deno.env.get("WP_URL") ?? Deno.env.get("WORDPRESS_SITE_URL") ?? "").trim();
const WP_USER = (Deno.env.get("WP_USER") ?? Deno.env.get("WORDPRESS_USERNAME") ?? "").trim();
const WP_APP_PASSWORD = (Deno.env.get("WP_APP_PASSWORD") ?? Deno.env.get("WORDPRESS_APP_PASSWORD") ?? "").trim();

if (!SUPABASE_URL) throw new Error("SUPABASE_URL missing");
if (!SERVICE_KEY) throw new Error("SERVICE_ROLE key missing (SERVICE_ROLE_KEY)");

// -------------------------
// Middleware (CORS FIRST)
// -------------------------
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["authorization", "content-type", "apikey", "x-cron-secret", "x-admin-secret"],
    maxAge: 86400,
  }),
);
app.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS") return c.text("", 204);
  await next();
});

// -------------------------
// Supabase service client
// -------------------------
const supabaseService = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// -------------------------
// Helpers
// -------------------------
function nowIso(): string {
  return new Date().toISOString();
}
function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}
function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  const s = Math.max(1, Math.floor(size || 1));
  for (let i = 0; i < arr.length; i += s) out.push(arr.slice(i, i + s));
  return out;
}
function stripUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as Partial<T>;
}
function pickHostname(u: string): string | null {
  try {
    return new URL(u).host || null;
  } catch {
    return null;
  }
}
function requireAdmin(req: Request): boolean {
  if (!ADMIN_SECRET) return false;
  const h = (req.headers.get("x-admin-secret") ?? "").trim();
  return h === ADMIN_SECRET;
}
function isCron(req: Request): boolean {
  const s = (req.headers.get("x-cron-secret") ?? "").trim();
  return !!CRON_SECRET && s === CRON_SECRET;
}
function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 20000): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(t));
}

// Robust body parsing (works even if Request.clone() is flaky)
async function readJsonBody(c: any): Promise<any> {
  try {
    const KEY = "__raw_body_buf__";
    const getter = (c as any)?.get?.bind(c);
    const setter = (c as any)?.set?.bind(c);

    let buf: ArrayBuffer | null = null;

    if (getter) buf = getter(KEY) ?? null;
    if (!buf) {
      buf = await c.req.raw.arrayBuffer();
      if (setter) setter(KEY, buf);
    }

    const text = new TextDecoder().decode(buf).trim();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  } catch {
    return {};
  }
}

// -------------------------
// Auth + permission gates
// -------------------------
interface AuthUser {
  id: string;
  email: string | null;
  role: 'operator' | 'analyst' | 'admin';
  name: string | null;
}

async function getAuthUser(req: Request): Promise<{ id: string; email: string | null } | null> {
  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const token = m[1].trim();
  if (!token) return null;

  const { data, error } = await supabaseService.auth.getUser(token);
  if (error || !data?.user) return null;

  return { id: data.user.id, email: data.user.email ?? null };
}

// Get full user details including role from user_metadata
async function getAuthUserWithRole(req: Request): Promise<AuthUser | null> {
  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const token = m[1].trim();
  if (!token) return null;

  const { data, error } = await supabaseService.auth.getUser(token);
  if (error || !data?.user) return null;

  const role = (data.user.user_metadata?.role ?? 'operator').toLowerCase();
  const validRole = ['admin', 'analyst', 'operator'].includes(role) ? role as AuthUser['role'] : 'operator';

  return {
    id: data.user.id,
    email: data.user.email ?? null,
    role: validRole,
    name: data.user.user_metadata?.name ?? data.user.user_metadata?.full_name ?? null,
  };
}

// Check if current user is admin (via JWT role or admin secret header)
async function isAdminUser(req: Request): Promise<boolean> {
  // Admin secret bypass for scripts/automation
  if (requireAdmin(req)) return true;
  
  // Check user role from JWT
  const user = await getAuthUserWithRole(req);
  return user?.role === 'admin';
}

function emailAllowed(email: string | null): boolean {
  if (!email) return false;
  const allow = SCOUR_ALLOWED_EMAILS
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!allow.length) return false; // strict default: nobody
  return allow.includes(email.toLowerCase());
}

async function enforceQuota(kind: "ai" | "scour", userId: string, limit: number) {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
  const key = `${kind}_quota:${day}:${userId}`;

  const { data } = await supabaseService.from("app_kv").select("value").eq("key", key).maybeSingle();
  const prev = Number((data as any)?.value?.count ?? 0) || 0;

  if (prev >= limit) return { ok: false as const, count: prev, limit };

  await supabaseService.from("app_kv").upsert({
    key,
    value: { count: prev + 1, limit, day },
    updated_at: nowIso(),
  });

  return { ok: true as const, count: prev + 1, limit };
}

function mustHaveAiKeys() {
  return !!OPENAI_API_KEY && !!BRAVE_API_KEY;
}

async function requireScourAccess(c: any) {
  // admin-secret bypass for scripts
  if (requireAdmin(c.req.raw)) return { ok: true as const, user: { id: "admin", email: null } };

  const user = await getAuthUser(c.req.raw);
  if (!user) return { ok: false as const, status: 401, error: "unauthorized" };

  if (!AI_ENABLED) return { ok: false as const, status: 403, error: "ai_disabled" };
  if (!SCOUR_ENABLED) return { ok: false as const, status: 403, error: "scour_disabled" };
  if (!mustHaveAiKeys()) return { ok: false as const, status: 500, error: "missing_ai_keys" };

  if (!emailAllowed(user.email)) return { ok: false as const, status: 403, error: "not_allowed" };

  const aiq = await enforceQuota("ai", user.id, clamp(AI_DAILY_LIMIT, 0, 100000));
  if (!aiq.ok) return { ok: false as const, status: 429, error: "ai_quota_exceeded", meta: aiq };

  const sq = await enforceQuota("scour", user.id, clamp(SCOUR_DAILY_LIMIT, 0, 100000));
  if (!sq.ok) return { ok: false as const, status: 429, error: "scour_quota_exceeded", meta: sq };

  return { ok: true as const, user };
}

async function auditLog(event: string, payload: any) {
  try {
    const key = `audit:${Date.now()}:${crypto.randomUUID()}`;
    await supabaseService.from("app_kv").upsert({ key, value: { event, ...payload }, updated_at: nowIso() });
  } catch {
    // ignore
  }
}

// -------------------------
// Cron throttling (90m)
// -------------------------
async function shouldRunCron(intervalMinutes: number): Promise<{ run: boolean; lastIso?: string }> {
  const key = "auto_scour_last_run";
  const now = Date.now();

  const { data } = await supabaseService.from("app_kv").select("value, updated_at").eq("key", key).maybeSingle();
  const lastIso = (data as any)?.value?.lastIso ? String((data as any).value.lastIso) : "";
  const last = lastIso ? Date.parse(lastIso) : 0;

  if (last && now - last < intervalMinutes * 60_000) return { run: false, lastIso };

  await supabaseService.from("app_kv").upsert({
    key,
    value: { lastIso: new Date(now).toISOString() },
    updated_at: new Date(now).toISOString(),
  });

  return { run: true, lastIso: lastIso || undefined };
}

// -------------------------
// WordPress helpers
// -------------------------
function wpEnabled(): boolean {
  return !!WP_URL && !!WP_USER && !!WP_APP_PASSWORD;
}
function wpAuthHeader(): string {
  const token = btoa(`${WP_USER}:${WP_APP_PASSWORD}`);
  return `Basic ${token}`;
}
function alertToWpHtml(a: any): string {
  const esc = (s: any) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const advice = Array.isArray(a.advice) ? a.advice.map((x: any) => String(x ?? "").trim()).filter(Boolean) : [];
  const adviceHtml = advice.length ? `<h3>Advice</h3><ul>${advice.map((x: any) => `<li>${esc(x)}</li>`).join("")}</ul>` : "";

  return `
<p><strong>Country:</strong> ${esc(a.country ?? "")}</p>
${a.location ? `<p><strong>Location:</strong> ${esc(a.location)}</p>` : ""}
${a.summary ? `<p>${esc(a.summary)}</p>` : ""}
${adviceHtml}
  `.trim();
}
async function postToWordpress(alertRow: any): Promise<{ wpId: number }> {
  if (!wpEnabled()) throw new Error("WordPress env missing (WP_URL/WP_USER/WP_APP_PASSWORD)");

  const baseUrl = WP_URL.replace(/\/$/, "");
  const endpoint = "/wp-json/wp/v2/rss-feed";
  const fullUrl = `${baseUrl}${endpoint}`;

  const payload = {
    title: alertRow.title ?? "Travel Safety Alert",
    content: alertToWpHtml(alertRow),
    status: "publish",
  };

  const res = await fetchWithTimeout(
    fullUrl,
    {
      method: "POST",
      headers: {
        Authorization: wpAuthHeader(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    },
    20000,
  );

  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`WP post failed (${res.status}) ${text}`);

  const data = JSON.parse(text);
  const id = Number(data?.id);
  if (!Number.isFinite(id)) throw new Error("WP response missing post id");
  return { wpId: id };
}

// -------------------------
// Geo helpers (circle polygon)
// -------------------------
function toRad(d: number): number {
  return (d * Math.PI) / 180;
}
function toDeg(r: number): number {
  return (r * 180) / Math.PI;
}
function circlePolygonGeoJSON(lat: number, lng: number, radiusKm: number, points = 28) {
  const earthKm = 6371;
  const angDist = radiusKm / earthKm;
  const latRad = toRad(lat);
  const lngRad = toRad(lng);

  const coords: [number, number][] = [];
  for (let i = 0; i <= points; i++) {
    const bearing = (2 * Math.PI * i) / points;

    const sinLat = Math.sin(latRad);
    const cosLat = Math.cos(latRad);
    const sinAng = Math.sin(angDist);
    const cosAng = Math.cos(angDist);

    const lat2 = Math.asin(sinLat * cosAng + cosLat * sinAng * Math.cos(bearing));
    const lng2 = lngRad + Math.atan2(Math.sin(bearing) * sinAng * cosLat, cosAng - sinLat * Math.sin(lat2));

    coords.push([Number(toDeg(lng2).toFixed(6)), Number(toDeg(lat2).toFixed(6))]);
  }

  return {
    type: "Feature",
    properties: { shape: "circle", radiusKm },
    geometry: { type: "Polygon", coordinates: [coords] },
  };
}

type Severity = "critical" | "warning" | "caution" | "informative";

function normSeverity(s: any): Severity {
  const v = String(s ?? "").toLowerCase().trim();
  if (v === "critical") return "critical";
  if (v === "warning") return "warning";
  if (v === "caution") return "caution";
  return "informative";
}

function severityRank(s: any): number {
  const v = normSeverity(s);
  if (v === "critical") return 4;
  if (v === "warning") return 3;
  if (v === "caution") return 2;
  return 1;
}

function parseSeverityFloor(v: any): Severity {
  const s = String(v ?? "").toLowerCase().trim();
  if (s === "critical") return "critical";
  if (s === "warning") return "warning";
  if (s === "caution") return "caution";
  return "informative";
}

// Severity floor per source (optional column)
function getSourceSeverityFloor(src: any): Severity {
  return parseSeverityFloor(src?.min_severity ?? src?.severity_floor ?? "informative");
}

function radiusBySeverityKm(sev: any, geoScope?: any, eventType?: any): number {
  const s = normSeverity(sev);
  let r = s === "critical" ? 150 : s === "warning" ? 75 : s === "caution" ? 40 : 20;

  const gs = String(geoScope ?? "").toLowerCase().trim();
  if (gs === "multinational") r = Math.max(r, 300);
  else if (gs === "national") r = Math.max(r, 200);
  else if (gs === "regional") r = Math.max(r, 120);
  else if (gs === "city") r = Math.max(r, 35);

  const et = String(eventType ?? "").toLowerCase();
  if (et.includes("weather") || et.includes("storm") || et.includes("flood") || et.includes("wildfire")) r = Math.round(r * 1.3);
  else if (et.includes("protest") || et.includes("unrest") || et.includes("strike")) r = Math.round(r * 0.9);

  return Math.max(5, Math.min(500, r));
}

// Mandatory fields enforcement (lat/lng/geoJSON/dates)
function ensureGeoAndTime(draft: any) {
  const sev = normSeverity(draft?.severity ?? draft?.severity_level ?? draft?.risk ?? "caution");
  const geoScope = String(draft?.geoScope ?? draft?.geo_scope ?? "local");

  const lat = Number(draft?.latitude);
  const lng = Number(draft?.longitude);

  const startIso = draft?.eventStartDate ? String(draft.eventStartDate) : nowIso();

  let endIso = draft?.eventEndDate ? String(draft.eventEndDate) : "";
  if (!endIso) {
    const hrs = sev === "critical" ? 72 : sev === "warning" ? 48 : sev === "caution" ? 36 : 24;
    endIso = new Date(Date.now() + hrs * 3600_000).toISOString();
  }

  let radiusKm = Number(draft?.radiusKm);
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) radiusKm = radiusBySeverityKm(sev, geoScope, draft?.eventType ?? draft?.event_type);

  let geojson = draft?.geoJSON ?? draft?.geojson ?? null;
  if (!geojson && Number.isFinite(lat) && Number.isFinite(lng)) geojson = circlePolygonGeoJSON(lat, lng, radiusKm, 28);

  const missingGeo = !Number.isFinite(lat) || !Number.isFinite(lng) || !geojson || !Number.isFinite(radiusKm);
  return { sev, geoScope, lat, lng, radiusKm, geojson, startIso, endIso, missingGeo };
}

// -------------------------
// Conservative severity clamp
// -------------------------
function looksLikeGenericAdvisory(draft: any): boolean {
  const title = String(draft?.title ?? "").toLowerCase();
  const summary = String(draft?.summary ?? "").toLowerCase();
  const srcs = Array.isArray(draft?.sources) ? draft.sources : [];
  const urls = srcs.map((s: any) => String(s?.url ?? s ?? "").toLowerCase());

  const listicleSignals = [
    "full list",
    "over 20 countries",
    "see full list",
    "countries see full list",
    "highest level",
    "level 4",
    "do not travel warning for over",
    "do not travel for over",
  ];

  const genericSignals = ["travel advisory", "travel warning", "security alert: do not travel"];

  const badDomains = [
    "travelandtourworld.com",
    "timesofindia.indiatimes.com",
    "news18.com",
    "theprint.in",
  ];

  const hitSignals =
    listicleSignals.some((k) => title.includes(k) || summary.includes(k)) ||
    (genericSignals.some((k) => title.includes(k)) && summary.length < 240);

  const hitDomain = urls.some((u) => badDomains.some((d) => u.includes(d)));

  return hitSignals || hitDomain;
}

function hasCredibleSource(draft: any): boolean {
  const srcs = Array.isArray(draft?.sources) ? draft.sources : [];
  const urls = srcs.map((s: any) => String(s?.url ?? s ?? "").toLowerCase());

  const okDomains = [
    ".gov/",
    ".gov.",
    "usembassy.gov",
    "gov.uk",
    "who.int",
    "cdc.gov",
    "reuters.com",
    "apnews.com",
    "bbc.co.uk",
    "bbc.com",
    "aljazeera.com",
    "dw.com",
    "france24.com",
    "un.org",
    "iata.org",
  ];

  return urls.some((u) => okDomains.some((d) => u.includes(d)));
}

function clampSeverityConservative(sev: any, draft: any): Severity {
  const s = normSeverity(sev);

  // Never allow "critical" from the model; downgrade to warning
  if (s === "critical") return "warning";

  // For generic/listicle content, never above caution
  if (looksLikeGenericAdvisory(draft)) {
    return (s === "warning" || s === "critical") ? "caution" : s;
  }

  return s;
}

// -------------------------
// Scour stats + auto-disable
// -------------------------
type ScourStat = {
  t: string;
  outcome: "created" | "dup" | "reject" | "low" | "error";
  reason?: string;
  severity?: Severity;
  confidence?: number;
};

type ScourStatsState = {
  sourceId: string;
  history: ScourStat[];
  consecutiveRejects: number;
  consecutiveNoCreate: number;
  totalCreated: number;
  totalRuns: number;
  disabledBySystem?: boolean;
  disabledReason?: string;
  lastIso?: string;
};

function scourStatsKey(sourceId: string) {
  return `scour_stats:${String(sourceId)}`;
}

async function loadScourStats(sourceId: string): Promise<ScourStatsState> {
  const key = scourStatsKey(sourceId);
  const { data } = await supabaseService.from("app_kv").select("value").eq("key", key).maybeSingle();
  const v = (data as any)?.value;
  if (v && typeof v === "object") return v as ScourStatsState;

  return {
    sourceId: String(sourceId),
    history: [],
    consecutiveRejects: 0,
    consecutiveNoCreate: 0,
    totalCreated: 0,
    totalRuns: 0,
    lastIso: null as any,
  };
}

async function saveScourStats(state: ScourStatsState) {
  const key = scourStatsKey(state.sourceId);
  state.lastIso = nowIso();
  await supabaseService.from("app_kv").upsert({
    key,
    value: state,
    updated_at: state.lastIso,
  });
}

const AUTO_DISABLE_CONSEC_NO_CREATE = 6;
const AUTO_DISABLE_CONSEC_REJECT_LOW = 5;

async function maybeAutoDisableSource(sourceId: string, state: ScourStatsState) {
  if (state.disabledBySystem) return;

  const shouldDisable =
    (state.totalRuns >= AUTO_DISABLE_CONSEC_NO_CREATE && state.consecutiveNoCreate >= AUTO_DISABLE_CONSEC_NO_CREATE) ||
    state.consecutiveRejects >= AUTO_DISABLE_CONSEC_REJECT_LOW;

  if (!shouldDisable) return;

  try {
    await supabaseService.from("sources").update({ enabled: false }).eq("id", sourceId);
    state.disabledBySystem = true;
    state.disabledReason =
      state.consecutiveRejects >= AUTO_DISABLE_CONSEC_REJECT_LOW
        ? `auto_disabled_consecutive_reject_low_${state.consecutiveRejects}`
        : `auto_disabled_consecutive_no_create_${state.consecutiveNoCreate}`;
    await saveScourStats(state);
  } catch {
    // ignore
  }
}

async function recordScourOutcome(sourceId: string, stat: ScourStat): Promise<ScourStatsState> {
  const st = await loadScourStats(sourceId);

  st.totalRuns = (st.totalRuns ?? 0) + 1;

  const outcome = stat.outcome;
  const isCreate = outcome === "created";
  const isRejectLow = outcome === "reject" || outcome === "low";

  st.consecutiveNoCreate = isCreate ? 0 : (st.consecutiveNoCreate ?? 0) + 1;
  st.consecutiveRejects = isRejectLow ? (st.consecutiveRejects ?? 0) + 1 : 0;

  if (isCreate) st.totalCreated = (st.totalCreated ?? 0) + 1;

  st.history = Array.isArray(st.history) ? st.history : [];
  st.history.push({ ...stat, t: stat.t || nowIso() });

  if (st.history.length > 30) st.history = st.history.slice(st.history.length - 30);

  await saveScourStats(st);
  await maybeAutoDisableSource(sourceId, st);
  return st;
}

// -------------------------
// Brave Search (freshness=pd)
// -------------------------
type BraveResult = { url: string; title?: string; description?: string; age?: string };
type BraveFreshness = "pd" | "pw" | "pm" | "py";

async function braveSearch(query: string, count = 20, freshness: BraveFreshness = "pm"): Promise<BraveResult[]> {
  if (!BRAVE_API_KEY) throw new Error("BRAVE_API_KEY missing");

  const endpoint = new URL("https://api.search.brave.com/res/v1/web/search");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("count", String(count));
  endpoint.searchParams.set("safesearch", "moderate");
  endpoint.searchParams.set("country", "US");
  endpoint.searchParams.set("freshness", freshness);

  // Guideline: 10 second timeout for web search
  const res = await fetchWithTimeout(
    endpoint.toString(),
    { headers: { Accept: "application/json", "X-Subscription-Token": BRAVE_API_KEY } },
    10000,
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Brave search failed (${res.status}) ${txt}`);
  }

  const data = await res.json().catch(() => null);
  const items = data?.web?.results ?? [];
  return (items ?? [])
    .filter((it: any) => it?.url)
    .map((it: any) => ({
      url: String(it.url),
      title: it.title ? String(it.title) : undefined,
      description: it.description ? String(it.description) : undefined,
      age: it.age ? String(it.age) : undefined,
    }));
}

function isJunkUrl(url: string): boolean {
  const u = url.toLowerCase();
  const junkPatterns = [
  "/tag/", "/tags/",
  "/topic/", "/topics/",
  "/category/", "/categories/",
  "/opinion", "/editorial"
];
  if (junkPatterns.some((p) => u.includes(p))) return true;
  try {
    const parsed = new URL(url);
} catch {
    return true;
  }
  return false;
}

function filterAndRankResults(results: BraveResult[], limit = 8): BraveResult[] {
  const seen = new Set<string>();
  const unique: BraveResult[] = [];
  for (const r of results) {
    const key = (r.url ?? "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(r);
  }
  return unique.filter((r) => !!r.url && !isJunkUrl(r.url)).slice(0, limit);
}

function buildSourceQueries(src: any) {
  const incidentHints =
    "travel advisory OR security alert OR protest OR strike OR airport closure OR flood OR wildfire OR earthquake OR outbreak OR unrest OR kidnapping OR terrorism OR shooting";
  const name = String(src?.name ?? "").trim();
  const country = String(src?.country ?? "").trim();
  const topics = Array.isArray(src?.topics) ? src.topics.join(" ") : "";
  const host = pickHostname(String(src?.url ?? ""));
  const isX = host === "x.com" || host === "twitter.com";

  const strict = host && !isX ? `site:${host} ${name} ${topics} ${incidentHints}`.trim() : `${name} ${topics} ${incidentHints}`.trim();
  const siteOnly = host && !isX ? `site:${host} ${topics} ${incidentHints}`.trim() : `${topics} ${incidentHints}`.trim();
  const broad = `${country} ${topics} ${incidentHints}`.trim();

  return [strict, siteOnly, broad].filter(Boolean);
}

// -------------------------
// URL Scraping Fallback (per AI guidelines)
// -------------------------
async function scrapeUrlContent(url: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html,application/xhtml+xml",
        },
      },
      8000, // 8 second timeout per guidelines
    );

    if (!res.ok) return null;

    const html = await res.text();
    
    // Basic HTML to text extraction
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();

    // Limit to first 3000 chars for AI processing
    return text.slice(0, 3000) || null;
  } catch {
    return null;
  }
}

async function getContentWithFallback(
  src: any,
  queries: string[],
  daysBack: number
): Promise<{ braveResults: BraveResult[]; scrapedContent?: string; queryUsed: string }> {
  let braveResults: BraveResult[] = [];
  let queryUsed = "";

  // Try Brave Search first (per guidelines)
  if (BRAVE_API_KEY) {
    for (const q of queries) {
      queryUsed = q;
      try {
        const raw = await braveSearch(q, 15, daysBack <= 2 ? "pd" : daysBack <= 7 ? "pw" : "pm");
        const ranked = filterAndRankResults(raw, 8);
        if (ranked.length >= 2) {
          braveResults = ranked;
          break;
        }
      } catch (e) {
        // Continue to next query or fallback
      }
    }
  }

  // Fallback to URL scraping if Brave fails or no API key (per guidelines)
  if (!braveResults.length && src?.url) {
    const scraped = await scrapeUrlContent(String(src.url));
    if (scraped && scraped.length > 100) {
      return {
        braveResults: [{
          url: String(src.url),
          title: src.name ?? "Source content",
          description: scraped.slice(0, 500),
        }],
        scrapedContent: scraped,
        queryUsed: `direct_scrape:${src.url}`,
      };
    }
  }

  return { braveResults, queryUsed };
}

// -------------------------
// OpenAI generation
// -------------------------
type GeneratedAlert = {
  ok: boolean;
  confidence: number;
  reason?: string;

  title?: string;
  country?: string | null;
  location?: string | null;
  summary?: string;
  advice?: string[];
  sources?: Array<{ url: string; title?: string }>;
  dedupeUrls?: string[];

  severity?: Severity;
  eventType?: string | null;
  geoScope?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  geoJSON?: any;
  eventStartDate?: string;
  eventEndDate?: string;
};

function parseIsoOrNull(s: any): number | null {
  const t = Date.parse(String(s ?? ""));
  return Number.isFinite(t) ? t : null;
}

/**
 * Infer event start date when the model omits it.
 * Uses Brave "age" if present, then URL date patterns, then "today" if results exist.
 */
function inferEventStartDateFromBrave(results: BraveResult[]): string | null {
  try {
    const now = Date.now();

    // 1) Brave age like "2 days ago", "5 hours ago", "30 min ago"
    for (const r of results ?? []) {
      const age = String((r as any)?.age ?? "").toLowerCase().trim();
      if (!age) continue;

      let ms: number | null = null;

      let m = age.match(/(\d+)\s*day/);
      if (m) ms = Number(m[1]) * 24 * 3600_000;

      if (!ms) {
        m = age.match(/(\d+)\s*hour/);
        if (m) ms = Number(m[1]) * 3600_000;
      }

      if (!ms) {
        m = age.match(/(\d+)\s*min/);
        if (m) ms = Number(m[1]) * 60_000;
      }

      if (ms && Number.isFinite(ms)) {
        const d = new Date(now - ms);
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
      }
    }

    // 2) Parse date from URL patterns
    for (const r of results ?? []) {
      const url = String(r?.url ?? "");
      if (!url) continue;

      // /2026/01/11/ or /2026-01-11/
      let m = url.match(/(20\d{2})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
      if (m) {
        const y = Number(m[1]), mo = Number(m[2]), da = Number(m[3]);
        if (y >= 2024 && mo >= 1 && mo <= 12 && da >= 1 && da <= 31) {
          return new Date(Date.UTC(y, mo - 1, da)).toISOString();
        }
      }

      // 2026-01-11 anywhere
      m = url.match(/(20\d{2})-(\d{2})-(\d{2})/);
      if (m) {
        const y = Number(m[1]), mo = Number(m[2]), da = Number(m[3]);
        if (y >= 2024 && mo >= 1 && mo <= 12 && da >= 1 && da <= 31) {
          return new Date(Date.UTC(y, mo - 1, da)).toISOString();
        }
      }
    }

    // 3) Last resort: if results exist, assume "today" UTC
    if ((results ?? []).length) {
      const d = new Date();
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
    }

    return null;
  } catch {
    return null;
  }
}

async function getRecentAlertSummaries(countryHint: string | null, limit = 30) {
  try {
    let q = supabaseService
      .from("alerts")
      .select("id,title,location,status,country,created_at,sources")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (countryHint) q = q.ilike("country", countryHint);

    const { data } = await q;
    return (data ?? []).map((a: any) => ({
      id: String(a.id),
      title: String(a.title ?? ""),
      location: String(a.location ?? ""),
      status: String(a.status ?? ""),
      created_at: String(a.created_at ?? ""),
    }));
  } catch {
    return [];
  }
}

async function openAiGenerateAlert(opts: {
  sourceName?: string;
  sourceUrl?: string;
  countryHint?: string | null;
  braveResults: BraveResult[];
  daysBack: number;
}): Promise<GeneratedAlert> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");

  const results = (opts.braveResults ?? []).slice(0, 6);
  if (!results.length) return { ok: false, confidence: 0, reason: "no_results" };

  const compact = results.map((r, i) => ({
    n: i + 1,
    title: r.title ?? "",
    url: r.url,
    snippet: r.description ?? "",
    age: (r as any)?.age ?? undefined,
  }));

  const recent = await getRecentAlertSummaries(opts.countryHint ?? null, 30);

  const system = [
    "You are a MAGNUS travel safety intelligence analyst.",
    `Today is ${new Date().toISOString().slice(0, 10)}.`,
    `Reject any event older than ${opts.daysBack} days.`,
    "Reject any event from 2023 or earlier automatically.",
    "Use the provided search results as the ONLY sources.",
    "Be conservative. Default severity to 'informative' unless evidence clearly supports higher.",
    "Only output 'critical' for mass-casualty events, major terrorist attack, major armed conflict escalation, or imminent life-threatening hazard with broad impact.",
    "Only output 'warning' for significant disruption/violence/unrest/major infrastructure impact supported by credible reporting (official or major outlets).",
    "Use 'caution' for localized incidents or moderate disruption where travelers should take extra care.",
    "Use 'informative' for routine advisories, low-impact updates, or general reminders.",
    "If uncertain, set ok=false.",
    "Mandatory output fields when ok=true: severity, geoScope, latitude, longitude, radiusKm, geoJSON.",
    "Return STRICT JSON only (no markdown).",
    "Duplicate prevention: if similar to existing alerts list, set ok=false and reason='duplicate'.",
    "If you cannot confidently determine eventStartDate/eventEndDate, you may omit them; do NOT hallucinate dates.",
  ].join(" ");

  const user = {
    task: "Generate ONE travel safety alert draft.",
    country_hint: opts.countryHint ?? null,
    source_name: opts.sourceName ?? null,
    source_url: opts.sourceUrl ?? null,
    search_results: compact,
    existing_alerts_do_not_recreate: recent,
    requirements: {
      title: "Specific incident/disruption; not boilerplate.",
      summary: "2-3 sentences; concrete what/where; under 150 words.",
      advice: "4-6 practical bullets.",
      sources: "Use 1-3 URLs from provided results only.",
      confidence: "0..1; <0.55 if insufficient.",
    },
  };

  const res = await fetchWithTimeout(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(user) },
        ],
        max_tokens: 2500,
      }),
    },
    20000,
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`OpenAI failed (${res.status}) ${txt}`);
  }

  const data = await res.json().catch(() => null);
  const content = data?.choices?.[0]?.message?.content ?? "";

  let parsed: any = null;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { ok: false, confidence: 0.1, reason: "bad_json" };
  }

  const out: GeneratedAlert = {
    ok: !!parsed.ok,
    confidence: Number(parsed.confidence ?? 0) || 0,
    reason: parsed.reason ? String(parsed.reason) : undefined,

    title: typeof parsed.title === "string" ? parsed.title.trim() : "",
    country: parsed.country ? String(parsed.country).trim() : opts.countryHint ?? null,
    location: parsed.location ? String(parsed.location).trim() : null,
    summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
    advice: Array.isArray(parsed.advice) ? parsed.advice.map((x: any) => String(x).trim()).filter(Boolean).slice(0, 8) : [],
    sources: Array.isArray(parsed.sources)
      ? parsed.sources
          .map((s: any) => {
            if (typeof s === "string") return s.trim() ? { url: s.trim() } : null;
            const url = String(s?.url ?? "").trim();
            if (!url) return null;
            return { url, title: s?.title ? String(s.title).trim() : undefined };
          })
          .filter(Boolean)
          .slice(0, 3)
      : [],

    dedupeUrls: [],
    severity: parsed.severity ? normSeverity(parsed.severity) : undefined,
    eventType: parsed.eventType ? String(parsed.eventType) : (parsed.event_type ? String(parsed.event_type) : null),
    geoScope: parsed.geoScope ? String(parsed.geoScope) : (parsed.geo_scope ? String(parsed.geo_scope) : undefined),
    latitude: parsed.latitude != null ? Number(parsed.latitude) : undefined,
    longitude: parsed.longitude != null ? Number(parsed.longitude) : undefined,
    radiusKm: parsed.radiusKm != null ? Number(parsed.radiusKm) : undefined,
    geoJSON: parsed.geoJSON ?? parsed.geojson ?? undefined,
    eventStartDate: parsed.eventStartDate ? String(parsed.eventStartDate) : undefined,
    eventEndDate: parsed.eventEndDate ? String(parsed.eventEndDate) : undefined,
  };

  out.dedupeUrls = (out.sources ?? []).map((s) => s.url).slice(0, 3);

  // ---- date inference + time window validation ----
  let startIso = out.eventStartDate;
  let t = parseIsoOrNull(startIso);

  // If model omitted, infer from Brave; if still missing, fall back to nowIso()
  if (!t) {
    startIso = inferEventStartDateFromBrave(opts.braveResults) ?? nowIso();
    out.eventStartDate = startIso;
    t = parseIsoOrNull(startIso);
  }

  if (!t) return { ok: false, confidence: Math.min(out.confidence || 0, 0.54), reason: "missing_eventStartDate" };

  const year = new Date(t).getUTCFullYear();
  if (year <= 2023) return { ok: false, confidence: Math.min(out.confidence || 0, 0.54), reason: "too_old_year" };

  const daysBack = clamp(opts.daysBack, 1, 120);
  const cutoff = Date.now() - daysBack * 24 * 3600_000;
  if (t < cutoff) return { ok: false, confidence: Math.min(out.confidence || 0, 0.54), reason: "too_old_daysBack" };

  const tooGeneric = !out.title || out.summary.length < 40 || (out.sources ?? []).length === 0;
  if (!out.ok || tooGeneric || (out.confidence || 0) < 0.55) {
    return { ok: false, confidence: Math.min(out.confidence || 0, 0.54), reason: out.reason ?? "low_confidence" };
  }

  // If model omitted end date, set a sane default window
  if (!out.eventEndDate) {
    const hrs = out.severity === "warning" ? 48 : out.severity === "caution" ? 36 : 24;
    out.eventEndDate = new Date(Date.parse(startIso) + hrs * 3600_000).toISOString();
  }

  return out;
}

// -------------------------
// Duplicate prevention (conservative default)
// -------------------------
async function findPossibleDuplicate(draft: any, sinceIso: string) {
  try {
    const country = String(draft.country ?? "").trim();
    const title = String(draft.title ?? "").trim();
    if (!country || !title) return null;

    const { data } = await supabaseService
      .from("alerts")
      .select("id,title,country,location,sources")
      .gte("created_at", sinceIso)
      .ilike("country", country)
      .limit(150);

    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
    const tkey = norm(title);

    for (const a of data ?? []) {
      const ak = norm(String((a as any).title ?? ""));
      if (ak && tkey && (ak === tkey || ak.includes(tkey) || tkey.includes(ak))) return a;
    }

    return null;
  } catch {
    return null;
  }
}

async function groupSourceIntoExisting(existing: any, newSources: any[]) {
  try {
    const prev = Array.isArray(existing?.sources) ? existing.sources : [];
    const merged = [...prev];

    for (const s of newSources ?? []) {
      const url = String(s?.url ?? "").trim();
      if (!url) continue;
      if (merged.some((x: any) => String(x?.url ?? "").trim() === url)) continue;
      merged.push(s);
    }

    await supabaseService.from("alerts").update({ sources: merged, updated_at: nowIso() }).eq("id", existing.id);
  } catch {
    // ignore
  }
}

// -------------------------
// Insert helper (geo columns might not exist)
// -------------------------
function isMissingColumnError(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("could not find the") && m.includes("column");
}
function stripGeoColumns(row: any) {
  const clone = { ...row };
  delete clone.geojson;
  delete clone.latitude;
  delete clone.longitude;
  delete clone.radius_km;
  delete clone.geo_scope;
  delete clone.event_start_at;
  delete clone.event_end_at;

  // AI fields are optional columns
  delete clone.ai_confidence;
  delete clone.ai_reason;
  delete clone.ai_model;

  return clone;
}
async function insertAlertRowWithFallback(row: any): Promise<{ ok: true } | { ok: false; error: string }> {
  const first = await supabaseService.from("alerts").insert(row);
  if (!first.error) return { ok: true };

  const msg = String(first.error.message ?? first.error);
  if (!isMissingColumnError(msg)) return { ok: false, error: msg };

  const retryRow = stripGeoColumns(row);
  const second = await supabaseService.from("alerts").insert(retryRow);
  if (!second.error) return { ok: true };

  return { ok: false, error: String(second.error.message ?? second.error) };
}

// -------------------------
// Scour runner (single source, bounded)
// -------------------------
async function runScourOnSource(
  src: any,
  daysBack: number,
): Promise<{
  created: boolean;
  dup: boolean;
  dupGroupedInto?: string | null;
  low: boolean;
  error?: string;
  reject?: { reason: string; query: string };
}> {
  const sourceId = String(src?.id ?? "");
  const now = Date.now();

  // STRICT: block anything before 2025
  const minAllowedMs = Date.parse("2025-01-01T00:00:00Z");
  const sinceMs = now - clamp(daysBack, 1, 120) * 24 * 3600_000;
  if (sinceMs < minAllowedMs) {
    await recordScourOutcome(sourceId, { t: nowIso(), outcome: "reject", reason: "time_window_pre_2025" });
    return { created: false, dup: false, low: true, reject: { reason: "time_window_pre_2025", query: `daysBack=${daysBack}` } };
  }

  const sinceIso = new Date(Math.max(sinceMs, minAllowedMs)).toISOString();
  const floor = getSourceSeverityFloor(src);

  const queries = buildSourceQueries(src);

  try {
    // Use content acquisition with fallback (Brave first, then URL scraping)
    const { braveResults, queryUsed } = await getContentWithFallback(src, queries, daysBack);

    if (!braveResults.length) {
      await recordScourOutcome(sourceId, { t: nowIso(), outcome: "low", reason: "no_content_found" });
      return { created: false, dup: false, low: true, reject: { reason: "no_content_found", query: queryUsed } };
    }

    const draft = await openAiGenerateAlert({
      sourceName: src.name,
      sourceUrl: src.url,
      countryHint: src.country ?? null,
      braveResults,
      daysBack: clamp(daysBack, 1, 120),
    });

    if (!draft?.ok) {
      const r = draft?.reason ?? "low_confidence";
      await recordScourOutcome(sourceId, { t: nowIso(), outcome: "low", reason: r, confidence: Number(draft?.confidence ?? 0) || 0 });
      return { created: false, dup: false, low: true, reject: { reason: r, query: queryUsed } };
    }

    // Force country alignment if source has country
    if (src?.country && (!draft.country || String(draft.country).trim() !== String(src.country).trim())) {
      await recordScourOutcome(sourceId, {
        t: nowIso(),
        outcome: "reject",
        reason: "country_mismatch",
        severity: draft.severity ? normSeverity(draft.severity) : undefined,
        confidence: Number(draft.confidence ?? 0) || 0,
      });
      return { created: false, dup: false, low: true, reject: { reason: "country_mismatch", query: queryUsed } };
    }

    const ensured = ensureGeoAndTime(draft);

    if (ensured.missingGeo) {
      await recordScourOutcome(sourceId, {
        t: nowIso(),
        outcome: "reject",
        reason: "missing_geo_fields",
        severity: ensured.sev,
        confidence: Number(draft.confidence ?? 0) || 0,
      });
      return { created: false, dup: false, low: true, reject: { reason: "missing_geo_fields", query: queryUsed } };
    }

    // Enforce 2025+ at the final eventStart
    const startMs = Date.parse(String(ensured.startIso ?? ""));
    if (!Number.isFinite(startMs) || startMs < minAllowedMs) {
      await recordScourOutcome(sourceId, {
        t: nowIso(),
        outcome: "reject",
        reason: "event_pre_2025",
        severity: ensured.sev,
        confidence: Number(draft.confidence ?? 0) || 0,
      });
      return { created: false, dup: false, low: true, reject: { reason: "event_pre_2025", query: queryUsed } };
    }

    // Fix degenerate end time if needed
    const endMs = Date.parse(String(ensured.endIso ?? ""));
    if (!Number.isFinite(endMs) || endMs <= startMs) {
      const hrs = ensured.sev === "critical" ? 72 : ensured.sev === "warning" ? 48 : ensured.sev === "caution" ? 36 : 24;
      ensured.endIso = new Date(startMs + hrs * 3600_000).toISOString();
    }

    // Conservative severity clamp (server-side)
    ensured.sev = clampSeverityConservative(ensured.sev, draft);

    // Require credible source for warning/critical (else downgrade to caution)
    if ((ensured.sev === "warning" || ensured.sev === "critical") && !hasCredibleSource(draft)) {
      ensured.sev = "caution";
    }

    // Severity floor check (after clamp)
    if (severityRank(ensured.sev) < severityRank(floor)) {
      await recordScourOutcome(sourceId, {
        t: nowIso(),
        outcome: "reject",
        reason: `below_severity_floor_${floor}`,
        severity: ensured.sev,
        confidence: Number(draft.confidence ?? 0) || 0,
      });
      return { created: false, dup: false, low: true, reject: { reason: `below_severity_floor_${floor}`, query: queryUsed } };
    }

    // Conservative duplicate: group sources into existing alert
    const possible = await findPossibleDuplicate(draft, sinceIso);
    if (possible) {
      await groupSourceIntoExisting(possible, draft.sources ?? []);
      await recordScourOutcome(sourceId, {
        t: nowIso(),
        outcome: "dup",
        reason: "grouped_into_existing",
        severity: ensured.sev,
        confidence: Number(draft.confidence ?? 0) || 0,
      });
      return { created: false, dup: true, dupGroupedInto: String((possible as any).id ?? null), low: false };
    }

    // Persist alert with AI confidence fields (schema-safe)
    const row: any = {
      id: crypto.randomUUID(),
      status: "draft",

      country: draft.country || src.country || null,
      region: src.region ?? null,

      severity: ensured.sev ?? null,
      event_type: (draft as any).eventType ?? null,

      title: draft.title ?? "",
      location: draft.location ?? "",
      summary: draft.summary ?? "",
      advice: draft.advice ?? [],
      sources: draft.sources ?? [],

      source_id: sourceId,

      geo_scope: ensured.geoScope ?? null,
      latitude: Number.isFinite(ensured.lat) ? ensured.lat : null,
      longitude: Number.isFinite(ensured.lng) ? ensured.lng : null,
      radius_km: ensured.radiusKm ?? null,
      geojson: ensured.geojson ?? null,
      event_start_at: ensured.startIso ?? null,
      event_end_at: ensured.endIso ?? null,

      ai_confidence: Number(draft.confidence ?? 0) || 0,
      ai_reason: draft.reason ? String(draft.reason) : null,
      ai_model: "gpt-4o-mini",

      created_at: nowIso(),
      updated_at: nowIso(),
    };

    const ins = await insertAlertRowWithFallback(row);
    if (!ins.ok) {
      await recordScourOutcome(sourceId, {
        t: nowIso(),
        outcome: "error",
        reason: ins.error,
        severity: ensured.sev,
        confidence: Number(draft.confidence ?? 0) || 0,
      });
      return { created: false, dup: false, low: false, error: ins.error };
    }

    await recordScourOutcome(sourceId, {
      t: nowIso(),
      outcome: "created",
      reason: "created",
      severity: ensured.sev,
      confidence: Number(draft.confidence ?? 0) || 0,
    });

    return { created: true, dup: false, low: false };
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    await recordScourOutcome(sourceId, { t: nowIso(), outcome: "error", reason: msg });
    return { created: false, dup: false, low: false, error: msg };
  }
}

// -------------------------
// Resumable job state (app_kv)
// -------------------------
type ScourJob = {
  id: string;
  sourceIds: string[];
  nextIndex: number;
  processed: number;
  created: number;
  duplicatesSkipped: number;
  lowConfidenceSkipped: number;
  errors: Array<{ sourceId: string; reason: string }>;
  rejections: Array<{ sourceId: string; reason: string; query: string }>;
  status: "running" | "done";
  created_at: string;
  updated_at: string;
};

function jobKey(id: string) {
  return `scour_job:${id}`;
}

async function loadJob(id: string): Promise<ScourJob | null> {
  const { data, error } = await supabaseService.from("app_kv").select("value").eq("key", jobKey(id)).maybeSingle();
  if (error || !data) return null;
  const v = (data as any).value;
  if (!v || typeof v !== "object") return null;
  return v as ScourJob;
}

async function saveJob(job: ScourJob): Promise<void> {
  job.updated_at = nowIso();
  await supabaseService.from("app_kv").upsert({
    key: jobKey(job.id),
    value: job,
    updated_at: job.updated_at,
  });
}

async function createJob(sourceIds: string[]): Promise<ScourJob> {
  const job: ScourJob = {
    id: crypto.randomUUID(),
    sourceIds,
    nextIndex: 0,
    processed: 0,
    created: 0,
    duplicatesSkipped: 0,
    lowConfidenceSkipped: 0,
    errors: [],
    rejections: [],
    status: "running",
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await saveJob(job);
  return job;
}

// -------------------------
// Routes
// -------------------------
app.get("/", (c) => c.text("ok"));
app.get(PREFIX, (c) => c.text("ok"));

mountGet("/sources/:id/scour-stats", async (c: any) => {
  const id = String(c.req.param("id") ?? "").trim();
  if (!id) return c.json({ ok: false, error: "missing_id" }, 400);
  const st = await loadScourStats(id);
  return c.json({ ok: true, stats: st });
});

mountGet("/health", (c) =>
  c.json({
    ok: true,
    time: nowIso(),
    env: {
      SUPABASE_URL: !!SUPABASE_URL,
      SERVICE_KEY: !!SERVICE_KEY,
      BRAVE_API_KEY: !!BRAVE_API_KEY,
      OPENAI_API_KEY: !!OPENAI_API_KEY,
      CRON_SECRET: !!CRON_SECRET,
      AUTO_SCOUR_ENABLED,
      WP_URL: !!WP_URL,
      WP_USER: !!WP_USER,
      WP_APP_PASSWORD: !!WP_APP_PASSWORD,
      ADMIN_SECRET_SET: !!ADMIN_SECRET,
      AI_ENABLED,
      SCOUR_ENABLED,
      AI_DAYS_BACK: clamp(AI_DAYS_BACK, 1, 120),
      AI_DAILY_LIMIT: clamp(AI_DAILY_LIMIT, 0, 100000),
      SCOUR_DAILY_LIMIT: clamp(SCOUR_DAILY_LIMIT, 0, 100000),
      HAS_SCOUR_ALLOWLIST: !!SCOUR_ALLOWED_EMAILS,
    },
  })
);

mountGet("/last-scoured", async (c) => {
  try {
    const { data, error } = await supabaseService.from("app_kv").select("value, updated_at").eq("key", "auto_scour_last_run").maybeSingle();
    if (error) return c.json({ ok: false, error: error.message }, 500);

    const lastIso = (data as any)?.value?.lastIso ?? (data as any)?.value?.last_scoured ?? (data as any)?.updated_at ?? null;
    return c.json({ ok: true, lastIso }, 200);
  } catch (e: any) {
    return c.json({ ok: false, error: String(e?.message ?? e) }, 500);
  }
});

// -------------------------
// Alerts
// -------------------------
mountGet("/alerts", async (c: any) => {
  const status = c.req.query("status");
  const limit = clamp(Number(c.req.query("limit") ?? 1000), 1, 2000);

  let q = supabaseService.from("alerts").select("*").order("created_at", { ascending: false }).limit(limit);
  if (typeof status === "string" && status.trim()) q = q.eq("status", status.trim());

  const { data, error } = await q;
  if (error) return c.json({ ok: false, error: error.message }, 500);
  return c.json({ ok: true, alerts: data ?? [] });
});

mountGet("/alerts/review", async (c) => {
  const { data, error } = await supabaseService.from("alerts").select("*").eq("status", "draft").order("created_at", { ascending: false }).limit(200);
  if (error) return c.json({ ok: false, error: error.message }, 500);
  return c.json({ ok: true, alerts: data ?? [] });
});
mountGet("/alerts/review-queue", async (c) => {
  const { data, error } = await supabaseService.from("alerts").select("*").eq("status", "draft").order("created_at", { ascending: false }).limit(200);
  if (error) return c.json({ ok: false, error: error.message }, 500);
  return c.json({ ok: true, alerts: data ?? [] });
});

mountPost("/alerts/compile", async (c) => {
  const body = await readJsonBody(c);
  const compiled = {
    country: body?.country ?? null,
    severity: body?.severity ?? null,
    title: body?.title ?? "",
    location: body?.location ?? "",
    summary: body?.summary ?? "",
    advice: Array.isArray(body?.advice) ? body.advice : [],
    sources: Array.isArray(body?.sources) ? body.sources : [],
    event_type: body?.event_type ?? null,
  };
  return c.json({ ok: true, compiled });
});

mountPost("/alerts", async (c) => {
  const body = await readJsonBody(c);
  const row = {
    id: crypto.randomUUID(),
    status: String(body?.status ?? "draft"),
    country: body?.country ?? null,
    region: body?.region ?? null,
    severity: body?.severity ?? null,
    event_type: body?.event_type ?? null,
    title: body?.title ?? "",
    location: body?.location ?? "",
    summary: body?.summary ?? "",
    advice: Array.isArray(body?.advice) ? body.advice : [],
    sources: Array.isArray(body?.sources) ? body.sources : [],
    geo_scope: body?.geo_scope ?? null,
    latitude: typeof body?.latitude === "number" ? body.latitude : null,
    longitude: typeof body?.longitude === "number" ? body.longitude : null,
    radius_km: typeof body?.radius_km === "number" ? body.radius_km : null,
    geojson: body?.geojson ?? null,
    event_start_at: body?.event_start_at ?? null,
    event_end_at: body?.event_end_at ?? null,
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  const { data, error } = await supabaseService.from("alerts").insert(row).select("*").single();
  if (error) return c.json({ ok: false, error: error.message }, 500);
  return c.json({ ok: true, alert: data });
});

mountPatch("/alerts/:id", async (c: any) => {
  const id = c.req.param("id");
  const body = await readJsonBody(c);

  const patch: any = { updated_at: nowIso() };
  for (const k of [
    "status",
    "country",
    "region",
    "severity",
    "event_type",
    "title",
    "location",
    "summary",
    "advice",
    "sources",
    "geo_scope",
    "latitude",
    "longitude",
    "radius_km",
    "geojson",
    "event_start_at",
    "event_end_at",
  ]) {
    if (body[k] !== undefined) patch[k] = body[k];
  }

  const { data, error } = await supabaseService.from("alerts").update(stripUndefined(patch)).eq("id", id).select("*").single();
  if (error) return c.json({ ok: false, error: error.message }, 500);
  
  // Auto-process for trends when status changes to approved or dismissed
  const newStatus = String(body.status ?? "").toLowerCase();
  if (newStatus === "approved" || newStatus === "dismissed") {
    try {
      await processAlertForTrends(id);
    } catch (e) {
      // Log but don't fail the request
      console.error("Trend processing error:", e);
    }
  }
  
  return c.json({ ok: true, alert: data });
});

mountDelete("/alerts/:id", async (c: any) => {
  const id = c.req.param("id");
  const { error } = await supabaseService.from("alerts").delete().eq("id", id);
  if (error) return c.json({ ok: false, error: error.message }, 500);
  return c.json({ ok: true, deleted: id });
});

mountPost("/alerts/:id/post-to-wp", async (c: any) => {
  const id = c.req.param("id");
  const { data: alertRow, error: gErr } = await supabaseService.from("alerts").select("*").eq("id", id).single();
  if (gErr || !alertRow) return c.json({ ok: false, error: gErr?.message ?? "Alert not found" }, 404);

  try {
    const { wpId } = await postToWordpress(alertRow);
    await supabaseService
      .from("alerts")
      .update({
        wordpress_post_id: String(wpId),
        exported_at: nowIso(),
        export_error: null,
        export_error_at: null,
        updated_at: nowIso(),
      })
      .eq("id", id);

    // Process for trends after successful WordPress post
    try {
      await processAlertForTrends(id);
    } catch (trendErr) {
      console.error("Trend processing after WP post error:", trendErr);
    }

    return c.json({ ok: true, wordpressPostId: wpId });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    await supabaseService.from("alerts").update({ export_error: msg, export_error_at: nowIso(), updated_at: nowIso() }).eq("id", id);
    return c.json({ ok: false, error: msg }, 500);
  }
});

// -------------------------
// Sources
// -------------------------
mountGet("/sources", async (c: any) => {
  const limit = clamp(Number(c.req.query("limit") ?? 200), 1, 1000);
  const offset = clamp(Number(c.req.query("offset") ?? 0), 0, 1000000);
  const q = String(c.req.query("q") ?? "").trim();

  let base = supabaseService.from("sources").select("*", { count: "exact" });
  if (q) {
    const like = `%${q}%`;
    base = base.or(`name.ilike.${like},url.ilike.${like},country.ilike.${like},region.ilike.${like}`);
  }

  const { data, error, count } = await base.order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  if (error) return c.json({ ok: false, error: error.message }, 500);

  return c.json({ ok: true, total: count ?? null, limit, offset, sources: data ?? [] });
});

mountGet("/sources/stats", async (c) => {
  const baseCols = "id,name,url,enabled,country,region,topics,language,created_at,updated_at";
  const withType = `${baseCols},type`;

  let sources: any[] = [];
  const first = await supabaseService.from("sources").select(withType).order("created_at", { ascending: false }).limit(1000);
  if (!first.error) sources = first.data ?? [];
  else {
    const msg = String(first.error.message ?? first.error);
    if (isMissingColumnError(msg) || (msg.toLowerCase().includes("column") && msg.toLowerCase().includes("type"))) {
      const second = await supabaseService.from("sources").select(baseCols).order("created_at", { ascending: false }).limit(1000);
      if (second.error) return c.json({ ok: false, error: String(second.error.message ?? second.error) }, 500);
      sources = (second.data ?? []).map((s: any) => ({ ...s, type: null }));
    } else return c.json({ ok: false, error: msg }, 500);
  }

  const ids = sources.map((s) => String(s.id));
  const alertsBy: Record<string, number> = {};
  const lastScouredBy: Record<string, string | null> = {};
  const scoursBy: Record<string, number> = {};

  try {
    const { data: alerts } = await supabaseService.from("alerts").select("source_id,created_at").in("source_id", ids).limit(5000);
    for (const a of alerts ?? []) {
      const sid = String((a as any).source_id ?? "");
      if (!sid) continue;
      alertsBy[sid] = (alertsBy[sid] ?? 0) + 1;
      const dt = (a as any).created_at ? String((a as any).created_at) : null;
      if (dt) {
        const prev = lastScouredBy[sid];
        if (!prev || Date.parse(dt) > Date.parse(prev)) lastScouredBy[sid] = dt;
      }
    }
  } catch {
    // ignore
  }

  try {
    const { data: kv } = await supabaseService.from("app_kv").select("key,value").like("key", "scour_source:%").limit(5000);
    for (const row of kv ?? []) {
      const k = String((row as any).key ?? "");
      if (!k.startsWith("scour_source:")) continue;
      const sid = k.replace("scour_source:", "");
      const v = (row as any).value;
      const n = Number(v?.count ?? 0);
      if (sid) scoursBy[sid] = Number.isFinite(n) ? n : 0;
    }
  } catch {
    // ignore
  }

  const out = sources.map((s) => {
    const sid = String(s.id);
    return { ...s, scours: scoursBy[sid] ?? 0, alerts: alertsBy[sid] ?? 0, last_scoured: lastScouredBy[sid] ?? null };
  });

  const enabledSources = out.filter((s) => (s.enabled ?? true) === true).length;
  return c.json({ ok: true, totalSources: out.length, enabledSources, sources: out });
});

mountPost("/sources/bulk", async (c: any) => {
  const body = await readJsonBody(c);
  const rows = Array.isArray(body?.sources) ? body.sources : [];
  if (!rows.length) return c.json({ ok: true, upserted: 0, skipped: 0, rejected: [] });

  const rejected: Array<{ rowIndex?: number; name?: string; url?: string; reason: string }> = [];
  const accepted: any[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] ?? {};
    const name = String(r?.name ?? "").trim();
    const url = String(r?.url ?? "").trim();
    if (!name) {
      rejected.push({ rowIndex: i + 1, name, url, reason: "missing_name" });
      continue;
    }
    if (!/^https?:\/\//i.test(url)) {
      rejected.push({ rowIndex: i + 1, name, url, reason: "url_must_start_with_http_or_https" });
      continue;
    }

    const topics = Array.isArray(r?.topics)
      ? r.topics
      : typeof r?.topics === "string"
        ? r.topics.split(",").map((x: string) => x.trim()).filter(Boolean)
        : [];

    accepted.push({
      id: r?.id ? String(r.id) : crypto.randomUUID(),
      name,
      url,
      enabled: r?.enabled === false ? false : true,
      country: r?.country ?? null,
      region: r?.region ?? null,
      topics,
      language: r?.language ?? null,
      type: r?.type ?? null,
      created_at: r?.created_at ?? nowIso(),
      updated_at: nowIso(),
    });
  }

  let hasTypeCol = true;
  const probe = await supabaseService.from("sources").select("type").limit(1);
  if (probe.error) {
    const msg = String(probe.error.message ?? probe.error).toLowerCase();
    if (msg.includes("column") && msg.includes("type") && msg.includes("does not exist")) hasTypeCol = false;
  }

  const payload = hasTypeCol
    ? accepted
    : accepted.map((x) => {
        const cpy = { ...x };
        delete (cpy as any).type;
        return cpy;
      });

  const CHUNK = 200;
  let upserted = 0;

  for (let i = 0; i < payload.length; i += CHUNK) {
    const chunk = payload.slice(i, i + CHUNK);
    const res = await supabaseService.from("sources").upsert(chunk, { onConflict: "id" });
    if (!res.error) upserted += chunk.length;
    else {
      for (const row of chunk) {
        const single = await supabaseService.from("sources").upsert([row], { onConflict: "id" });
        if (!single.error) upserted += 1;
        else rejected.push({ name: row.name, url: row.url, reason: String(single.error.message ?? single.error) });
      }
    }
  }

  return c.json({ ok: true, upserted, skipped: rows.length - upserted, rejected, note: hasTypeCol ? undefined : "type column missing; stored without type" });
});

mountPost("/sources/test", async (c: any) => {
  const body = await readJsonBody(c);
  const url = String(body?.url ?? "").trim();
  if (!url) return c.json({ ok: false, error: "missing_url" }, 400);

  try {
    const res = await fetchWithTimeout(url, { method: "HEAD", redirect: "follow" }, 12000);
    return c.json({ ok: true, url, reachable: res.ok, status: res.status });
  } catch (e: any) {
    return c.json({ ok: true, url, reachable: false, error: String(e?.message ?? e) });
  }
});

mountPatch("/sources/:id", async (c: any) => {
  const id = String(c.req.param("id") ?? "").trim();
  if (!id) return c.json({ ok: false, error: "missing_id" }, 400);

  const body = await readJsonBody(c);
  let enabled: boolean | undefined;

  if (typeof body?.enabled === "boolean") enabled = body.enabled;
  else if (typeof body?.enabled === "string") {
    const v = body.enabled.trim().toLowerCase();
    if (v === "true") enabled = true;
    else if (v === "false") enabled = false;
  }

  if (enabled === undefined) return c.json({ ok: false, error: "missing_enabled_boolean" }, 400);

  const { error } = await supabaseService.from("sources").update({ enabled }).eq("id", id);
  if (error) return c.json({ ok: false, error: error.message }, 500);

  return c.json({ ok: true, id, enabled });
});

mountDelete("/sources/:id", async (c: any) => {
  const id = String(c.req.param("id") ?? "").trim();
  if (!id) return c.json({ ok: false, error: "missing_id" }, 400);

  const { error } = await supabaseService.from("sources").delete().eq("id", id);
  if (error) return c.json({ ok: false, error: error.message }, 500);

  return c.json({ ok: true, deleted: [id] });
});

async function handleSourcesBulkDelete(c: any) {
  const body = await readJsonBody(c);
  const ids = Array.isArray(body?.ids) ? body.ids.map((x: any) => String(x).trim()).filter(Boolean) : [];
  if (!ids.length) return c.json({ ok: true, deleted: 0, ids: [] });

  const chunks = chunkArray(ids, 200);
  const deleted: string[] = [];
  const errors: Array<{ id: string; error: string }> = [];

  for (const chunk of chunks) {
    const { error } = await supabaseService.from("sources").delete().in("id", chunk);
    if (error) for (const id of chunk) errors.push({ id, error: error.message });
    else deleted.push(...chunk);
  }

  return c.json({ ok: true, deleted: deleted.length, ids: deleted, errors });
}
mountPost("/sources/bulk-delete", (c: any) => handleSourcesBulkDelete(c));
mountPost("/sources/delete", (c: any) => handleSourcesBulkDelete(c));
mountPost("/sources/delete-bulk", (c: any) => handleSourcesBulkDelete(c));

// -------------------------
// ðŸ”’ Individual source scour
// -------------------------
async function handleScourOneSource(c: any) {
  const gate = await requireScourAccess(c);
  if (!gate.ok) return c.json({ ok: false, error: gate.error, meta: (gate as any).meta }, gate.status);

  const id = String(c.req.param("id") ?? "").trim();
  if (!id) return c.json({ ok: false, error: "missing_id" }, 400);

  const body = await readJsonBody(c);
  const timeoutMs = clamp(Number(body?.timeoutMs ?? 20000), 6000, 45000);
  const daysBack = clamp(Number(body?.daysBack ?? AI_DAYS_BACK), 1, 120);

  const { data: src, error: sErr } = await supabaseService.from("sources").select("*").eq("id", id).maybeSingle();
  if (sErr) return c.json({ ok: false, error: sErr.message }, 500);
  if (!src) return c.json({ ok: false, error: "source_not_found" }, 404);

  await auditLog("scour_one_start", { by: gate.user, sourceId: id, daysBack });

  try {
    const result = (await Promise.race([
      runScourOnSource(src, daysBack),
      new Promise((_, rej) => setTimeout(() => rej(new Error("source_timeout")), timeoutMs)),
    ])) as any;

    try {
      const key = `scour_source:${String(id)}`;
      const prev = await supabaseService.from("app_kv").select("value").eq("key", key).maybeSingle();
      const prevCount = Number((prev.data as any)?.value?.count ?? 0);
      await supabaseService.from("app_kv").upsert({
        key,
        value: { count: (Number.isFinite(prevCount) ? prevCount : 0) + 1, lastIso: nowIso() },
        updated_at: nowIso(),
      });
    } catch {
      // ignore
    }

    await supabaseService.from("app_kv").upsert({ key: "auto_scour_last_run", value: { lastIso: nowIso(), sourceId: String(id) }, updated_at: nowIso() });

    await auditLog("scour_one_done", { by: gate.user, sourceId: id, result });

    return c.json({ ok: true, id: String(id), result });
  } catch (e: any) {
    await auditLog("scour_one_error", { by: gate.user, sourceId: id, error: String(e?.message ?? e) });
    return c.json({ ok: false, error: String(e?.message ?? e), id: String(id) }, 500);
  }
}
mountPost("/sources/:id/scour", handleScourOneSource);
mountPost("/sources/:id/scour-now", handleScourOneSource);

// -------------------------
// Scour job status
// -------------------------
mountGet("/scour/status", async (c: any) => {
  const jobId = String(c.req.query("jobId") ?? "").trim();
  if (!jobId) return c.json({ ok: false, error: "missing_jobId" }, 400);
  const job = await loadJob(jobId);
  if (!job) return c.json({ ok: false, error: "job_not_found" }, 404);
  return c.json({ ok: true, job: { ...job, total: job.sourceIds.length, errorCount: job.errors.length } });
});

// -------------------------
// ðŸ”’ Resumable scour
// -------------------------
mountPost("/scour-sources", async (c: any) => {
  const cron = isCron(c.req.raw);

  if (cron) {
    if (!AUTO_SCOUR_ENABLED) return c.json({ ok: true, skipped: true, reason: "AUTO_SCOUR_ENABLED=false" });
    const gate = await shouldRunCron(90);
    if (!gate.run) return c.json({ ok: true, skipped: true, reason: "throttled_90m", lastRun: gate.lastIso ?? null });
  } else {
    const gate = await requireScourAccess(c);
    if (!gate.ok) return c.json({ ok: false, error: gate.error, meta: (gate as any).meta }, gate.status);
  }

  try {
    const body = await readJsonBody(c);

    // Guideline: callBudget should allow multiple sources; sourceTimeout must exceed Brave(10s)+OpenAI(20s)
    const callBudgetMs = clamp(Number(body.callBudgetMs ?? 50000), 10000, 85000);
    const sourceTimeoutMs = clamp(Number(body.sourceTimeoutMs ?? 35000), 15000, 55000);
    const batchSize = clamp(Number(body.batchSize ?? 5), 1, 25);
    const daysBack = clamp(Number(body.daysBack ?? AI_DAYS_BACK), 1, 120);

    const requestedJobId = body.jobId ? String(body.jobId).trim() : "";
    let job: ScourJob | null = null;

    if (requestedJobId) {
      job = await loadJob(requestedJobId);
      if (!job) return c.json({ ok: false, error: "job_not_found", jobId: requestedJobId }, 404);
    } else {
      let sourceIds: string[] = Array.isArray(body.sourceIds) ? body.sourceIds.map((x: any) => String(x)) : [];
      const maxSources = body.maxSources != null ? clamp(Number(body.maxSources), 0, 500) : undefined;

      if (!sourceIds.length) {
        const { data: allSources, error: sErr } = await supabaseService.from("sources").select("id,enabled").order("created_at", { ascending: false });
        if (sErr) throw new Error(sErr.message);
        sourceIds = (allSources ?? []).filter((s: any) => (s.enabled ?? true) === true).map((s: any) => String(s.id));
        if (typeof maxSources === "number") sourceIds = sourceIds.slice(0, maxSources);
      }

      job = await createJob(sourceIds);
    }

    if (!job) throw new Error("job_missing");

    await auditLog("scour_job_step", { jobId: job.id, nextIndex: job.nextIndex, daysBack });

    const startedAt = Date.now();
    const errorsThisCall: Array<{ sourceId: string; reason: string }> = [];
    const rejectionsThisCall: Array<{ sourceId: string; reason: string; query: string }> = [];

    let processedThisCall = 0;
    let createdThisCall = 0;

    const runOneWithTimeout = async (src: any) => {
      return (await Promise.race([
        runScourOnSource(src, daysBack),
        new Promise((_, rej) => setTimeout(() => rej(new Error("source_timeout")), sourceTimeoutMs)),
      ])) as any;
    };

    while (job.status === "running" && job.nextIndex < job.sourceIds.length) {
      if (Date.now() - startedAt > callBudgetMs) break;

      const slice = job.sourceIds.slice(job.nextIndex, job.nextIndex + batchSize);
      if (!slice.length) break;

      const { data: sources, error: sErr } = await supabaseService.from("sources").select("*").in("id", slice);
      if (sErr) throw new Error(sErr.message);

      const byId: Record<string, any> = {};
      for (const s of sources ?? []) byId[String((s as any).id)] = s;

      for (const sid of slice) {
        if (Date.now() - startedAt > callBudgetMs) break;

        const src = byId[String(sid)];
        job.nextIndex += 1;
        processedThisCall += 1;
        job.processed += 1;

        if (!src) {
          const err = { sourceId: String(sid), reason: "source_not_found" };
          job.errors.push(err);
          errorsThisCall.push(err);
          continue;
        }

        try {
          const r = await runOneWithTimeout(src);

          try {
            const key = `scour_source:${String(src.id)}`;
            const prev = await supabaseService.from("app_kv").select("value").eq("key", key).maybeSingle();
            const prevCount = Number((prev.data as any)?.value?.count ?? 0);
            await supabaseService.from("app_kv").upsert({
              key,
              value: { count: (Number.isFinite(prevCount) ? prevCount : 0) + 1, lastIso: nowIso() },
              updated_at: nowIso(),
            });
          } catch {
            // ignore
          }

          if (r.created) {
            job.created += 1;
            createdThisCall += 1;
          } else if (r.dup) {
            job.duplicatesSkipped += 1;
          } else if (r.low) {
            job.lowConfidenceSkipped += 1;
          }

          if (r.error) {
            const err = { sourceId: String(src.id), reason: String(r.error) };
            job.errors.push(err);
            errorsThisCall.push(err);
          }
          if (r.reject) {
            const rej = { sourceId: String(src.id), reason: String(r.reject.reason), query: String(r.reject.query) };
            job.rejections.push(rej);
            rejectionsThisCall.push(rej);
          }
        } catch (e: any) {
          const err = { sourceId: String(src.id), reason: String(e?.message ?? e) };
          job.errors.push(err);
          errorsThisCall.push(err);
        }
      }
    }

    if (job.nextIndex >= job.sourceIds.length) job.status = "done";
    await saveJob(job);

    await supabaseService.from("app_kv").upsert({ key: "auto_scour_last_run", value: { lastIso: nowIso() }, updated_at: nowIso() });

    return c.json({
      ok: true,
      jobId: job.id,
      status: job.status,
      total: job.sourceIds.length,
      nextIndex: job.nextIndex,
      processed: job.processed,
      created: job.created,
      duplicatesSkipped: job.duplicatesSkipped,
      lowConfidenceSkipped: job.lowConfidenceSkipped,
      errorCount: job.errors.length,
      processedThisCall,
      createdThisCall,
      errorsThisCall,
      rejectionsThisCall,
      done: job.status === "done",
    });
  } catch (e: any) {
    return c.json({ ok: false, error: String(e?.message ?? e) }, 500);
  }
});

// cron endpoint (gate only)
mountPost("/cron/scour", async (c: any) => {
  if (!isCron(c.req.raw)) return c.json({ ok: false, error: "forbidden" }, 403);
  if (!AUTO_SCOUR_ENABLED) return c.json({ ok: true, skipped: true, reason: "AUTO_SCOUR_ENABLED=false" });

  const gate = await shouldRunCron(90);
  if (!gate.run) return c.json({ ok: true, skipped: true, reason: "throttled_90m", lastRun: gate.lastIso ?? null });

  return c.json({ ok: true, ran: true, message: "cron gate passed; POST /scour-sources with x-cron-secret (no jobId) to create a new job" });
});

// -------------------------
// Trends System (AI Guidelines compliant)
// Alerts contribute to trends when: approved, posted to WP, or dismissed
// -------------------------

// Region mapping for geographic validation
const REGION_CONTINENTS: Record<string, string[]> = {
  "Europe": ["Albania", "Andorra", "Austria", "Belarus", "Belgium", "Bosnia and Herzegovina", "Bulgaria", "Croatia", "Cyprus", "Czech Republic", "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary", "Iceland", "Ireland", "Italy", "Kosovo", "Latvia", "Liechtenstein", "Lithuania", "Luxembourg", "Malta", "Moldova", "Monaco", "Montenegro", "Netherlands", "North Macedonia", "Norway", "Poland", "Portugal", "Romania", "Russia", "San Marino", "Serbia", "Slovakia", "Slovenia", "Spain", "Sweden", "Switzerland", "Ukraine", "United Kingdom", "Vatican City"],
  "Asia": ["Afghanistan", "Armenia", "Azerbaijan", "Bahrain", "Bangladesh", "Bhutan", "Brunei", "Cambodia", "China", "Georgia", "Hong Kong", "India", "Indonesia", "Iran", "Iraq", "Israel", "Japan", "Jordan", "Kazakhstan", "Kuwait", "Kyrgyzstan", "Laos", "Lebanon", "Malaysia", "Maldives", "Mongolia", "Myanmar", "Nepal", "North Korea", "Oman", "Pakistan", "Palestine", "Philippines", "Qatar", "Saudi Arabia", "Singapore", "South Korea", "Sri Lanka", "Syria", "Taiwan", "Tajikistan", "Thailand", "Timor-Leste", "Turkey", "Turkmenistan", "United Arab Emirates", "Uzbekistan", "Vietnam", "Yemen"],
  "Africa": ["Algeria", "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi", "Cameroon", "Cape Verde", "Central African Republic", "Chad", "Comoros", "Democratic Republic of Congo", "Djibouti", "Egypt", "Equatorial Guinea", "Eritrea", "Eswatini", "Ethiopia", "Gabon", "Gambia", "Ghana", "Guinea", "Guinea-Bissau", "Ivory Coast", "Kenya", "Lesotho", "Liberia", "Libya", "Madagascar", "Malawi", "Mali", "Mauritania", "Mauritius", "Morocco", "Mozambique", "Namibia", "Niger", "Nigeria", "Republic of Congo", "Rwanda", "Sao Tome and Principe", "Senegal", "Seychelles", "Sierra Leone", "Somalia", "South Africa", "South Sudan", "Sudan", "Tanzania", "Togo", "Tunisia", "Uganda", "Zambia", "Zimbabwe"],
  "North America": ["Antigua and Barbuda", "Bahamas", "Barbados", "Belize", "Canada", "Costa Rica", "Cuba", "Dominica", "Dominican Republic", "El Salvador", "Grenada", "Guatemala", "Haiti", "Honduras", "Jamaica", "Mexico", "Nicaragua", "Panama", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Trinidad and Tobago", "United States"],
  "South America": ["Argentina", "Bolivia", "Brazil", "Chile", "Colombia", "Ecuador", "Guyana", "Paraguay", "Peru", "Suriname", "Uruguay", "Venezuela"],
  "Oceania": ["Australia", "Fiji", "Kiribati", "Marshall Islands", "Micronesia", "Nauru", "New Zealand", "Palau", "Papua New Guinea", "Samoa", "Solomon Islands", "Tonga", "Tuvalu", "Vanuatu"],
};

function getContinent(country: string): string | null {
  const c = (country ?? "").trim();
  for (const [continent, countries] of Object.entries(REGION_CONTINENTS)) {
    if (countries.some(cc => cc.toLowerCase() === c.toLowerCase())) return continent;
  }
  return null;
}

function countriesMatch(c1: string | null, c2: string | null): boolean {
  if (!c1 || !c2) return false;
  return c1.toLowerCase().trim() === c2.toLowerCase().trim();
}

function continentsMatch(c1: string | null, c2: string | null): boolean {
  if (!c1 || !c2) return false;
  const cont1 = getContinent(c1);
  const cont2 = getContinent(c2);
  return !!cont1 && !!cont2 && cont1 === cont2;
}

// Adjacent/related countries for weather/natural disaster events
// Weather systems can span borders - these countries share geographic proximity
const ADJACENT_COUNTRIES: Record<string, string[]> = {
  // Caribbean (hurricanes, storms affect multiple islands)
  "Cuba": ["Haiti", "Dominican Republic", "Jamaica", "Bahamas", "Mexico", "United States"],
  "Haiti": ["Dominican Republic", "Cuba", "Jamaica", "Bahamas"],
  "Dominican Republic": ["Haiti", "Cuba", "Puerto Rico", "Jamaica"],
  "Jamaica": ["Cuba", "Haiti", "Dominican Republic", "Bahamas"],
  "Bahamas": ["Cuba", "United States", "Haiti"],
  "Puerto Rico": ["Dominican Republic", "United States", "Virgin Islands"],
  // Central America
  "Guatemala": ["Mexico", "Belize", "Honduras", "El Salvador"],
  "Honduras": ["Guatemala", "El Salvador", "Nicaragua"],
  "El Salvador": ["Guatemala", "Honduras"],
  "Nicaragua": ["Honduras", "Costa Rica"],
  "Costa Rica": ["Nicaragua", "Panama"],
  "Panama": ["Costa Rica", "Colombia"],
  // Western Europe
  "France": ["Belgium", "Luxembourg", "Germany", "Switzerland", "Italy", "Spain", "Andorra", "Monaco", "United Kingdom"],
  "Germany": ["France", "Belgium", "Netherlands", "Luxembourg", "Switzerland", "Austria", "Czech Republic", "Poland", "Denmark"],
  "United Kingdom": ["Ireland", "France", "Belgium", "Netherlands"],
  "Ireland": ["United Kingdom"],
  "Spain": ["France", "Portugal", "Andorra", "Morocco"],
  "Portugal": ["Spain"],
  "Italy": ["France", "Switzerland", "Austria", "Slovenia", "San Marino", "Vatican City"],
  "Switzerland": ["France", "Germany", "Austria", "Italy", "Liechtenstein"],
  "Austria": ["Germany", "Switzerland", "Italy", "Slovenia", "Hungary", "Slovakia", "Czech Republic", "Liechtenstein"],
  "Netherlands": ["Belgium", "Germany", "United Kingdom"],
  "Belgium": ["France", "Netherlands", "Germany", "Luxembourg"],
  // Nordic (winter storms)
  "Norway": ["Sweden", "Finland", "Russia", "Denmark"],
  "Sweden": ["Norway", "Finland", "Denmark"],
  "Finland": ["Norway", "Sweden", "Russia"],
  "Denmark": ["Germany", "Norway", "Sweden"],
  "Iceland": ["United Kingdom", "Norway", "Greenland"],
  // Eastern Europe
  "Poland": ["Germany", "Czech Republic", "Slovakia", "Ukraine", "Belarus", "Lithuania", "Russia"],
  "Czech Republic": ["Germany", "Poland", "Slovakia", "Austria"],
  "Ukraine": ["Poland", "Slovakia", "Hungary", "Romania", "Moldova", "Belarus", "Russia"],
  "Romania": ["Ukraine", "Moldova", "Hungary", "Serbia", "Bulgaria"],
  "Hungary": ["Austria", "Slovakia", "Ukraine", "Romania", "Serbia", "Croatia", "Slovenia"],
  // Balkans
  "Greece": ["Albania", "North Macedonia", "Bulgaria", "Turkey"],
  "Turkey": ["Greece", "Bulgaria", "Georgia", "Armenia", "Iran", "Iraq", "Syria"],
  "Bulgaria": ["Romania", "Serbia", "North Macedonia", "Greece", "Turkey"],
  "Serbia": ["Hungary", "Romania", "Bulgaria", "North Macedonia", "Kosovo", "Montenegro", "Bosnia and Herzegovina", "Croatia"],
  "Croatia": ["Slovenia", "Hungary", "Serbia", "Bosnia and Herzegovina", "Montenegro"],
  // Middle East
  "Israel": ["Lebanon", "Syria", "Jordan", "Egypt", "Palestine"],
  "Jordan": ["Israel", "Syria", "Iraq", "Saudi Arabia", "Palestine"],
  "Lebanon": ["Israel", "Syria"],
  "Syria": ["Turkey", "Iraq", "Jordan", "Israel", "Lebanon"],
  "Iraq": ["Turkey", "Iran", "Kuwait", "Saudi Arabia", "Jordan", "Syria"],
  "Iran": ["Turkey", "Iraq", "Afghanistan", "Pakistan", "Turkmenistan", "Azerbaijan", "Armenia"],
  "Saudi Arabia": ["Jordan", "Iraq", "Kuwait", "Bahrain", "Qatar", "UAE", "Oman", "Yemen"],
  // South Asia (monsoons)
  "India": ["Pakistan", "China", "Nepal", "Bhutan", "Bangladesh", "Myanmar", "Sri Lanka"],
  "Pakistan": ["India", "China", "Afghanistan", "Iran"],
  "Bangladesh": ["India", "Myanmar"],
  "Nepal": ["India", "China"],
  // Southeast Asia (typhoons)
  "Philippines": ["Taiwan", "Vietnam", "Malaysia", "Indonesia"],
  "Vietnam": ["China", "Laos", "Cambodia", "Thailand", "Philippines"],
  "Thailand": ["Myanmar", "Laos", "Cambodia", "Malaysia", "Vietnam"],
  "Malaysia": ["Thailand", "Singapore", "Indonesia", "Brunei", "Philippines"],
  "Indonesia": ["Malaysia", "Papua New Guinea", "Timor-Leste", "Australia", "Philippines"],
  // East Asia
  "Japan": ["South Korea", "China", "Taiwan", "Russia"],
  "South Korea": ["North Korea", "Japan", "China"],
  "China": ["Russia", "Mongolia", "North Korea", "South Korea", "Japan", "Taiwan", "Vietnam", "Laos", "Myanmar", "India", "Bhutan", "Nepal", "Pakistan", "Afghanistan", "Tajikistan", "Kyrgyzstan", "Kazakhstan"],
  "Taiwan": ["China", "Japan", "Philippines"],
  // Africa
  "Egypt": ["Libya", "Sudan", "Israel", "Palestine"],
  "Morocco": ["Algeria", "Spain", "Mauritania"],
  "Algeria": ["Morocco", "Tunisia", "Libya", "Niger", "Mali", "Mauritania"],
  "South Africa": ["Namibia", "Botswana", "Zimbabwe", "Mozambique", "Eswatini", "Lesotho"],
  "Kenya": ["Ethiopia", "Somalia", "South Sudan", "Uganda", "Tanzania"],
  "Nigeria": ["Benin", "Cameroon", "Chad", "Niger"],
  // Oceania
  "Australia": ["Indonesia", "Papua New Guinea", "New Zealand", "Timor-Leste"],
  "New Zealand": ["Australia"],
  // North America
  "United States": ["Canada", "Mexico", "Bahamas", "Cuba"],
  "Canada": ["United States"],
  "Mexico": ["United States", "Guatemala", "Belize", "Cuba"],
  // South America
  "Brazil": ["Argentina", "Paraguay", "Uruguay", "Bolivia", "Peru", "Colombia", "Venezuela", "Guyana", "Suriname", "French Guiana"],
  "Argentina": ["Chile", "Bolivia", "Paraguay", "Brazil", "Uruguay"],
  "Chile": ["Argentina", "Bolivia", "Peru"],
  "Colombia": ["Venezuela", "Brazil", "Peru", "Ecuador", "Panama"],
  "Peru": ["Ecuador", "Colombia", "Brazil", "Bolivia", "Chile"],
  "Venezuela": ["Colombia", "Brazil", "Guyana"],
};

// Event types that can span adjacent countries
const CROSS_BORDER_EVENT_TYPES = [
  "weather", "storm", "hurricane", "typhoon", "cyclone", "monsoon",
  "flood", "flooding", "tsunami", "earthquake", "volcanic",
  "wildfire", "drought", "heatwave", "cold wave", "blizzard",
  "pandemic", "epidemic", "disease outbreak",
  "refugee", "migration", "border",
];

// Check if event type allows cross-border trending
function isCrossBorderEventType(eventType: string | null): boolean {
  if (!eventType) return false;
  const et = eventType.toLowerCase();
  return CROSS_BORDER_EVENT_TYPES.some(t => et.includes(t));
}

// Check if two countries are adjacent
function areCountriesAdjacent(c1: string | null, c2: string | null): boolean {
  if (!c1 || !c2) return false;
  const country1 = c1.trim();
  const country2 = c2.trim();
  
  // Check direct adjacency
  const adjacent1 = ADJACENT_COUNTRIES[country1] ?? [];
  const adjacent2 = ADJACENT_COUNTRIES[country2] ?? [];
  
  return adjacent1.some(a => a.toLowerCase() === country2.toLowerCase()) ||
         adjacent2.some(a => a.toLowerCase() === country1.toLowerCase());
}

// Determine if countries can be grouped in a trend
// Rules:
// 1. Same country: always ok
// 2. Adjacent countries + weather/natural disaster: ok
// 3. Same continent + multinational event: ok
// 4. Different continents or non-adjacent + local crime: NOT ok
function canGroupCountriesForTrend(c1: string | null, c2: string | null, eventType: string | null): boolean {
  // Same country - always ok
  if (countriesMatch(c1, c2)) return true;
  
  // Check if event type allows cross-border grouping
  if (isCrossBorderEventType(eventType)) {
    // Adjacent countries - ok for weather/disaster
    if (areCountriesAdjacent(c1, c2)) return true;
    // Same continent - ok for regional weather patterns
    if (continentsMatch(c1, c2)) return true;
  }
  
  // Local crimes (robbery, assault, theft) should NOT group across countries
  const localCrimeTypes = ["robbery", "theft", "assault", "mugging", "pickpocket", "burglary", "crime"];
  const et = (eventType ?? "").toLowerCase();
  if (localCrimeTypes.some(t => et.includes(t))) {
    return false; // Never group local crimes across countries
  }
  
  // Default: don't group different countries
  return false;
}

// AI: Match alert to existing trend
async function aiMatchAlertToTrend(alert: any, trend: any): Promise<{ match: boolean; reason: string }> {
  if (!OPENAI_API_KEY) return { match: false, reason: "no_api_key" };

  // Server-side geographic pre-check (per guidelines: mandatory)
  const alertCountry = String(alert.country ?? "").trim();
  const trendCountry = String(trend.country ?? "").trim();
  const alertEventType = String(alert.event_type ?? "").trim();
  const trendEventType = String(trend.event_type ?? "").trim();
  
  // Use combined event type for geographic rule check
  const effectiveEventType = alertEventType || trendEventType;
  
  // Check if countries can be grouped for this trend
  if (trendCountry && !canGroupCountriesForTrend(alertCountry, trendCountry, effectiveEventType)) {
    // Countries don't match and aren't eligible for cross-border grouping
    return { match: false, reason: "country_mismatch" };
  }
  
  // If trend is continent-specific (from title), validate continent
  const trendTitle = String(trend.title ?? "").toLowerCase();
  for (const continent of Object.keys(REGION_CONTINENTS)) {
    if (trendTitle.includes(continent.toLowerCase()) && !continentsMatch(alertCountry, trendCountry || alertCountry)) {
      // Check if alert's continent matches the one in title
      const alertContinent = getContinent(alertCountry);
      if (alertContinent?.toLowerCase() !== continent.toLowerCase()) {
        return { match: false, reason: `continent_mismatch_${continent}` };
      }
    }
  }

  const prompt = {
    task: "Determine if this alert belongs to the existing trend.",
    alert: {
      title: alert.title,
      country: alert.country,
      location: alert.location,
      event_type: alert.event_type,
      severity: alert.severity,
      summary: (alert.summary ?? "").slice(0, 300),
    },
    trend: {
      title: trend.title,
      country: trend.country,
      event_type: trend.event_type,
      description: (trend.description ?? "").slice(0, 300),
      incident_count: trend.incident_count,
    },
    rules: [
      "Geographic validation already done server-side",
      "Weather/natural disasters CAN span adjacent countries (e.g., Caribbean hurricane)",
      "Local crimes (robbery, theft, assault) must NOT span countries",
      "Event types should be same or closely related",
      "Trends can span days or weeks (no time limit)",
      "Different severity levels CAN belong to same trend",
      "New development in ongoing situation SHOULD be added",
      "Return match=true ONLY if alert is clearly part of this trend",
    ],
  };

  try {
    const res = await fetchWithTimeout(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.2,
          max_tokens: 150,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "You are a trend matching assistant. Return JSON: {match: boolean, reason: string}" },
            { role: "user", content: JSON.stringify(prompt) },
          ],
        }),
      },
      10000,
    );

    if (!res.ok) return { match: false, reason: "ai_error" };
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);
    return { match: !!parsed.match, reason: String(parsed.reason ?? "ai_decision") };
  } catch {
    return { match: false, reason: "ai_exception" };
  }
}

// AI: Create new trends from unmatched alerts
async function aiCreateTrendsFromAlerts(alerts: any[]): Promise<any[]> {
  if (!OPENAI_API_KEY || alerts.length < 2) return [];

  const alertSummaries = alerts.slice(0, 20).map((a, i) => ({
    index: i,
    id: a.id,
    title: a.title,
    country: a.country,
    location: a.location,
    event_type: a.event_type,
    severity: a.severity,
    summary: (a.summary ?? "").slice(0, 200),
    created_at: a.created_at,
  }));

  const prompt = {
    task: "Group these alerts into trends based on geographic and event type rules.",
    alerts: alertSummaries,
    rules: [
      "DEFAULT: Group alerts from the SAME country",
      "EXCEPTION for Weather/Natural Disasters: Adjacent countries CAN be grouped (e.g., Cuba+Haiti+Dominican Republic for hurricanes)",
      "Adjacent Caribbean islands sharing same storm system = ONE trend",
      "LOCAL CRIMES (robbery, theft, assault, mugging): NEVER group across countries - a robbery in Paris and London are UNRELATED",
      "Group by same or closely related event_type",
      "Each trend needs at least 2 alerts",
      "Create SPECIFIC, DESCRIPTIVE titles (e.g., 'Hurricane Impact in Caribbean' or 'Flooding in Thailand')",
      "For multi-country weather: use regional name (e.g., 'Caribbean', 'Nordic', 'Southeast Asia')",
      "REJECT generic titles like 'Undefined Trend', 'Multiple Incidents', 'Various Events'",
      "Better to create MORE specific trends than ONE vague trend",
      "Return empty array if no valid groupings found",
    ],
    output_format: {
      trends: [
        {
          title: "Specific trend title",
          country: "Primary country or region name",
          countries: ["array of all countries if multi-country weather event"],
          event_type: "Primary event type",
          severity: "Highest severity from grouped alerts",
          description: "2-3 sentence summary of the trend",
          predictive_analysis: "What this pattern indicates",
          alert_ids: ["array of alert IDs to include"],
        }
      ]
    },
  };

  try {
    const res = await fetchWithTimeout(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.3,
          max_tokens: 2000,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "You are a trend analysis assistant. Return JSON with trends array." },
            { role: "user", content: JSON.stringify(prompt) },
          ],
        }),
      },
      20000,
    );

    if (!res.ok) return [];
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);
    
    // Validate and filter trends
    const validTrends: any[] = [];
    for (const t of (parsed.trends ?? [])) {
      const title = String(t.title ?? "").trim();
      const country = String(t.country ?? "").trim();
      const alertIds = Array.isArray(t.alert_ids) ? t.alert_ids : [];
      
      // Reject invalid trends per guidelines
      if (!title || !country) continue;
      if (alertIds.length < 2) continue;
      if (/undefined|multiple.*region|various|generic/i.test(title)) continue;
      
      // Validate geographic grouping based on event type
      const alertsForTrend = alerts.filter(a => alertIds.includes(a.id));
      const eventType = t.event_type ?? "";
      
      // Check all alerts can be grouped with the primary country
      const allValidGeo = alertsForTrend.every(a => 
        canGroupCountriesForTrend(a.country, country, eventType)
      );
      if (!allValidGeo) continue;
      
      // Get all unique countries in this trend
      const trendCountries = [...new Set(alertsForTrend.map(a => a.country).filter(Boolean))];
      
      validTrends.push({
        title,
        country, // Primary country
        countries: trendCountries, // All countries involved
        event_type: eventType || null,
        severity: t.severity ?? "informative",
        description: t.description ?? "",
        predictive_analysis: t.predictive_analysis ?? "",
        alert_ids: alertIds,
      });
    }
    
    return validTrends;
  } catch {
    return [];
  }
}

// Process alert for trend contribution (called when alert is approved/posted/dismissed)
async function processAlertForTrends(alertId: string): Promise<{ matched: boolean; trendId?: string; created?: boolean; newTrendId?: string }> {
  // Get the alert
  const { data: alert, error: aErr } = await supabaseService
    .from("alerts")
    .select("*")
    .eq("id", alertId)
    .single();
  
  if (aErr || !alert) return { matched: false };
  
  // Only process approved, posted (has wordpress_post_id), or dismissed alerts
  const status = String(alert.status ?? "").toLowerCase();
  const isPosted = !!alert.wordpress_post_id;
  const isApproved = status === "approved";
  const isDismissed = status === "dismissed";
  
  if (!isPosted && !isApproved && !isDismissed) {
    return { matched: false };
  }
  
  // Check if alert already belongs to a trend
  if (alert.trend_id) {
    return { matched: true, trendId: alert.trend_id };
  }
  
  // Get all open trends
  const { data: trends } = await supabaseService
    .from("trends")
    .select("*")
    .in("status", ["open", "monitoring"])
    .order("updated_at", { ascending: false })
    .limit(100);
  
  // Try to match to existing trend
  for (const trend of (trends ?? [])) {
    const { match, reason } = await aiMatchAlertToTrend(alert, trend);
    
    if (match) {
      // Add alert to trend
      const currentAlertIds = Array.isArray(trend.alert_ids) ? trend.alert_ids : [];
      if (!currentAlertIds.includes(alertId)) {
        currentAlertIds.push(alertId);
      }
      
      // Update trend
      const highestSeverity = severityRank(alert.severity) > severityRank(trend.severity) ? alert.severity : trend.severity;
      
      await supabaseService.from("trends").update({
        alert_ids: currentAlertIds,
        incident_count: currentAlertIds.length,
        severity: highestSeverity,
        last_seen: alert.created_at ?? nowIso(),
        updated_at: nowIso(),
      }).eq("id", trend.id);
      
      // Mark alert as belonging to trend
      await supabaseService.from("alerts").update({
        trend_id: trend.id,
        updated_at: nowIso(),
      }).eq("id", alertId);
      
      return { matched: true, trendId: trend.id };
    }
  }
  
  // No match found - alert is unmatched, will be processed in batch for new trends
  return { matched: false };
}

// Batch process unmatched alerts to create new trends
async function createTrendsFromUnmatchedAlerts(): Promise<{ created: number; trendIds: string[] }> {
  // Get alerts that are approved/posted/dismissed but not in any trend
  const { data: unmatchedAlerts } = await supabaseService
    .from("alerts")
    .select("*")
    .is("trend_id", null)
    .or("status.eq.approved,status.eq.dismissed,wordpress_post_id.not.is.null")
    .order("created_at", { ascending: false })
    .limit(50);
  
  if (!unmatchedAlerts || unmatchedAlerts.length < 2) {
    return { created: 0, trendIds: [] };
  }
  
  // Use AI to create trends
  const newTrends = await aiCreateTrendsFromAlerts(unmatchedAlerts);
  
  const createdTrendIds: string[] = [];
  
  for (const t of newTrends) {
    // Find the actual alerts
    const alertsForTrend = unmatchedAlerts.filter(a => t.alert_ids.includes(a.id));
    if (alertsForTrend.length < 2) continue;
    
    // Determine dates from alerts
    const dates = alertsForTrend.map(a => a.created_at).filter(Boolean).sort();
    const firstSeen = dates[0] ?? nowIso();
    const lastSeen = dates[dates.length - 1] ?? nowIso();
    
    // Create the trend
    const trendId = crypto.randomUUID();
    const { error: insertErr } = await supabaseService.from("trends").insert({
      id: trendId,
      title: t.title,
      description: t.description,
      predictive_analysis: t.predictive_analysis,
      status: "open",
      country: t.country,
      event_type: t.event_type,
      severity: t.severity,
      alert_ids: t.alert_ids,
      incident_count: t.alert_ids.length,
      first_seen: firstSeen,
      last_seen: lastSeen,
      auto_generated: true,
      created_at: nowIso(),
      updated_at: nowIso(),
    });
    
    if (insertErr) continue;
    
    // Update alerts to reference this trend
    for (const aid of t.alert_ids) {
      await supabaseService.from("alerts").update({
        trend_id: trendId,
        updated_at: nowIso(),
      }).eq("id", aid);
    }
    
    createdTrendIds.push(trendId);
  }
  
  return { created: createdTrendIds.length, trendIds: createdTrendIds };
}

// -------------------------
// Trends API Routes
// -------------------------
mountGet("/trends", async (c: any) => {
  const status = c.req.query("status"); // optional filter
  let query = supabaseService
    .from("trends")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(200);
  
  if (status) {
    query = query.eq("status", status);
  }
  
  const { data, error } = await query;
  if (error) return c.json({ ok: false, error: error.message }, 500);
  return c.json(data ?? []);
});

mountGet("/trends/:id", async (c: any) => {
  const id = c.req.param("id");
  const { data: trend, error } = await supabaseService
    .from("trends")
    .select("*")
    .eq("id", id)
    .single();
  
  if (error) return c.json({ ok: false, error: error.message }, 404);
  
  // Also fetch the alerts in this trend
  let alerts: any[] = [];
  if (Array.isArray(trend.alert_ids) && trend.alert_ids.length > 0) {
    const { data: alertData } = await supabaseService
      .from("alerts")
      .select("id,title,country,location,severity,event_type,status,created_at")
      .in("id", trend.alert_ids);
    alerts = alertData ?? [];
  }
  
  return c.json({ ok: true, trend, alerts });
});

mountPost("/trends", async (c: any) => {
  const body = await readJsonBody(c);
  const row = {
    id: crypto.randomUUID(),
    title: body?.title ?? "",
    description: body?.description ?? "",
    predictive_analysis: body?.predictive_analysis ?? "",
    status: body?.status ?? "open",
    country: body?.country ?? null,
    region: body?.region ?? null,
    event_type: body?.event_type ?? null,
    severity: body?.severity ?? null,
    alert_ids: Array.isArray(body?.alert_ids) ? body.alert_ids : [],
    incident_count: body?.incident_count ?? 0,
    first_seen: body?.first_seen ?? nowIso(),
    last_seen: body?.last_seen ?? nowIso(),
    auto_generated: false,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  const { data, error } = await supabaseService.from("trends").insert(row).select("*").single();
  if (error) return c.json({ ok: false, error: error.message }, 500);
  return c.json({ ok: true, trend: data });
});

mountPatch("/trends/:id", async (c: any) => {
  const id = c.req.param("id");
  const body = await readJsonBody(c);
  const patch: any = { updated_at: nowIso() };
  for (const k of ["title", "description", "predictive_analysis", "status", "country", "region", "event_type", "severity", "alert_ids", "incident_count", "first_seen", "last_seen"]) {
    if (body[k] !== undefined) patch[k] = body[k];
  }
  const { data, error } = await supabaseService.from("trends").update(patch).eq("id", id).select("*").single();
  if (error) return c.json({ ok: false, error: error.message }, 500);
  return c.json({ ok: true, trend: data });
});

mountDelete("/trends/:id", async (c: any) => {
  const id = c.req.param("id");
  
  // First, unlink any alerts from this trend
  await supabaseService.from("alerts").update({ trend_id: null, updated_at: nowIso() }).eq("trend_id", id);
  
  const { error } = await supabaseService.from("trends").delete().eq("id", id);
  if (error) return c.json({ ok: false, error: error.message }, 500);
  return c.json({ ok: true, deleted: id });
});

// Process single alert for trends (call after approve/dismiss/post)
mountPost("/trends/process-alert/:alertId", async (c: any) => {
  const alertId = c.req.param("alertId");
  const result = await processAlertForTrends(alertId);
  return c.json({ ok: true, ...result });
});

// Batch create trends from unmatched alerts
mountPost("/trends/create-from-unmatched", async (c: any) => {
  const result = await createTrendsFromUnmatchedAlerts();
  return c.json({ ok: true, ...result });
});

// Get trend statistics
mountGet("/trends/stats", async (c: any) => {
  const { data: trends } = await supabaseService.from("trends").select("id,status,severity,incident_count");
  
  const stats = {
    total: trends?.length ?? 0,
    open: trends?.filter(t => t.status === "open").length ?? 0,
    monitoring: trends?.filter(t => t.status === "monitoring").length ?? 0,
    closed: trends?.filter(t => t.status === "closed").length ?? 0,
    totalIncidents: trends?.reduce((sum, t) => sum + (t.incident_count ?? 0), 0) ?? 0,
    bySeverity: {
      critical: trends?.filter(t => t.severity === "critical").length ?? 0,
      warning: trends?.filter(t => t.severity === "warning").length ?? 0,
      caution: trends?.filter(t => t.severity === "caution").length ?? 0,
      informative: trends?.filter(t => t.severity === "informative").length ?? 0,
    },
  };
  
  return c.json({ ok: true, stats });
});

// Generate HTML Situational Brief for a trend
mountPost("/trends/:id/generate-brief", async (c: any) => {
  const id = c.req.param("id");
  
  // Get trend
  const { data: trend, error: tErr } = await supabaseService
    .from("trends")
    .select("*")
    .eq("id", id)
    .single();
  
  if (tErr || !trend) return c.json({ ok: false, error: "Trend not found" }, 404);
  
  // Get alerts in this trend
  let alerts: any[] = [];
  if (Array.isArray(trend.alert_ids) && trend.alert_ids.length > 0) {
    const { data: alertData } = await supabaseService
      .from("alerts")
      .select("*")
      .in("id", trend.alert_ids);
    alerts = alertData ?? [];
  }
  
  // Generate situational brief content using AI
  const briefContent = await generateSituationalBrief(trend, alerts);
  
  // Generate HTML report
  const html = generateBriefHTML(trend, alerts, briefContent);
  
  return c.json({ 
    ok: true, 
    html,
    reportId: `MAGNUS-${Date.now()}`,
    trend: {
      id: trend.id,
      title: trend.title,
      incident_count: alerts.length,
    }
  });
});

// AI: Generate situational brief content
async function generateSituationalBrief(trend: any, alerts: any[]): Promise<any> {
  if (!OPENAI_API_KEY) {
    return {
      executiveSummary: "Unable to generate AI summary - API key not configured.",
      situationAnalysis: "",
      impactAssessment: "",
      predictiveOutlook: "",
      recommendations: [],
    };
  }

  const alertSummaries = alerts.slice(0, 15).map(a => ({
    title: a.title,
    country: a.country,
    location: a.location,
    severity: a.severity,
    event_type: a.event_type,
    summary: (a.summary ?? "").slice(0, 200),
    created_at: a.created_at,
  }));

  const prompt = {
    task: "Generate a professional situational brief for this travel safety trend.",
    trend: {
      title: trend.title,
      country: trend.country,
      event_type: trend.event_type,
      severity: trend.severity,
      incident_count: alerts.length,
      first_seen: trend.first_seen,
      last_seen: trend.last_seen,
      description: trend.description,
    },
    alerts: alertSummaries,
    output_format: {
      executiveSummary: "2-3 paragraphs summarizing the situation, key incidents, and immediate concerns",
      situationAnalysis: "Detailed analysis of the events, patterns, and context",
      impactAssessment: "Direct and indirect impacts on travelers, expected duration",
      predictiveOutlook: "Potential escalation, secondary risks, best/worst case scenarios",
      recommendations: ["Array of 8-10 specific actionable recommendations for travelers"],
    },
    style: "Professional intelligence report. Use formal language. Be specific and actionable.",
  };

  try {
    const res = await fetchWithTimeout(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.3,
          max_tokens: 3000,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "You are a professional travel safety intelligence analyst. Generate formal situational briefs. Return JSON." },
            { role: "user", content: JSON.stringify(prompt) },
          ],
        }),
      },
      25000,
    );

    if (!res.ok) throw new Error("AI request failed");
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? "{}";
    return JSON.parse(content);
  } catch {
    return {
      executiveSummary: trend.description || "Situational brief generation failed.",
      situationAnalysis: "",
      impactAssessment: "",
      predictiveOutlook: trend.predictive_analysis || "",
      recommendations: [],
    };
  }
}

// Generate HTML for situational brief
function generateBriefHTML(trend: any, alerts: any[], brief: any): string {
  const now = new Date();
  const reportId = `MAGNUS-${Date.now()}`;
  const docId = `BRIEF-${Date.now()}`;
  
  // Count severities
  const severityCounts = {
    critical: alerts.filter(a => normSeverity(a.severity) === "critical").length,
    warning: alerts.filter(a => normSeverity(a.severity) === "warning").length,
    caution: alerts.filter(a => normSeverity(a.severity) === "caution").length,
    informative: alerts.filter(a => normSeverity(a.severity) === "informative").length,
  };
  
  // Get unique countries/regions
  const countries = [...new Set(alerts.map(a => a.country).filter(Boolean))];
  const regions = [...new Set(alerts.map(a => a.region).filter(Boolean))];
  
  // Format date
  const formatDate = (d: string | null) => {
    if (!d) return "N/A";
    try {
      return new Date(d).toLocaleDateString("en-US", { 
        weekday: "long", year: "numeric", month: "long", day: "numeric", 
        hour: "2-digit", minute: "2-digit" 
      });
    } catch { return "Invalid Date"; }
  };
  
  // Severity color
  const severityColor = (sev: string) => {
    const s = normSeverity(sev);
    if (s === "critical") return "#dc2626";
    if (s === "warning") return "#f59e0b";
    if (s === "caution") return "#3b82f6";
    return "#6b7280";
  };
  
  // Generate recommendations HTML
  const recommendations = Array.isArray(brief.recommendations) ? brief.recommendations : [];
  const recsHTML = recommendations.map((r: string) => 
    `<li style="margin-bottom: 8px; padding-left: 8px;">${escapeHtml(r)}</li>`
  ).join("");
  
  // Generate event timeline HTML
  const timelineHTML = alerts.slice(0, 10).map(a => `
    <div style="margin-bottom: 16px; padding: 12px; background: #f9fafb; border-radius: 8px; border-left: 4px solid ${severityColor(a.severity)};">
      <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">${formatDate(a.created_at)}</div>
      <div style="font-weight: 600; color: #1f2937; margin-bottom: 4px;">${escapeHtml(a.title ?? "Untitled Alert")}</div>
      <div style="font-size: 14px; color: #4b5563;">📍 ${escapeHtml(a.location ?? a.country ?? "Unknown")}</div>
    </div>
  `).join("");
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MAGNUS Situational Brief - ${escapeHtml(trend.title ?? "Report")}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; background: #fff; }
    .container { max-width: 900px; margin: 0 auto; padding: 40px 24px; }
    .header { text-align: center; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 3px solid #0a4d3c; }
    .logo { font-size: 28px; font-weight: 700; color: #0a4d3c; letter-spacing: 2px; margin-bottom: 8px; }
    .subtitle { font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; }
    .title { font-size: 20px; font-weight: 600; color: #1f2937; margin: 24px 0 8px; }
    .meta { font-size: 13px; color: #6b7280; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 32px 0; }
    .stat-box { background: #f3f4f6; padding: 20px; border-radius: 12px; text-align: center; }
    .stat-number { font-size: 32px; font-weight: 700; color: #0a4d3c; }
    .stat-label { font-size: 12px; color: #6b7280; text-transform: uppercase; }
    .severity-dist { margin: 24px 0; }
    .severity-bar { display: flex; gap: 12px; flex-wrap: wrap; }
    .sev-item { padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 500; }
    .section { margin: 32px 0; }
    .section-title { font-size: 18px; font-weight: 700; color: #0a4d3c; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb; }
    .section-content { color: #374151; }
    .section-content p { margin-bottom: 16px; }
    .recommendations ul { list-style: none; }
    .recommendations li::before { content: "✓"; color: #0a4d3c; font-weight: bold; margin-right: 8px; }
    .timeline { margin: 24px 0; }
    .contact { background: #f0fdf4; padding: 24px; border-radius: 12px; margin-top: 40px; }
    .contact-title { font-weight: 600; color: #0a4d3c; margin-bottom: 12px; }
    .contact-item { margin: 8px 0; font-size: 14px; }
    .footer { text-align: center; margin-top: 40px; padding-top: 24px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; }
    @media print { .container { padding: 20px; } .stat-box { break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">MAGNUS</div>
      <div class="subtitle">Travel Safety Intelligence</div>
      <h1 class="title">SITUATIONAL BRIEF</h1>
      <div class="title" style="font-size: 16px; color: #374151;">Report Focus: ${escapeHtml(trend.title ?? "Trend Analysis")}</div>
      <div class="meta">Generated: ${formatDate(now.toISOString())}</div>
      <div class="meta">Report ID: ${reportId}</div>
    </div>
    
    <div class="stats">
      <div class="stat-box">
        <div class="stat-number">${alerts.length}</div>
        <div class="stat-label">Total Incidents</div>
      </div>
      <div class="stat-box">
        <div class="stat-number">${severityCounts.critical}</div>
        <div class="stat-label">Critical Alerts</div>
      </div>
      <div class="stat-box">
        <div class="stat-number">${countries.length}</div>
        <div class="stat-label">Countries Affected</div>
      </div>
      <div class="stat-box">
        <div class="stat-number">${regions.length}</div>
        <div class="stat-label">Regions Impacted</div>
      </div>
    </div>
    
    <div class="severity-dist">
      <div style="font-weight: 600; margin-bottom: 8px;">Severity Distribution</div>
      <div class="severity-bar">
        ${severityCounts.critical > 0 ? `<span class="sev-item" style="background: #fee2e2; color: #dc2626;">Critical: ${severityCounts.critical}</span>` : ''}
        ${severityCounts.warning > 0 ? `<span class="sev-item" style="background: #fef3c7; color: #d97706;">Warning: ${severityCounts.warning}</span>` : ''}
        ${severityCounts.caution > 0 ? `<span class="sev-item" style="background: #dbeafe; color: #2563eb;">Caution: ${severityCounts.caution}</span>` : ''}
        ${severityCounts.informative > 0 ? `<span class="sev-item" style="background: #f3f4f6; color: #4b5563;">Informative: ${severityCounts.informative}</span>` : ''}
      </div>
    </div>
    
    <div class="section timeline">
      <div class="section-title">Event Timeline</div>
      ${timelineHTML || '<div style="color: #6b7280;">No events to display</div>'}
    </div>
    
    <div class="section">
      <div class="section-title">Executive Summary</div>
      <div class="section-content">
        ${(brief.executiveSummary ?? "").split("\n").map((p: string) => p.trim() ? `<p>${escapeHtml(p)}</p>` : "").join("")}
      </div>
    </div>
    
    <div class="section">
      <div class="section-title">Situation Analysis</div>
      <div class="section-content">
        ${(brief.situationAnalysis ?? "").split("\n").map((p: string) => p.trim() ? `<p>${escapeHtml(p)}</p>` : "").join("")}
      </div>
    </div>
    
    <div class="section">
      <div class="section-title">Impact Assessment</div>
      <div class="section-content">
        ${(brief.impactAssessment ?? "").split("\n").map((p: string) => p.trim() ? `<p>${escapeHtml(p)}</p>` : "").join("")}
      </div>
    </div>
    
    <div class="section">
      <div class="section-title">Predictive Outlook</div>
      <div class="section-content">
        ${(brief.predictiveOutlook ?? "").split("\n").map((p: string) => p.trim() ? `<p>${escapeHtml(p)}</p>` : "").join("")}
      </div>
    </div>
    
    <div class="section recommendations">
      <div class="section-title">Recommendations</div>
      <ul>
        ${recsHTML || '<li>Monitor official sources for updates.</li>'}
      </ul>
    </div>
    
    <div class="contact">
      <div class="contact-title">Contact Information</div>
      <div style="margin-bottom: 8px;">For immediate assistance or further intelligence support, contact MAGNUS:</div>
      <div class="contact-item"><strong>Emergency Operations:</strong> +1-646-814-3336</div>
      <div class="contact-item"><strong>Emergency Operations (Phone + WhatsApp):</strong> +972-50-889-9698</div>
      <div class="contact-item"><strong>Email:</strong> Service@magnusafety.com</div>
    </div>
    
    <div class="footer">
      <div style="font-weight: 600; color: #0a4d3c; margin-bottom: 8px;">MAGNUS Travel Safety Intelligence</div>
      <div>Professional Intelligence Report</div>
      <div>Generated: ${now.toISOString()}</div>
      <div>Document ID: ${docId}</div>
    </div>
  </div>
</body>
</html>`;
}

// HTML escape helper
function escapeHtml(str: string): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// -------------------------
// Admin Users
// -------------------------
// -------------------------
// Admin Users API
// All routes require admin role (checked via JWT or admin secret)
// User details stored in Supabase Auth (user_metadata contains name, role)
// -------------------------

// GET /admin/users - List all users (admin only)
mountGet("/admin/users", async (c: any) => {
  if (!(await isAdminUser(c.req.raw))) {
    return c.json({ ok: false, error: "forbidden - admin access required" }, 403);
  }
  
  const { data, error } = await supabaseService.auth.admin.listUsers({ page: 1, perPage: 2000 });
  if (error) return c.json({ ok: false, error: error.message }, 500);
  
  // Map to cleaner format
  const users = (data?.users ?? []).map((u: any) => ({
    id: u.id,
    email: u.email,
    name: u.user_metadata?.name ?? u.user_metadata?.full_name ?? null,
    role: u.user_metadata?.role ?? "operator",
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
  }));
  
  return c.json(users);
});

// POST /admin/users - Create new user (admin only)
mountPost("/admin/users", async (c: any) => {
  if (!(await isAdminUser(c.req.raw))) {
    return c.json({ ok: false, error: "forbidden - admin access required" }, 403);
  }
  
  const body = await readJsonBody(c);
  const email = String(body?.email ?? "").trim();
  const password = String(body?.password ?? "");
  const name = String(body?.name ?? "").trim();
  const role = String(body?.role ?? "operator").toLowerCase();
  
  if (!email || !password) {
    return c.json({ ok: false, error: "email and password required" }, 400);
  }
  
  if (password.length < 8) {
    return c.json({ ok: false, error: "password must be at least 8 characters" }, 400);
  }
  
  // Validate role
  const validRoles = ["operator", "analyst", "admin"];
  if (!validRoles.includes(role)) {
    return c.json({ ok: false, error: `invalid role, must be one of: ${validRoles.join(", ")}` }, 400);
  }
  
  const { data, error } = await supabaseService.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm email so user can login immediately
    user_metadata: { name, role },
  });
  
  if (error) return c.json({ ok: false, error: error.message }, 500);
  
  return c.json({
    ok: true,
    user: {
      id: data.user?.id,
      email: data.user?.email,
      name,
      role,
      created_at: data.user?.created_at,
    },
  });
});

// PATCH /admin/users/:id - Update user (admin only)
mountPatch("/admin/users/:id", async (c: any) => {
  if (!(await isAdminUser(c.req.raw))) {
    return c.json({ ok: false, error: "forbidden - admin access required" }, 403);
  }
  
  const id = c.req.param("id");
  const body = await readJsonBody(c);
  
  // Build update payload
  const updates: any = {};
  const metadataUpdates: any = {};
  
  // Email update
  if (body?.email !== undefined) {
    updates.email = String(body.email).trim();
  }
  
  // Password update
  if (body?.password !== undefined && body.password !== "") {
    if (body.password.length < 8) {
      return c.json({ ok: false, error: "password must be at least 8 characters" }, 400);
    }
    updates.password = body.password;
  }
  
  // Name update
  if (body?.name !== undefined) {
    metadataUpdates.name = String(body.name).trim();
  }
  
  // Role update
  if (body?.role !== undefined) {
    const role = String(body.role).toLowerCase();
    const validRoles = ["operator", "analyst", "admin"];
    if (!validRoles.includes(role)) {
      return c.json({ ok: false, error: `invalid role, must be one of: ${validRoles.join(", ")}` }, 400);
    }
    metadataUpdates.role = role;
  }
  
  // Apply metadata updates
  if (Object.keys(metadataUpdates).length > 0) {
    updates.user_metadata = metadataUpdates;
  }
  
  if (Object.keys(updates).length === 0) {
    return c.json({ ok: false, error: "no fields to update" }, 400);
  }
  
  const { data, error } = await supabaseService.auth.admin.updateUserById(id, updates);
  
  if (error) return c.json({ ok: false, error: error.message }, 500);
  
  return c.json({
    ok: true,
    user: {
      id: data.user?.id,
      email: data.user?.email,
      name: data.user?.user_metadata?.name ?? null,
      role: data.user?.user_metadata?.role ?? "operator",
      created_at: data.user?.created_at,
      last_sign_in_at: data.user?.last_sign_in_at,
    },
  });
});

// DELETE /admin/users/:id - Delete user (admin only)
mountDelete("/admin/users/:id", async (c: any) => {
  if (!(await isAdminUser(c.req.raw))) {
    return c.json({ ok: false, error: "forbidden - admin access required" }, 403);
  }
  
  const id = c.req.param("id");
  
  // Prevent admin from deleting themselves
  const currentUser = await getAuthUserWithRole(c.req.raw);
  if (currentUser?.id === id) {
    return c.json({ ok: false, error: "cannot delete your own account" }, 400);
  }
  
  const { error } = await supabaseService.auth.admin.deleteUser(id);
  if (error) return c.json({ ok: false, error: error.message }, 500);
  
  return c.json({ ok: true, deleted: id });
});

app.notFound((c) => c.json({ ok: false, error: "not_found", path: c.req.path }, 404));

Deno.serve(app.fetch);






