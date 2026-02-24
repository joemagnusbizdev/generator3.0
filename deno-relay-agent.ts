/**
 * Telegram Claude Agent Bot
 * Full code editing, file management, and GitHub integration
 * Acts like VS Code Copilot - can read, edit, commit, and troubleshoot
 */

const TELEGRAM_TOKEN = "8707153044:AAFQEQvq_3QmABdrQSQUHC7osDawsOVtUJc";
const CLAUDE_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ||
  Deno.env.get("CLAUDE_API_KEY");
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
const GITHUB_OWNER = "joemagnusbizdev";
const GITHUB_REPO = "generator3.0";

let projectContext = "";
let contextLastLoaded = 0;
const CONTEXT_CACHE_TIME = 3600000; // 1 hour

async function loadProjectContext(): Promise<void> {
  const now = Date.now();
  if (contextLastLoaded && now - contextLastLoaded < CONTEXT_CACHE_TIME) {
    console.log("[📚] Using cached project context");
    return;
  }

  try {
    console.log("[🔍] Loading project context from GitHub...");
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
      console.error(`[❌] Failed to load CLAUDE.md: ${response.status}`);
      return;
    }

    projectContext = await response.text();
    contextLastLoaded = now;
    console.log(
      `[✅] Loaded project context (${projectContext.length} chars)`
    );
  } catch (error) {
    console.error("[❌] Error loading context:", error);
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
      return `❌ Failed to read ${filePath}: ${response.status}`;
    }

    return await response.text();
  } catch (error) {
    return `❌ Error reading file: ${error}`;
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
    console.error("[❌] Error getting file blob:", error);
    return null;
  }
}

async function updateFileOnGithub(
  filePath: string,
  newContent: string,
  commitMessage: string
): Promise<string> {
  try {
    const fileData = await getFileBlob(filePath);
    if (!fileData) {
      return `❌ Cannot find or read ${filePath}`;
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
      return `❌ Failed to update ${filePath}: ${response.status} - ${error.substring(0, 100)}`;
    }

    const result: any = await response.json();
    return `✅ Updated ${filePath}\nCommit: ${result.commit.sha.substring(0, 7)}`;
  } catch (error) {
    return `❌ Error updating file: ${error}`;
  }
}

async function callClaudeAsAgent(
  userRequest: string,
  fileContext?: string
): Promise<string> {
  if (!CLAUDE_API_KEY) {
    return "❌ Claude API key not configured";
  }

  await loadProjectContext();

  try {
    console.log(`[🤖] Calling Claude Agent API...`);

    const systemPrompt = `You are an autonomous code agent with full access to the generator3.0 project via GitHub.

Your capabilities:
✅ Read files from the repo
✅ Understand the full codebase architecture
✅ Write code and fix issues
✅ Suggest improvements
✅ Debug errors
✅ Analyze git history
✅ Understand deployment and infrastructure

You can be asked to:
- Explain code sections
- Write new features
- Fix bugs and errors
- Refactor code
- Create new files
- Analyze issues
- Review code quality

When the user asks you to modify code, provide:
1. Clear explanation of what you're changing and why
2. The exact code to modify
3. Line numbers and context
4. Expected outcome

${fileContext ? `\nFile Context:\n${fileContext}` : ""}

${projectContext ? `\nProject Context:\n${projectContext}` : ""}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-1-20250805",
        max_tokens: 2000,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userRequest,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[❌] Claude API error (${response.status}): ${error.substring(0, 100)}`);
      return `❌ Claude API error: ${response.status}`;
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

async function processAgentRequest(
  chatId: number,
  userRequest: string
): Promise<void> {
  console.log(`[🤖] Processing agent request from ${chatId}`);

  try {
    // Extract file path if mentioned
    let fileContext = "";
    const fileMatch = userRequest.match(/(?:file|read|edit|fix|update):\s*`?([^\s`]+)`?/i);
    if (fileMatch) {
      const filePath = fileMatch[1];
      console.log(`[📖] Loading file context: ${filePath}`);
      fileContext = await readFileFromGithub(filePath);
      if (!fileContext.startsWith("❌")) {
        fileContext = `File: ${filePath}\n\`\`\`\n${fileContext}\n\`\`\``;
      }
    }

    // Get Claude's response
    const response = await callClaudeAsAgent(userRequest, fileContext);

    // Send response to Telegram
    await sendTelegramMessage(chatId, response);
  } catch (error) {
    console.error("[❌] Error in agent request:", error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    await sendTelegramMessage(
      chatId,
      `❌ Error processing request: ${errorMsg}`
    );
  }
}

async function handleMessage(
  chatId: number,
  text: string
): Promise<void> {
  console.log(`[📨] Message from ${chatId}: "${text.substring(0, 100)}"`);

  // Check for special commands
  if (text.toLowerCase().startsWith("/read:")) {
    const filePath = text.substring(6).trim();
    console.log(`[📖] Reading file: ${filePath}`);
    const content = await readFileFromGithub(filePath);
    await sendTelegramMessage(
      chatId,
      `📄 File: ${filePath}\n\`\`\`\n${content.substring(0, 3500)}\n\`\`\`` +
        (content.length > 3500 ? "\n... (truncated)" : "")
    );
  } else if (text.toLowerCase().startsWith("/status")) {
    const status = await fetch(
      "https://generator30.joemagnusbizdev.deno.net/status",
      { headers: {} }
    ).then((r) => r.json())
      .catch(() => ({ error: "Cannot reach status" }));
    await sendTelegramMessage(chatId, `🤖 Bot Status:\n\`\`\`json\n${JSON.stringify(status, null, 2)}\n\`\`\``);
  } else if (text.toLowerCase().startsWith("/help")) {
    const help = `🤖 **Telegram Claude Agent**

Commands:
• \`/read: path/to/file\` - Read a file from GitHub
• \`/status\` - Check bot status
• \`/help\` - Show this message

Or just ask me anything:
• "What does the scour-worker do?"
• "Fix the bug in file: src/component.ts"
• "Write a new function that..."
• "Explain the architecture of..."
• "What's wrong with this error?"

I can read, analyze, and help modify code!`;
    await sendTelegramMessage(chatId, help);
  } else {
    // Treat as agent request
    await processAgentRequest(chatId, text);
  }
}

async function handleWebhook(request: Request): Promise<Response> {
  console.log("[📡] Webhook received");
  try {
    const update: any = await request.json();

    if (update.message) {
      const { chat, text } = update.message;
      if (text && chat) {
        console.log(`[→] Processing message from chat ${chat.id}`);
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

      if (url.pathname === "/status" || url.pathname === "/diagnose") {
        return new Response(
          JSON.stringify({
            status: "✅ Telegram Claude Agent Active",
            version: "2.0 (Full Agent with Code Editing)",
            timestamp: new Date().toISOString(),
            config: {
              claudeKeyConfigured: !!CLAUDE_API_KEY,
              githubTokenConfigured: !!GITHUB_TOKEN,
              projectContextLoaded: projectContext.length > 0,
              projectContextSize: projectContext.length,
            },
            capabilities: [
              "Read files from GitHub",
              "Analyze code",
              "Explain architecture",
              "Write new code",
              "Fix bugs and errors",
              "Suggest improvements",
              "Understand project goals",
            ],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          status: "✅ Telegram Claude Agent Active",
          version: "2.0",
          endpoints: {
            "POST /": "Telegram webhook",
            "GET /": "Status",
            "GET /status": "Full diagnostics",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response("Method not allowed", { status: 405 });
  } catch (error) {
    console.error("[❌] Server error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
