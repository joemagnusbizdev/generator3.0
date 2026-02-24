/**
 * Telegram Claude Bot - Simple Architecture
 * Direct Telegram → Claude API (no Supabase relay needed)
 * With improved error handling and diagnostics
 */

const TELEGRAM_TOKEN = "8707153044:AAFQEQvq_3QmABdrQSQUHC7osDawsOVtUJc";
const CLAUDE_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ||
  Deno.env.get("CLAUDE_API_KEY");
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");

let projectContext = "";
let contextLastLoaded = 0;
const CONTEXT_CACHE_TIME = 3600000; // 1 hour

async function loadProjectContext(): Promise<void> {
  const now = Date.now();
  if (contextLastLoaded && now - contextLastLoaded < CONTEXT_CACHE_TIME) {
    console.log("[📚] Using cached project context");
    return; // Use cached context
  }

  try {
    console.log("[🔍] Loading project context from GitHub...");
    const response = await fetch(
      "https://api.github.com/repos/joemagnusbizdev/generator3.0/contents/CLAUDE.md",
      {
        headers: {
          "Authorization": `token ${GITHUB_TOKEN}`,
          "Accept": "application/vnd.github.v3.raw",
        },
      }
    );

    if (!response.ok) {
      console.error(`[❌] Failed to load CLAUDE.md: ${response.status}`);
      projectContext = "Unable to load project context";
      return;
    }

    projectContext = await response.text();
    contextLastLoaded = now;
    console.log(
      `[✅] Loaded project context (${projectContext.length} chars)`
    );
  } catch (error) {
    console.error("[❌] Error loading context:", error);
    projectContext = "Context loading failed";
  }
}

async function callClaude(userMessage: string): Promise<string> {
  if (!CLAUDE_API_KEY) {
    console.error("[❌] Claude API key not configured!");
    return "❌ Claude API key not configured in Deno Deploy environment";
  }

  if (!projectContext) {
    console.warn("[⚠️] Project context empty, loading...");
    await loadProjectContext();
  }

  try {
    console.log(`[🤖] Calling Claude API for message: "${userMessage.substring(0, 50)}..."`);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-1-20250805",
        max_tokens: 1000,
        system: `You are a helpful AI assistant with deep knowledge of the generator3.0 project. Help the user understand the codebase, architecture, and answer questions about the project.

Project Context:
${projectContext}`,
        messages: [
          {
            role: "user",
            content: userMessage,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[❌] Claude API error (${response.status}): ${error.substring(0, 100)}`);
      return `❌ Claude API error: ${response.status}. Check logs for details.`;
    }

    const result: any = await response.json();
    const text = result.content[0]?.text || "No response from Claude";
    console.log(`[✅] Got response from Claude (${text.length} chars)`);
    return text;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[❌] Claude call failed:", errorMsg);
    return `❌ Failed to call Claude: ${errorMsg}`;
  }
}

async function sendTelegramMessage(
  chatId: number,
  text: string
): Promise<void> {
  console.log(
    `[📤] Sending to Telegram ${chatId}: ${text.substring(0, 50)}...`
  );

  const chunks = text.length > 4096
    ? [text.substring(0, 4096), text.substring(4096)]
    : [text];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: chunk,
            parse_mode: "Markdown",
          }),
        }
      );

      if (!response.ok) {
        console.error(
          `[❌] Telegram error (${response.status}):`,
          await response.text()
        );
      } else {
        console.log(`[✅] Message sent to ${chatId}`);
      }
    } catch (error) {
      console.error("[❌] Failed to send Telegram message:", error);
    }
  }
}

async function handleMessage(
  chatId: number,
  text: string
): Promise<void> {
  console.log(`[📨] Processing message from ${chatId}: "${text.substring(0, 100)}"`);

  try {
    // Load project context
    await loadProjectContext();

    // Get response from Claude
    const response = await callClaude(text);

    // Send response back to Telegram
    await sendTelegramMessage(chatId, response);
  } catch (error) {
    console.error("[❌] Error in handleMessage:", error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    await sendTelegramMessage(
      chatId,
      `❌ Error processing message: ${errorMsg}`
    );
  }
}

async function handleWebhook(request: Request): Promise<Response> {
  console.log("[📡] Webhook received:", request.method);
  try {
    const update: any = await request.json();
    console.log("[✅] Webhook JSON parsed successfully");

    if (update.message) {
      const { chat, text } = update.message;
      if (text && chat) {
        console.log(`[→] Routing message from chat ${chat.id}`);
        // Process message but don't wait (fire and forget)
        handleMessage(chat.id, text).catch((err) => {
          console.error("[❌] Error handling message:", err);
        });
      }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[❌] Webhook error:", errorMsg);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: errorMsg,
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

Deno.serve(async (request: Request) => {
  try {
    if (request.method === "POST") {
      return await handleWebhook(request);
    }

    if (request.method === "GET") {
      const url = new URL(request.url);

      // Diagnostic endpoint
      if (url.pathname === "/status" || url.pathname === "/diagnose") {
        return new Response(
          JSON.stringify({
            status: "✅ Telegram Claude Bot Active",
            version: "1.0 (Simple Direct w/ Diagnostics)",
            timestamp: new Date().toISOString(),
            config: {
              claudeKeyConfigured: !!CLAUDE_API_KEY,
              claudeKeyStart: CLAUDE_API_KEY
                ? CLAUDE_API_KEY.substring(0, 8)
                : "NOT SET",
              githubTokenConfigured: !!GITHUB_TOKEN,
              projectContextLoaded: projectContext.length > 0,
              projectContextSize: projectContext.length,
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Default GET response
      return new Response(
        JSON.stringify({
          status: "✅ Telegram Claude Bot Active",
          version: "1.0 (Simple Direct)",
          endpoints: {
            "POST /": "Telegram webhook",
            "GET /": "Status",
            "GET /status": "Full diagnostics",
            "GET /diagnose": "Full diagnostics",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response("Method not allowed", { status: 405 });
  } catch (error) {
    console.error("[❌] Unexpected server error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
