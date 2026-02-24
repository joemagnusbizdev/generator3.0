const DEBUG_START = new Date().toISOString();
const TELEGRAM_TOKEN = "8707153044:AAFQEQvq_3QmABdrQSQUHC7osDawsOVtUJc";
const CLAUDE_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("CLAUDE_API_KEY");
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
const GITHUB_OWNER = "joemagnusbizdev";
const GITHUB_REPO = "generator3.0";

console.log(`[] START: CLAUDE=${!!CLAUDE_API_KEY}, GITHUB=${!!GITHUB_TOKEN}, TELEGRAM=${!!TELEGRAM_TOKEN}`);

let projectContext = "";

async function loadProjectContext(): Promise<void> {
  if (projectContext) return;
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/CLAUDE.md`, {
      headers: { "Authorization": `token ${GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3.raw" }
    });
    if (response.ok) {
      projectContext = await response.text();
      console.log(`[] Context loaded: ${projectContext.length} bytes`);
    } else {
      console.error(`[] Context failed: ${response.status}`);
    }
  } catch (error) {
    console.error(`[] Context error:`, error);
  }
}

async function sendTelegramMessage(chatId: number, text: string): Promise<boolean> {
  console.log(`[] SEND to ${chatId}: "${text.substring(0, 40)}..."`);
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        chat_id: chatId, 
        text: text,
        parse_mode: "Markdown" 
      }),
    });
    
    const ok = response.ok;
    console.log(`[${ok ? '' : ''}] Telegram ${chatId}: ${response.status}`);
    
    if (!ok) {
      const err = await response.text();
      console.error(`[] Telegram error: ${err.substring(0, 100)}`);
    }
    return ok;
  } catch (error) {
    console.error(`[] Send error:`, error);
    return false;
  }
}

async function callClaude(userMessage: string): Promise<string> {
  console.log(`[] Claude call for: "${userMessage.substring(0, 40)}..."`);
  
  if (!CLAUDE_API_KEY) {
    console.error(`[] NO CLAUDE_API_KEY`);
    return " Claude not configured";
  }

  if (!projectContext) {
    console.log(`[] Loading context first...`);
    await loadProjectContext();
  }

  try {
    const systemPrompt = `You are an AI assistant for the generator3.0 project. Answer questions about the project.

Project Context:
${projectContext ? projectContext.substring(0, 3000) : "Context not loaded"}`;

    console.log(`[] POST to Claude API with ${projectContext.length} bytes context`);
    
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { 
        "x-api-key": CLAUDE_API_KEY, 
        "anthropic-version": "2023-06-01", 
        "content-type": "application/json" 
      },
      body: JSON.stringify({
        model: "claude-opus-4-1-20250805",
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    console.log(`[] Claude response: ${response.status}`);
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`[] Claude error (${response.status}): ${error.substring(0, 100)}`);
      return " Claude error (check logs)";
    }

    const result: any = await response.json();
    const text = result.content[0]?.text || "No response from Claude";
    console.log(`[] Claude replied: ${text.length} chars`);
    return text;
  } catch (error) {
    console.error(`[] Claude exception:`, error);
    return ` Error calling Claude`;
  }
}

async function handleMessage(chatId: number, text: string): Promise<void> {
  console.log(`\n[] >>> MESSAGE from ${chatId}: "${text}"`);
  
  try {
    // Send immediate acknowledgment
    console.log(`[] Sending acknowledgment...`);
    await sendTelegramMessage(chatId, ` Processing your question...`);
    
    // Call Claude
    console.log(`[] Calling Claude...`);
    const response = await callClaude(text);
    
    // Send response
    console.log(`[] Sending response...`);
    const sent = await sendTelegramMessage(chatId, response);
    
    if (sent) {
      console.log(`[] Message delivered to ${chatId}`);
    } else {
      console.error(`[] Failed to send to ${chatId}`);
    }
  } catch (error) {
    console.error(`[] Handler error:`, error);
    await sendTelegramMessage(chatId, ` Error: ${error}`).catch(e => console.error(e));
  }
}

async function handleWebhook(request: Request): Promise<Response> {
  console.log(`[] WEBHOOK received`);
  try {
    const update: any = await request.json();
    console.log(`[] Update type: ${update.update_id}`);
    
    if (update.message?.chat?.id && update.message?.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text;
      console.log(`[] Valid message: chat=${chatId}`);
      
      // Process async but return 200 immediately
      handleMessage(chatId, text).catch(e => console.error(`[] Message error:`, e));
    } else {
      console.log(`[] Invalid message format`);
    }
    
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    console.error(`[] Webhook error:`, error);
    return new Response(JSON.stringify({ error: "Error" }), { status: 500 });
  }
}

Deno.serve(async (request: Request) => {
  const path = new URL(request.url).pathname;
  console.log(`[${new Date().toISOString()}] ${request.method} ${path}`);
  
  if (request.method === "POST" && path === "/") {
    return await handleWebhook(request);
  }
  
  if (request.method === "GET" && path === "/debug") {
    return new Response(JSON.stringify({
      status: "OK",
      timestamp: new Date().toISOString(),
      config: {
        TELEGRAM_TOKEN: !!TELEGRAM_TOKEN,
        CLAUDE_API_KEY: !!CLAUDE_API_KEY,
        GITHUB_TOKEN: !!GITHUB_TOKEN,
        projectContext: projectContext ? `Yes (${projectContext.length} bytes)` : "No",
      }
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
