/// <reference lib="deno.unstable" />

// ============================================================================
// ENV
// ============================================================================
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase env vars");
}
async function getKV(key: string) {
  try {
    const r = await querySupabase(`/app_kv?key=eq.${encodeURIComponent(key)}`);
    return r?.[0]?.value ?? null;
  } catch {
    return null;
  }
}

async function setKV(key: string, value: any) {
  try {
    await querySupabase(`/app_kv?key=eq.${encodeURIComponent(key)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
    });
  } catch {
    await querySupabase(`/app_kv`, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
    });
  }
}

// ============================================================================
// CORS + HELPERS
// ============================================================================
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function querySupabase(
  path: string,
  options: RequestInit = {}
) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Supabase ${res.status}: ${t}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

async function scrapeText(url: string): Promise<string> {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "MagnusScour/1.0" },
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return "";
    return (await r.text())
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 12000);
  } catch {
    return "";
  }
}

async function braveSearch(query: string): Promise<string> {
  if (!BRAVE_SEARCH_API_KEY) return "";
  const url =
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`;

  const r = await fetch(url, {
    headers: {
      "X-Subscription-Token": BRAVE_SEARCH_API_KEY,
      Accept: "application/json",
    },
  });

  if (!r.ok) return "";
  const j = await r.json();
  return (j.web?.results || [])
    .map((x: any) => `${x.title}\n${x.description}\n${x.url}`)
    .join("\n");
}
async function extractAlertsAI(text: string, source: any): Promise<any[]> {
  if (!OPENAI_API_KEY) return [];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You extract travel safety alerts. Output JSON only.",
        },
        {
          role: "user",
          content: `
Extract travel safety alerts.

Fields:
title, summary, location, country, severity, event_start_date, event_end_date

TEXT:
${text}
`,
        },
      ],
      temperature: 0.2,
    }),
  });

  if (!res.ok) return [];
  const j = await res.json();
  try {
    return JSON.parse(j.choices[0].message.content);
  } catch {
    return [];
  }
}


async function runScourJob(jobId: string, sourceIds: string[], daysBack: number) {
  const job = {
    id: jobId,
    status: "running",
    processed: 0,
    created: 0,
    duplicatesSkipped: 0,
    errorCount: 0,
    errors: [],
    sourceIds,
    daysBack,
    total: sourceIds.length,
    updated_at: new Date().toISOString(),
  };

  await setKV(`scour_job:${jobId}`, job);

  for (const sourceId of sourceIds) {
    try {
      const sources = await querySupabase(`/sources?id=eq.${sourceId}`);
      const source = sources?.[0];
      if (!source?.url) continue;

      // placeholder until AI is re-enabled
     let text = await braveSearch(source.name);
if (text.length < 300) {
  text = await scrapeText(source.url);
}

if (text.length < 200) {
  job.processed++;
  continue;
}

const alerts = await extractAlertsAI(text, source);

for (const a of alerts) {
  await querySupabase("/alerts", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      ...a,
      id: crypto.randomUUID(),
      status: "draft",
      ai_generated: true,
      source_url: source.url,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });
  job.created++;
}

job.processed++;


      await setKV(`scour_job:${jobId}`, {
        ...job,
        processed: job.processed,
        updated_at: new Date().toISOString(),
      });
    } catch (e: any) {
      job.errorCount++;
      job.errors.push(String(e?.message || e));
    }
  }

  await setKV(`scour_job:${jobId}`, {
    ...job,
    status: "done",
    updated_at: new Date().toISOString(),
  });
}

// ============================================================================
// ROUTER
// ============================================================================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  // ----------------------------------------------------------------------
// ALERTS — REVIEW QUEUE
// ----------------------------------------------------------------------
if (path === "/alerts/review" && method === "GET") {
  const alerts = await querySupabase(
    "/alerts?status=eq.draft&order=created_at.desc&limit=200"
  );
  return json({ ok: true, alerts });
}
// ----------------------------------------------------------------------
// ALERTS — APPROVE
// ----------------------------------------------------------------------
if (path.startsWith("/alerts/") && path.endsWith("/approve") && method === "POST") {
  const id = path.split("/")[2];
  const updated = await querySupabase(`/alerts?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status: "approved", updated_at: nowIso() }),
  });
  return json({ ok: true, alert: updated?.[0] });
}
// ----------------------------------------------------------------------
// ALERTS — POST TO WORDPRESS
// ----------------------------------------------------------------------
if (path.startsWith("/alerts/") && path.endsWith("/post-to-wp") && method === "POST") {
  const id = path.split("/")[2];
  const rows = await querySupabase(`/alerts?id=eq.${id}`);
  const alert = rows?.[0];
  if (!alert) return json({ ok: false, error: "Alert not found" }, 404);

  const auth = wpAuthHeader();
  if (!auth) return json({ ok: false, error: "WP not configured" }, 500);

  const wpRes = await fetch(`${WP_URL}/wp-json/wp/v2/posts`, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: alert.title,
      status: "publish",
      content: alert.summary,
    }),
  });

  if (!wpRes.ok) {
    return json({ ok: false, error: await wpRes.text() }, 500);
  }

  const wpPost = await wpRes.json();

  await querySupabase(`/alerts?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "published",
      wordpress_post_id: wpPost.id,
      wordpress_url: wpPost.link,
      updated_at: nowIso(),
    }),
  });

  return json({ ok: true, wordpress: wpPost });
}

