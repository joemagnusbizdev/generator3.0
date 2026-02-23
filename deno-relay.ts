// Telegram Webhook Relay for Deno Deploy
// Deploy this to https://dash.deno.com
// No authentication needed - Deno Deploy is public by default

const SUPABASE_URL = "https://gnobnyzezkuyptuakztf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_1iNgvQzTvtYKqWCdE3oIKg_rjsRMwGG";

async function handler(req: Request): Promise<Response> {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  // Only accept POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Only POST allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    console.log(
      `[Relay] Received webhook update_id=${body.update_id}, message text="${body.message?.text?.substring(0, 50)}"`
    );

    // Forward to Supabase telegram-claude function with apikey header
    console.log(`[Relay] Forwarding to ${SUPABASE_URL}/functions/v1/telegram-claude`);

    const forwardResponse = await fetch(
      `${SUPABASE_URL}/functions/v1/telegram-claude`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(body),
      }
    );

    const responseText = await forwardResponse.text();
    console.log(
      `[Relay] Forward response status=${forwardResponse.status}, body="${responseText.substring(0, 100)}"`
    );

    // Always return 200 to Telegram/webhook caller
    // This confirms we received the message (don't wait for Supabase response)
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error(`[Relay] Error: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

Deno.serve(handler);
