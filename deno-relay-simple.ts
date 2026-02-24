/**
 * Telegram Claude Bot - Simple Architecture
 * Direct Telegram → Claude API (no Supabase relay needed)
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
    return; // Use cached context
  }

  try {
    console.log("[📚] Loading project context from GitHub...");
    const response = await fetch(
      "https://api.github.com/repos/joemagnusbizdev/generator3.0/contents/CLAUDE.md",
      {
        headers: {
          "Authorization": `token ${GITHUB_TOKEN}`,
          "Accept": "application/vnd.github.v3.raw",
        },
      }
    );

    if (response.ok) {
      projectContext = await response.text();
      contextLastLoaded = now;
      console.log("[✅] Context loaded successfully");
    } else {
      console.error("[❌] Failed to load context:", response.status);
      projectContext =
        "Project context unavailable. I'm a Claude AI assistant.";
    }
  } catch (error) {
    console.error("[❌] Error loading context:", error);
    projectContext = "Project context unavailable. I'm a Claude AI assistant.";
  }
}

async function callClaude(userMessage: string): Promise<string> {
  if (!CLAUDE_API_KEY) {
    return "❌ Claude API key not configured";
  }

  try {
    console.log(`[🤖] Calling Claude API...`);

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
      console.error(`[❌] Claude API error (${response.status}):`, error);
      return `❌ Claude API error: ${response.status}`;
    }

    const result: any = await response.json();
    const text = result.content[0]?.text || "No response from Claude";
    console.log(`[✅] Got response from Claude (${text.length} chars)`);
    return text;
  } catch (error) {
    console.error("[❌] Claude API error:", error);
    return `❌ Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function sendTelegramMessage(
  chatId: number,
  text: string
): Promise<void> {
  try {
    const chunks = text.length > 4096
      ? [text.substring(0, 4096), text.substring(4096)]
      : [text];

    for (const chunk of chunks) {
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
    }
  } catch (error) {
    console.error("[❌] Failed to send Telegram message:", error);
  }
}

async function handleMessage(
  chatId: number,
  text: string
): Promise<void> {
  console.log(`[📨] Message from ${chatId}: "${text.substring(0, 100)}"`);

  // Load project context
  await loadProjectContext();

  // Get response from Claude
  const response = await callClaude(text);

  // Send response back to Telegram
  await sendTelegramMessage(chatId, response);
}

async function handleWebhook(request: Request): Promise<Response> {
  try {
    const update: any = await request.json();

    if (update.message) {
      const { chat, text } = update.message;
      if (text && chat) {
        // Process message but don't wait (fire and forget)
        handleMessage(chat.id, text).catch((err) => {
          console.error("[❌] Error handling message:", err);
        });
      }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    console.error("[❌] Webhook error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500 }
    );
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === "POST") {
    return handleWebhook(request);
  }

  if (request.method === "GET") {
    return new Response(
      JSON.stringify({
        status: "✅ Telegram Claude Bot Active",
        version: "1.0 (Simple Direct)",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response("Method not allowed", { status: 405 });
});
