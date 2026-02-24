import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const supabaseUrl = "https://gnobnyzezkuyptuakztf.supabase.co";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "sb_publishable_1iNgvQzTvtYKqWCdE3oIKg_rjsRMwGG";

console.log("Telegram webhook relay function started");

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  try {
    // Only accept POST
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Only POST allowed" }),
        { status: 405 }
      );
    }

    // Get the incoming webhook body from Telegram via webhook.cool
    const body = await req.json();
    console.log("Received webhook:", JSON.stringify(body).substring(0, 200));

    // Forward to our telegram-claude function with apikey header
    const forwardResponse = await fetch(
      `${supabaseUrl}/functions/v1/telegram-claude`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify(body),
      }
    );

    const responseText = await forwardResponse.text();
    console.log(
      "Forward response:",
      responseText.substring(0, 200),
      "Status:",
      forwardResponse.status
    );

    // Return success response to webhook.cool/Telegram
    // This tells Telegram the webhook was processed
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error in relay:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
});
