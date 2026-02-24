/**
 * Generator3.0 Telegram Agent - User Friendly Version
 * For operators with no technical experience
 * Plain English commands and feedback
 */

const TELEGRAM_TOKEN = "8707153044:AAFQEQvq_3QmABdrQSQUHC7osDawsOVtUJc";
const CLAUDE_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("CLAUDE_API_KEY");
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
const GITHUB_OWNER = "joemagnusbizdev";
const GITHUB_REPO = "generator3.0";

let projectContext = "";
let contextLastLoaded = 0;
const CONTEXT_CACHE_TIME = 3600000;

async function loadProjectContext(): Promise<void> {
  const now = Date.now();
  if (contextLastLoaded && now - contextLastLoaded < CONTEXT_CACHE_TIME) return;

  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/CLAUDE.md`,
      { headers: { "Authorization": `token ${GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3.raw" } }
    );
    if (response.ok) {
      projectContext = await response.text();
      contextLastLoaded = now;
    }
  } catch (error) {
    console.error("[] Context load error:", error);
  }
}

async function readFileFromGithub(filePath: string): Promise<string> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`,
      { headers: { "Authorization": `token ${GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3.raw" } }
    );
    return response.ok ? await response.text() : ` Could not find that file: ${filePath}`;
  } catch (error) {
    return ` Error reading file: ${error}`;
  }
}

async function getFileBlob(filePath: string): Promise<{ content: string; sha: string } | null> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`,
      { headers: { "Authorization": `token ${GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3+json" } }
    );
    if (!response.ok) return null;
    const data: any = await response.json();
    return data.type === "file" ? { content: atob(data.content), sha: data.sha } : null;
  } catch (error) {
    return null;
  }
}

async function updateFileOnGithub(filePath: string, newContent: string, commitMessage: string): Promise<{ success: boolean; sha?: string; message: string }> {
  try {
    const fileData = await getFileBlob(filePath);
    if (!fileData) return { success: false, message: ` Could not find that file: ${filePath}` };

    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`,
      {
        method: "PUT",
        headers: {
          "Authorization": `token ${GITHUB_TOKEN}`,
          "Accept": "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: commitMessage, content: btoa(newContent), sha: fileData.sha }),
      }
    );

    if (response.ok) {
      const result: any = await response.json();
      return { success: true, sha: result.commit.sha.substring(0, 7), message: ` Successfully updated!` };
    }
    return { success: false, message: ` Could not update file (${response.status})` };
  } catch (error) {
    return { success: false, message: ` Error: ${error}` };
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
    const filePathMatch = block.match(/FILE_PATH:\s*([^\n]+)/);
    const commitMatch = block.match(/COMMIT_MESSAGE:\s*([^\n]+)/);
    const contentMatch = block.match(/FILE_CONTENT:\s*```[\w]*\n([\s\S]*?)\n```/);

    if (filePathMatch && commitMatch && contentMatch) {
      updates.push({
        filePath: filePathMatch[1].trim(),
        commitMessage: commitMatch[1].trim(),
        content: contentMatch[1],
      });
    }
  }
  return updates;
}

async function executeFileUpdates(updates: FileUpdate[]): Promise<string[]> {
  const results: string[] = [];
  for (const update of updates) {
    const result = await updateFileOnGithub(update.filePath, update.content, update.commitMessage);
    if (result.success) {
      results.push(` Updated: ${update.filePath}`);
    } else {
      results.push(` Failed to update: ${update.filePath}`);
    }
  }
  return results;
}

async function callClaudeAsAgent(userRequest: string, fileContext?: string): Promise<{ response: string; updates: FileUpdate[] }> {
  if (!CLAUDE_API_KEY) {
    return { response: " I'm not properly configured. Please contact your administrator.", updates: [] };
  }

  await loadProjectContext();

  try {
    const systemPrompt = `You are an assistant helping non-technical operators manage a software project.

IMPORTANT: Keep responses SIMPLE and user-friendly. Avoid technical jargon.

When you need to make code changes, format them like this:

===FILE_UPDATE_START===
FILE_PATH: path/to/file
COMMIT_MESSAGE: What you changed (in plain English)
FILE_CONTENT:
\`\`\`
[Complete file content with your changes]
\`\`\`
===FILE_UPDATE_END===

Guidelines:
- Use plain English explanations
- Explain WHAT changed and WHY in simple terms
- Avoid technical jargon when possible
- Give clear before/after summaries
- Be encouraging and helpful

${fileContext ? `\nFile information:\n${fileContext}` : ""}
${projectContext ? `\nProject information:\n${projectContext.substring(0, 3000)}` : ""}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-1-20250805",
        max_tokens: 3000,
        system: systemPrompt,
        messages: [{ role: "user", content: userRequest }],
      }),
    });

    if (!response.ok) {
      return { response: " Something went wrong. Please try again.", updates: [] };
    }

    const result: any = await response.json();
    const text = result.content[0]?.text || "No response";
    const updates = parseFileUpdates(text);
    
    return { response: text, updates };
  } catch (error) {
    return { response: " Something went wrong. Please try again.", updates: [] };
  }
}

async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  const chunks = text.length > 4096 ? [text.substring(0, 4096), text.substring(4096)] : [text];
  for (const chunk of chunks) {
    try {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: "Markdown" }),
      });
    } catch (error) {
      console.error("[] Failed to send message:", error);
    }
  }
}

async function processRequest(chatId: number, userMessage: string): Promise<void> {
  try {
    let fileContext = "";
    const fileMatch = userMessage.match(/(?:what is|show me|read|look at|check)?\s+(?:the\s+)?(?:file|code)\s+(?:called\s+|named\s+)?["`]?([^\s"`]+)["`]?/i);
    if (fileMatch) {
      const filePath = fileMatch[1];
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
      await sendTelegramMessage(chatId, ` Applying changes...`);
      const results = await executeFileUpdates(updates);
      const resultMessage = ` Done! Here's what changed:\n\n${results.join("\n")}`;
      await sendTelegramMessage(chatId, resultMessage);
    } else if (!textBefore) {
      await sendTelegramMessage(chatId, response);
    }
  } catch (error) {
    await sendTelegramMessage(chatId, ` Something went wrong. Please try again.`);
  }
}

