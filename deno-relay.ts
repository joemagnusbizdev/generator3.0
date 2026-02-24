// Debug timestamp
const DEBUG_START = new Date().toISOString();
const TELEGRAM_TOKEN = "8707153044:AAFQEQvq_3QmABdrQSQUHC7osDawsOVtUJc";
const CLAUDE_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("CLAUDE_API_KEY");
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
const GITHUB_OWNER = "joemagnusbizdev";
const GITHUB_REPO = "generator3.0";

console.log(`[] Bot started at ${DEBUG_START}`);
console.log(`[] CLAUDE_API_KEY configured: ${!!CLAUDE_API_KEY}`);
console.log(`[] GITHUB_TOKEN configured: ${!!GITHUB_TOKEN}`);

let projectContext = "";
let contextLastLoaded = 0;
const CONTEXT_CACHE_TIME = 3600000;

async function loadProjectContext(): Promise<void> {
  const now = Date.now();
  if (contextLastLoaded && now - contextLastLoaded < CONTEXT_CACHE_TIME) return;
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/CLAUDE.md`, {
      headers: { "Authorization": `token ${GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3.raw" }
    });
    if (response.ok) {
      projectContext = await response.text();
      contextLastLoaded = now;
      console.log(`[] Loaded context: ${projectContext.length} bytes`);
    }
  } catch (e) {
    console.error(`[] Failed to load context:`, e);
  }
}

async function readFileFromGithub(filePath: string): Promise<string> {
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`, {
      headers: { "Authorization": `token ${GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3.raw" }
    });
    return response.ok ? await response.text() : ` Could not find: ${filePath}`;
  } catch (error) {
    console.error(`[] File read error:`, error);
    return ` Error reading file`;
  }
}

async function getFileBlob(filePath: string): Promise<{ content: string; sha: string } | null> {
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`, {
      headers: { "Authorization": `token ${GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3+json" }
    });
    if (!response.ok) return null;
    const data: any = await response.json();
    return data.type === "file" ? { content: atob(data.content), sha: data.sha } : null;
  } catch (error) {
    return null;
  }
}

async function updateFileOnGithub(filePath: string, newContent: string, commitMessage: string): Promise<{ success: boolean; message: string }> {
  try {
    const fileData = await getFileBlob(filePath);
    if (!fileData) return { success: false, message: ` File not found` };

    const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`, {
      method: "PUT",
      headers: { "Authorization": `token ${GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3+json", "Content-Type": "application/json" },
      body: JSON.stringify({ message: commitMessage, content: btoa(newContent), sha: fileData.sha }),
    });

    return response.ok ? { success: true, message: ` Updated!` } : { success: false, message: ` Update failed` };
  } catch (error) {
    return { success: false, message: ` Error` };
  }
}

interface FileUpdate {
  filePath: string;
  commitMessage: string;
  content: string;
}

function parseFileUpdates(text: string): FileUpdate[] {
  const updates: FileUpdate[] = [];
  const blockRegex = /===FILE_UPDATE_START===([\s\S]*?)===FILE_UPDATE_END===/g;
  let match;
  while ((match = blockRegex.exec(text)) !== null) {
    const block = match[1];
    const fpMatch = block.match(/FILE_PATH:\s*([^\n]+)/);
    const cmMatch = block.match(/COMMIT_MESSAGE:\s*([^\n]+)/);
    const ctMatch = block.match(/FILE_CONTENT:\s*```[\w]*\n([\s\S]*?)\n```/);
    if (fpMatch && cmMatch && ctMatch) {
      updates.push({ filePath: fpMatch[1].trim(), commitMessage: cmMatch[1].trim(), content: ctMatch[1] });
    }
  }
  return updates;
}

async function executeFileUpdates(updates: FileUpdate[]): Promise<string[]> {
  const results: string[] = [];
  for (const update of updates) {
    const result = await updateFileOnGithub(update.filePath, update.content, update.commitMessage);
    results.push(result.success ? ` Updated: ${update.filePath}` : ` Failed: ${update.filePath}`);
  }
  return results;
}

