const TELEGRAM_TOKEN = "8707153044:AAFQEQvq_3QmABdrQSQUHC7osDawsOVtUJc";
const CLAUDE_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("CLAUDE_API_KEY");
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");

let projectContext = "";

async function loadContext() {
  if (projectContext) return;
  try {
    const r = await fetch("https://api.github.com/repos/joemagnusbizdev/generator3.0/contents/CLAUDE.md", {
      headers: { "Authorization": `token ${GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3.raw" }
    });
    if (r.ok) projectContext = await r.text();
  } catch (e) {
    console.error("Context load failed:", e);
  }
}

async function sendMessage(chatId, text) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: text })
    });
    if (!response.ok) {
      const err = await response.text();
      console.error(`Telegram error: ${response.status}: ${err}`);
    }
  } catch (e) {
    console.error("Message send error:", e);
  }
}

async function askClaude(question) {
  if (!CLAUDE_API_KEY) return "Claude not configured";
  
  try {
    await loadContext();
    
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-opus-4-1-20250805",
        max_tokens: 1000,
        system: projectContext ? `You are an AI assistant for the generator3.0 project. Here is the project context:\n\n${projectContext}` : "You are helpful.",
        messages: [{ role: "user", content: question }]
      })
    });

    if (!response.ok) {
      return `Claude API error: ${response.status}`;
    }

    const json = await response.json();
    return json.content[0]?.text || "No response";
  } catch (e) {
    return `Error: ${e}`;
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response("OK", { status: 200 });
  }

  try {
    const update = await request.json();
    
    if (update.message && update.message.chat && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text;
      
      console.log(`Message from ${chatId}: ${text}`);
      
      // Send acknowledgment
      await sendMessage(chatId, " Processing...");
      
      // Get Claude response
      const response = await askClaude(text);
      
      // Send response
      await sendMessage(chatId, response);
    }
  } catch (e) {
    console.error("Webhook error:", e);
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
