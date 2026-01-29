/// <reference lib="deno.unstable" />

// ============================================================================
// ENV
// ============================================================================
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase env vars");
}

// Load API keys from Supabase KV at runtime
let OPENAI_API_KEY = "";
let BRAVE_SEARCH_API_KEY = "";

async function loadApiKeys() {
  try {
    OPENAI_API_KEY = (await getKV("api_key:openai")) ?? "";
    BRAVE_SEARCH_API_KEY = (await getKV("api_key:brave")) ?? "";
  } catch (e) {
    console.error("Failed to load API keys from Supabase:", e);
  }
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
const SEVERITY_ORDER: Record<string, number> = {
  critical: 4,
  warning: 3,
  caution: 2,
  informative: 1,
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function nowIso() {
  return new Date().toISOString();
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
  try {
    const url =
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`;

    const r = await fetch(url, {
      headers: {
        "X-Subscription-Token": BRAVE_SEARCH_API_KEY,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!r.ok) return "";
    const j = await r.json();
    return (j.web?.results || [])
      .map((x: any) => `${x.title}\n${x.description}\n${x.url}`)
      .join("\n");
  } catch (e) {
    console.error("Brave search error:", e);
    return "";
  }
}
async function extractAlertsAI(text: string, source: any): Promise<any[]> {
  if (!OPENAI_API_KEY) return [];

  try {
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
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      console.error(`OpenAI API error: ${res.status}`);
      return [];
    }

    const j = await res.json();
    try {
      const parsed = JSON.parse(j.choices[0].message.content);
      return Array.isArray(parsed) ? parsed : [];
    } catch (parseErr) {
      console.error("Failed to parse AI response:", parseErr);
      return [];
    }
  } catch (e) {
    console.error("AI extraction error:", e);
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
    startedAt: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await setKV(`scour_job:${jobId}`, job);

  // Set job timeout (30 mins for safety)
  const jobTimeout = 30 * 60 * 1000;
  const startTime = Date.now();

  for (const sourceId of sourceIds) {
    // Check if job has exceeded timeout
    if (Date.now() - startTime > jobTimeout) {
      job.errors.push("Job exceeded maximum timeout");
      break;
    }

    try {
      // Fetch source with timeout
      const sources = await Promise.race([
        querySupabase(`/sources?id=eq.${sourceId}`),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Source fetch timeout")), 10000)
        ),
      ]);

      const source = (sources as any)?.[0];
      if (!source?.url) {
        job.processed++;
        continue;
      }

      // Get content with fallback strategy
      let text = "";
      try {
        text = await braveSearch(source.name);
      } catch (e) {
        console.error(`Brave search failed for ${source.name}:`, e);
      }

      if (text.length < 300) {
        try {
          text = await scrapeText(source.url);
        } catch (e) {
          console.error(`Scrape failed for ${source.url}:`, e);
        }
      }

      if (text.length < 200) {
        job.processed++;
        continue;
      }

      // Extract alerts with error recovery
      let alerts: any[] = [];
      try {
        alerts = await extractAlertsAI(text, source);
      } catch (e) {
        console.error(`AI extraction failed for ${source.name}:`, e);
        job.errors.push(`AI failed: ${source.name}`);
      }

      // Save alerts with individual error handling
      for (const a of alerts) {
        try {
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
        } catch (e) {
          console.error(`Failed to save alert:`, e);
          job.errorCount++;
        }
      }

      job.processed++;
    } catch (e: any) {
      job.errorCount++;
      const msg = String(e?.message || e);
      job.errors.push(`${sourceId}: ${msg}`);
      console.error(`Source ${sourceId} failed:`, e);
      // Continue to next source instead of breaking
      job.processed++;
    }

    // Update progress every source
    try {
      await setKV(`scour_job:${jobId}`, {
        ...job,
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Failed to update job status:", e);
    }
  }

  // Final completion
  try {
    await setKV(`scour_job:${jobId}`, {
      ...job,
      status: "done",
      completedAt: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Failed to mark job complete:", e);
  }
}

// ============================================================================
// ROUTER (SINGLE, CLEAN, FINAL)
// ============================================================================

// Load API keys once at startup
await loadApiKeys();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  const url = new URL(req.url);
  const method = req.method.toUpperCase();

  let path = url.pathname
    .replace("/functions/v1/clever-function", "")
    .replace("/clever-function", "");

  if (path.endsWith("/") && path !== "/") {
    path = path.slice(0, -1);
  }

  try {

    // ------------------------------------------------------------------
    // TRENDS — GET
    // ------------------------------------------------------------------
    if (path === "/trends" && method === "GET") {
      const trends =
        (await querySupabase("/trends?order=created_at.desc&limit=1000")) || [];
      return json({ ok: true, trends });
    }

    // ------------------------------------------------------------------
    // TRENDS — REBUILD
    // ------------------------------------------------------------------
    if (path === "/trends/rebuild" && method === "POST") {
      const alerts =
        (await querySupabase(
          "/alerts?status=eq.approved&select=country,event_type,severity,created_at"
        )) || [];

      const SEVERITY_ORDER: Record<string, number> = {
        critical: 4,
        warning: 3,
        caution: 2,
        informative: 1,
      };

      const map: Record<string, any> = {};

      for (const a of alerts) {
        const key = `${a.country || "Unknown"}::${a.event_type || "General"}`;

        if (!map[key]) {
          map[key] = {
            id: crypto.randomUUID(),
            country: a.country || "Unknown",
            category: a.event_type || "General",
            count: 0,
            highest_severity: a.severity,
            last_seen_at: a.created_at,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        }

        map[key].count++;

        if (
          SEVERITY_ORDER[a.severity] >
          SEVERITY_ORDER[map[key].highest_severity]
        ) {
          map[key].highest_severity = a.severity;
        }

        if (a.created_at > map[key].last_seen_at) {
          map[key].last_seen_at = a.created_at;
        }
      }

      const trends = Object.values(map);

      await querySupabase("/trends", { method: "DELETE" });

      if (trends.length) {
        await querySupabase("/trends", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(trends),
        });
      }

      return json({ ok: true, rebuilt: trends.length });
    }

    // ------------------------------------------------------------------
    // SCOUR JOB — START
    // ------------------------------------------------------------------
    if (path === "/scour/job" && method === "POST") {
      const body = await req.json();
      const { sourceIds = [], daysBack = 7 } = body;

      if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
        return json(
          { ok: false, error: "sourceIds must be a non-empty array" },
          400
        );
      }

      const jobId = crypto.randomUUID();
      
      // Start job in background (non-blocking)
      runScourJob(jobId, sourceIds, daysBack).catch((e) => {
        console.error(`Scour job ${jobId} failed:`, e);
      });

      return json({ ok: true, jobId, message: "Scour job started" });
    }

    // ------------------------------------------------------------------
    // SCOUR JOB — STATUS
    // ------------------------------------------------------------------
    if (path.startsWith("/scour/job/") && method === "GET") {
      const jobId = path.replace("/scour/job/", "");
      const job = await getKV(`scour_job:${jobId}`);
      
      if (!job) {
        return json({ ok: false, error: "Job not found" }, 404);
      }

      return json({ ok: true, job });
    }

    // ------------------------------------------------------------------
    // HEALTH
    // ------------------------------------------------------------------
    if (path === "/health" && method === "GET") {
      return json({
        ok: true,
        time: new Date().toISOString(),
        apiKeysLoaded: !!OPENAI_API_KEY && !!BRAVE_SEARCH_API_KEY,
      });
    }

    // ------------------------------------------------------------------
    // Disable source endpoint (admin)
    if (path === "/admin/disable-source" && method === "POST") {
      const body = await req.json();
      const { sourceName } = body;
      
      if (!sourceName) {
        return json({ ok: false, error: "sourceName required" }, 400);
      }

      try {
        const result = await querySupabase(
          `/sources?name=eq.${encodeURIComponent(sourceName)}`,
          {
            method: "PATCH",
            body: JSON.stringify({ enabled: false }),
          }
        );
        return json({ ok: true, message: `Disabled ${sourceName}`, result });
      } catch (e) {
        return json({ ok: false, error: String(e) }, 500);
      }
    }

    // ------------------------------------------------------------------
    // FALLTHROUGH
    // ------------------------------------------------------------------
    return json({ ok: false, error: "Not found", path }, 404);

  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
});
