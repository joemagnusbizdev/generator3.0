/**
 * Telegram Claude Agent Bot - v2.1
 * FULL autonomous code agent with direct GitHub commit access
 * Can read, write, analyze, fix, and commit code changes
 */

const TELEGRAM_TOKEN = "8707153044:AAFQEQvq_3QmABdrQSQUHC7osDawsOVtUJc";
const CLAUDE_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ||
  Deno.env.get("CLAUDE_API_KEY");
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
const GITHUB_OWNER = "joemagnusbizdev";
const GITHUB_REPO = "generator3.0";

let projectContext = "";
let contextLastLoaded = 0;
const CONTEXT_CACHE_TIME = 3600000;

async function loadProjectContext(): Promise<void> {
  const now = Date.now();
  if (contextLastLoaded && now - contextLastLoaded < CONTEXT_CACHE_TIME) {
    console.log("[] Using cached project context");
    return;
  }

  try {
    console.log("[] Loading project context from GitHub...");
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/CLAUDE.md`,
      {
        headers: {
          "Authorization": `token ${GITHUB_TOKEN}`,
          "Accept": "application/vnd.github.v3.raw",
        },
      }
    );

    if (!response.ok) {
      console.error(`[] Failed to load CLAUDE.md: ${response.status}`);
      return;
    }

    projectContext = await response.text();
    contextLastLoaded = now;
    console.log(
      `[] Loaded project context (${projectContext.length} chars)`
    );
  } catch (error) {
    console.error("[] Error loading context:", error);
  }
}

async function readFileFromGithub(filePath: string): Promise<string> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`,
      {
        headers: {
          "Authorization": `token ${GITHUB_TOKEN}`,
          "Accept": "application/vnd.github.v3.raw",
        },
      }
    );

    if (!response.ok) {
      return ` Failed to read ${filePath}: ${response.status}`;
    }

    return await response.text();
  } catch (error) {
    return ` Error reading file: ${error}`;
  }
}

async function getFileBlob(filePath: string): Promise<{ content: string; sha: string } | null> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`,
      {
        headers: {
          "Authorization": `token ${GITHUB_TOKEN}`,
          "Accept": "application/vnd.github.v3+json",
        },
      }
    );

    if (!response.ok) return null;

    const data: any = await response.json();
    if (data.type !== "file") return null;

    const content = atob(data.content);
    return { content, sha: data.sha };
  } catch (error) {
    console.error("[] Error getting file blob:", error);
    return null;
  }
}

async function updateFileOnGithub(
  filePath: string,
  newContent: string,
  commitMessage: string
): Promise<{ success: boolean; sha?: string; message: string }> {
  try {
    const fileData = await getFileBlob(filePath);
    if (!fileData) {
      return { success: false, message: ` Cannot find ${filePath}` };
    }

    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`,
      {
        method: "PUT",
        headers: {
          "Authorization": `token ${GITHUB_TOKEN}`,
          "Accept": "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: commitMessage,
          content: btoa(newContent),
          sha: fileData.sha,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        message: ` Failed to update ${filePath}: ${response.status}`,
      };
    }

    const result: any = await response.json();
    return {
      success: true,
      sha: result.commit.sha.substring(0, 7),
      message: ` Updated ${filePath}`,
    };
  } catch (error) {
    return {
      success: false,
      message: ` Error updating file: ${error}`,
    };
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
    console.log(`[] Applying update to ${update.filePath}`);
    const result = await updateFileOnGithub(update.filePath, update.content, update.commitMessage);

    if (result.success) {
      results.push(` ${update.filePath}\nCommit: ${result.sha}`);
    } else {
      results.push(` ${update.filePath}\n${result.message}`);
    }
  }

  return results;
}