// ----------------------------------------------------------------------
// ALERTS — DISMISS
// ----------------------------------------------------------------------
if (path.startsWith("/alerts/") && path.endsWith("/dismiss") && method === "POST") {
  const id = path.split("/")[2];
  const updated = await querySupabase(`/alerts?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status: "dismissed", updated_at: nowIso() }),
  });
  return json({ ok: true, alert: updated?.[0] });
}

// ----------------------------------------------------------------------
// SCOUR — START
// ----------------------------------------------------------------------
if (path === "/scour-sources" && method === "POST") {
  const body = await req.json();
  const sourceIds: string[] = body.sourceIds || [];
  const daysBack = body.daysBack || 14;

  const jobId = crypto.randomUUID();

  EdgeRuntime.waitUntil(
    runScourJob(jobId, sourceIds, daysBack)
  );

  return json({
    ok: true,
    jobId,
    status: "running",
    total: sourceIds.length,
  });
}

// ----------------------------------------------------------------------
// SCOUR — STATUS
// ----------------------------------------------------------------------
if (path === "/scour/status" && method === "GET") {
  const jobId =
    url.searchParams.get("jobId") ||
    (await getKV("last_scour_job"));

  if (!jobId) return json({ ok: true, job: null });

  const job = await getKV(`scour_job:${jobId}`);
  return json({ ok: true, job });
}

  let path = url.pathname
    .replace("/functions/v1/clever-function", "")
    .replace("/clever-function", "");

  if (path.endsWith("/") && path !== "/") path = path.slice(0, -1);

  try {
    // ----------------------------------------------------------------------
    // HEALTH
    // ----------------------------------------------------------------------
    if (path === "/health" && method === "GET") {
      return json({ ok: true, time: new Date().toISOString() });
    }

    // ----------------------------------------------------------------------
    // ALERTS — GET ALL
    // ----------------------------------------------------------------------
    if (path === "/alerts" && method === "GET") {
      const status = url.searchParams.get("status");
      const limit = url.searchParams.get("limit") ?? "200";

      let q = `/alerts?order=created_at.desc&limit=${limit}`;
      if (status) q = `/alerts?status=eq.${status}&order=created_at.desc&limit=${limit}`;

      const alerts = await querySupabase(q);
      return json({ ok: true, alerts });
    }

    // ----------------------------------------------------------------------
    // ALERTS — REVIEW (DRAFT)
    // ----------------------------------------------------------------------
    if (path === "/alerts/review" && method === "GET") {
      const alerts = await querySupabase(
        "/alerts?status=eq.draft&order=created_at.desc&limit=200"
      );
      return json({ ok: true, alerts });
    }

    // ----------------------------------------------------------------------
    // ALERTS — GET ONE
    // ----------------------------------------------------------------------
    if (path.startsWith("/alerts/") && method === "GET") {
      const id = path.split("/")[2];
      const rows = await querySupabase(`/alerts?id=eq.${id}`);
      if (!rows?.length) return json({ ok: false, error: "Not found" }, 404);
      return json({ ok: true, alert: rows[0] });
    }

    // ----------------------------------------------------------------------
    // ALERTS — CREATE
    // ----------------------------------------------------------------------
    if (path === "/alerts" && method === "POST") {
      const body = await req.json();
      const now = new Date().toISOString();

      const created = await querySupabase("/alerts", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          ...body,
          status: body.status ?? "draft",
          created_at: now,
          updated_at: now,
        }),
      });

      return json({ ok: true, alert: created[0] });
    }

    // ----------------------------------------------------------------------
    // ALERTS — UPDATE
    // ----------------------------------------------------------------------
    if (path.startsWith("/alerts/") && method === "PATCH") {
      const id = path.split("/")[2];
      const body = await req.json();

      const updated = await querySupabase(`/alerts?id=eq.${id}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          ...body,
          updated_at: new Date().toISOString(),
        }),
      });

      return json({ ok: true, alert: updated?.[0] });
    }

    // ----------------------------------------------------------------------
    // ALERTS — DELETE
    // ----------------------------------------------------------------------
    if (path.startsWith("/alerts/") && method === "DELETE") {
      const id = path.split("/")[2];
      await querySupabase(`/alerts?id=eq.${id}`, { method: "DELETE" });
      return json({ ok: true, deleted: id });
    }

// ----------------------------------------------------------------------
// SOURCES — GET ALL
// ----------------------------------------------------------------------
if (path === "/sources" && method === "GET") {
  const q = url.searchParams.get("q");
  let endpoint = "/sources?order=created_at.desc&limit=500";
  if (q) {
    endpoint = `/sources?or=(name.ilike.*${q}*,url.ilike.*${q}*)&order=created_at.desc`;
  }
  const sources = await querySupabase(endpoint);
  return json({ ok: true, sources: sources || [] });
}

// ----------------------------------------------------------------------
// SOURCES — CREATE
// ----------------------------------------------------------------------
if (path === "/sources" && method === "POST") {
  const body = await req.json();
  const created = await querySupabase("/sources", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      id: crypto.randomUUID(),
      ...body,
      created_at: nowIso(),
      updated_at: nowIso(),
    }),
  });
  return json({ ok: true, source: created?.[0] });
}

// ----------------------------------------------------------------------
// SOURCES — UPDATE
// ----------------------------------------------------------------------
if (path.startsWith("/sources/") && method === "PATCH") {
  const id = path.split("/")[2];
  const body = await req.json();
  const updated = await querySupabase(`/sources?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...body, updated_at: nowIso() }),
  });
  return json({ ok: true, source: updated?.[0] });
}

// ----------------------------------------------------------------------
// SOURCES — DELETE
// ----------------------------------------------------------------------
if (path.startsWith("/sources/") && method === "DELETE") {
  const id = path.split("/")[2];
  await querySupabase(`/sources?id=eq.${id}`, { method: "DELETE" });
  return json({ ok: true, deleted: id });
}