async function callClaudeAsAgent(userRequest: string, fileContext?: string): Promise<{ response: string; updates: FileUpdate[] }> {
  console.log(`[] Claude call started`);
  console.log(`[] API Key set: ${!!CLAUDE_API_KEY}`);
  
  if (!CLAUDE_API_KEY) {
    console.error(`[] NO CLAUDE_API_KEY`);
    return { response: " System not configured", updates: [] };
  }

  await loadProjectContext();

  try {
    const systemPrompt = `Help non-technical users manage their project. Be simple and friendly.${fileContext ? `\n\nFile info:\n${fileContext}` : ""}`;

    console.log(`[] Calling Claude API...`);
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": CLAUDE_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-opus-4-1-20250805",
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: userRequest }],
      }),
    });

    console.log(`[] Claude response status: ${response.status}`);
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`[] Claude error (${response.status}):`, error.substring(0, 200));
      return { response: " Claude error", updates: [] };
    }

    const result: any = await response.json();
    const text = result.content[0]?.text || "No response";
    const updates = parseFileUpdates(text);
    
    console.log(`[] Got Claude response: ${text.length} chars, ${updates.length} updates`);
    return { response: text, updates };
  } catch (error) {
    console.error(`[] Claude call error:`, error);
    return { response: ` Error: ${error}`, updates: [] };
  }
}

async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  console.log(`[] Sending to Telegram ${chatId}: ${text.length} chars`);
  const chunks = text.length > 4096 ? [text.substring(0, 4096), text.substring(4096)] : [text];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    try {
      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: "Markdown" }),
      });
      console.log(`[] Telegram response ${i + 1}: ${response.status}`);
      if (!response.ok) {
        const err = await response.text();
        console.error(`[] Telegram error:`, err.substring(0, 100));
      }
    } catch (error) {
      console.error(`[] Telegram send error:`, error);
    }
  }
}

async function processRequest(chatId: number, userMessage: string): Promise<void> {
  console.log(`[] Processing: ${userMessage.substring(0, 50)}`);
  try {
    let fileContext = "";
    const fileMatch = userMessage.match(/(?:file|code|read|show)\s+(?:the\s+)?["`]?([^\s"`]+)["`]?/i);
    if (fileMatch) {
      const filePath = fileMatch[1];
      console.log(`[] Loading file: ${filePath}`);
      const content = await readFileFromGithub(filePath);
      if (!content.startsWith("")) {
        fileContext = `File: ${filePath}\n\n${content.substring(0, 1500)}`;
      }
    }

    const { response, updates } = await callClaudeAsAgent(userMessage, fileContext);
    const textBefore = response.split("===FILE_UPDATE_START===")[0].trim();

    if (textBefore) {
      await sendTelegramMessage(chatId, textBefore);
    }

    if (updates.length > 0) {
      await sendTelegramMessage(chatId, `Applying changes...`);
      const results = await executeFileUpdates(updates);
      await sendTelegramMessage(chatId, ` Done!\n\n${results.join("\n")}`);
    }
  } catch (error) {
    console.error(`[] Process error:`, error);
    await sendTelegramMessage(chatId, ` Error: ${error}`).catch(e => console.error(e));
  }
}

async function handleMessage(chatId: number, text: string): Promise<void> {
  console.log(`[] Message from ${chatId}: "${text.substring(0, 60)}"`);
  
  if (text.toLowerCase().includes("help")) {
    await sendTelegramMessage(chatId, `Just ask me anything! I can explain features, read files, and help fix issues.`);
  } else if (text.toLowerCase().includes("status")) {
    await sendTelegramMessage(chatId, ` I'm working and ready to help!`);
  } else {
    await processRequest(chatId, text);
  }
}

async function handleWebhook(request: Request): Promise<Response> {
  console.log(`[] Webhook received`);
  try {
    const update: any = await request.json();
    console.log(`[] Update: ${JSON.stringify(update).substring(0, 100)}`);
    
    if (update.message?.chat?.id && update.message?.text) {
      console.log(`[] Valid message from ${update.message.chat.id}`);
      handleMessage(update.message.chat.id, update.message.text).catch(e => {
        console.error(`[] Handle error:`, e);
      });
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
  console.log(`[${new Date().toISOString()}] ${request.method} ${new URL(request.url).pathname}`);
  
  if (request.method === "POST") {
    return await handleWebhook(request);
  }
  
  return new Response(JSON.stringify({ ok: true, message: "Bot is running" }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
});