async function callClaudeAsAgent(
  userRequest: string,
  fileContext?: string
): Promise<{ response: string; updates: FileUpdate[] }> {
  if (!CLAUDE_API_KEY) {
    return { response: " Claude API key not configured", updates: [] };
  }

  await loadProjectContext();

  try {
    console.log(`[] Calling Claude as Autonomous Agent...`);

    const systemPrompt = `You are an AUTONOMOUS CODE AGENT with DIRECT GITHUB WRITE ACCESS.

When you need to make code changes, format them like this:

===FILE_UPDATE_START===
FILE_PATH: src/path/to/file.ts
COMMIT_MESSAGE: Brief description of what you changed
FILE_CONTENT:
\`\`\`typescript
[COMPLETE file content with your changes applied]
\`\`\`
===FILE_UPDATE_END===

Important:
- Include COMPLETE file content (not just changes)
- You can include multiple FILE_UPDATE blocks
- Bot automatically commits these changes to GitHub
- Include your explanation OUTSIDE the blocks

Your capabilities:
 Read ANY file
 Understand architecture
 DIRECTLY WRITE and COMMIT code
 Fix bugs automatically
 Create new files
 Refactor code

${fileContext ? `\nFile Context:\n${fileContext}` : ""}
${projectContext ? `\nProject Context:\n${projectContext.substring(0, 5000)}` : ""}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-1-20250805",
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: "user", content: userRequest }],
      }),
    });

    if (!response.ok) {
      console.error(`[] Claude API error (${response.status})`);
      return { response: ` Claude API error: ${response.status}`, updates: [] };
    }

    const result: any = await response.json();
    const text = result.content[0]?.text || "No response from Claude";
    const updates = parseFileUpdates(text);
    
    console.log(`[] Claude response (${text.length} chars, ${updates.length} updates)`);
    return { response: text, updates };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { response: ` Error: ${errorMsg}`, updates: [] };
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
      console.log(`[] Message sent to ${chatId}`);
    } catch (error) {
      console.error("[] Failed to send message:", error);
    }
  }
}

async function processAgentRequest(chatId: number, userRequest: string): Promise<void> {
  try {
    let fileContext = "";
    const fileMatch = userRequest.match(/(?:file|read|edit|fix):\s*`?([^\s`]+)`?/i);
    if (fileMatch) {
      const filePath = fileMatch[1];
      fileContext = await readFileFromGithub(filePath);
      if (!fileContext.startsWith("")) {
        fileContext = `File: ${filePath}\n\`\`\`\n${fileContext.substring(0, 2000)}\n\`\`\``;
      }
    }

    const { response, updates } = await callClaudeAsAgent(userRequest, fileContext);
    const textBefore = response.split("===FILE_UPDATE_START===")[0].trim();

    if (textBefore) {
      await sendTelegramMessage(chatId, textBefore);
    }

    if (updates.length > 0) {
      console.log(`[] Executing ${updates.length} update(s)`);
      await sendTelegramMessage(chatId, ` Applying ${updates.length} change(s) to GitHub...`);
      const results = await executeFileUpdates(updates);
      await sendTelegramMessage(chatId, ` Changes Applied:\n\n${results.join("\n\n")}`);
    } else if (!textBefore) {
      await sendTelegramMessage(chatId, response);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await sendTelegramMessage(chatId, ` Error: ${errorMsg}`);
  }
}

async function handleMessage(chatId: number, text: string): Promise<void> {
  console.log(`[] Message: "${text.substring(0, 100)}"`);

  if (text.toLowerCase().startsWith("/read:")) {
    const filePath = text.substring(6).trim();
    const content = await readFileFromGithub(filePath);
    await sendTelegramMessage(chatId, ` ${filePath}\n\`\`\`\n${content.substring(0, 3000)}\n\`\`\``);
  } else if (text.toLowerCase().startsWith("/status")) {
    await sendTelegramMessage(chatId, ` **Agent v2.1 - Active & Ready**\n\n Can directly commit code to GitHub\n Full project access\n Autonomous code fixes`);
  } else if (text.toLowerCase().startsWith("/help")) {
    const help = ` **Autonomous Code Agent v2.1**

Commands:
\`/read: path/to/file\` - Read file
\`/status\` - Agent status
\`/help\` - Help

I can DIRECTLY FIX AND COMMIT CODE!

Ask me anything:
 "Fix the bug in file: src/handler.ts"
 "Refactor the authentication code"
 "What's wrong with this error?"
 "Add error handling to..."

I return solutions AND commit them!`;
    await sendTelegramMessage(chatId, help);
  } else {
    await processAgentRequest(chatId, text);
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
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === "POST") return await handleWebhook(request);

  if (request.method === "GET") {
    const url = new URL(request.url);
    if (url.pathname === "/status") {
      return new Response(JSON.stringify({
        status: " Active",
        version: "2.1 (Direct GitHub Commits)",
        capabilities: ["Read files", "Write code", "Commit changes", "Execute fixes"],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
  }
  return new Response("OK", { status: 200 });
});