async function handleMessage(chatId: number, text: string): Promise<void> {
  console.log(`[] Message: "${text.substring(0, 80)}"`);

  // Help command
  if (text.toLowerCase().includes("help") || text.toLowerCase() === "?") {
    const help = `Hi! I'm here to help manage your project. Here's what you can do:

 **Ask me to explain things:**
"Explain the scour worker"
"What is this feature for?"
"Tell me about the authentication system"

 **Ask me to check or read files:**
"Show me the handler file"
"Read the CLAUDE.md file"
"What's in the config file?"

 **Ask me to fix things:**
"Fix this error: ..."
"There's a bug in the alerts feature"
"Update the settings to..."

 **Ask me to update things:**
"Add a new feature that..."
"Change the alert timeout"
"Remove the old authentication code"

Just type naturally - no special commands needed! I'll understand what you're asking.`;
    await sendTelegramMessage(chatId, help);
  }
  // Status command
  else if (text.toLowerCase().includes("status") || text.toLowerCase() === "/status") {
    await sendTelegramMessage(chatId, ` I'm here and ready to help!\n\nJust tell me what you need and I'll take care of it.`);
  }
  // Everything else goes to Claude
  else {
    await processRequest(chatId, text);
  }
}

async function handleWebhook(request: Request): Promise<Response> {
  try {
    const update: any = await request.json();
    if (update.message?.chat && update.message?.text) {
      handleMessage(update.message.chat.id, update.message.text).catch(e => console.error("[]", e));
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Error" }), { status: 500 });
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === "POST") return await handleWebhook(request);
  if (request.method === "GET") {
    return new Response(JSON.stringify({
      status: " I'm here to help!",
      message: "Just send me a message in Telegram",
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  return new Response("OK", { status: 200 });
});
