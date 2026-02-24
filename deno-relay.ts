const TELEGRAM_TOKEN = "8707153044:AAFQEQvq_3QmABdrQSQUHC7osDawsOVtUJc";
const CLAUDE_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("CLAUDE_API_KEY");
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");

console.log(`[START] CLAUDE=${!!CLAUDE_API_KEY}, GITHUB=${!!GITHUB_TOKEN}`);

let projectContext = "";

async function loadContext(): Promise<void> {
  if (projectContext || !GITHUB_TOKEN) return;
  try {
    const r = await fetch("https://api.github.com/repos/joemagnusbizdev/generator3.0/contents/CLAUDE.md", {
      headers: { "Authorization": `token ${GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3.raw" }
    });
    if (r.ok) {
      projectContext = await r.text();
      console.log(`[CONTEXT] Loaded: ${projectContext.length} bytes`);
    }
  } catch (e) {
    console.error(`[ERROR] Context: ${e}`);
  }
}

async function sendMsg(chatId: number, text: string): Promise<void> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: text }),
    });
    console.log(`[MSG] To ${chatId}: ${r.status}`);
  } catch (e) {
    console.error(`[MSG ERROR] ${e}`);
  }
}

async function callClaude(msg: string): Promise<string> {
  if (!CLAUDE_API_KEY) return " NOT CONFIGURED";
  try {
    await loadContext();
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": CLAUDE_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-opus-4-1-20250805",
        max_tokens: 1000,
        system: `You are helpful. Project context: ${projectContext.substring(0, 2000)}`,
        messages: [{ role: "user", content: msg }],
      }),
    });
    if (r.ok) {
      const data: any = await r.json();
      return data.content[0]?.text || "No response";
    }
    return ` Claude error: ${r.status}`;
  } catch (e) {
    return ` Exception: ${e}`;
  }
}

async function process(chatId: number, text: string): Promise<void> {
  console.log(`[PROCESS] ${chatId}: ${text.substring(0, 30)}`);
  try {
    await sendMsg(chatId, " Processing...");
    const resp = await callClaude(text);
    await sendMsg(chatId, resp);
  } catch (e) {
    console.error(`[PROCESS ERROR] ${e}`);
    await sendMsg(chatId, `Error: ${e}`).catch(() => {});
  }
}

Deno.serve(async (req) => {
  console.log(`[${req.method}] ${new URL(req.url).pathname}`);
  
  if (req.method === "POST") {
    try {
      const update: any = await req.json();
      const msg = update.message;
      if (msg?.chat?.id && msg?.text) {
        console.log(`[WEBHOOK] Message from ${msg.chat.id}`);
        process(msg.chat.id, msg.text);
      }
    } catch (e) {
      console.error(`[WEBHOOK ERROR] ${e}`);
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
  
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
