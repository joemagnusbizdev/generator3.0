/**
 * Telegram Claude Bot Relay - Deno Deploy
 * Provides public webhook endpoint for Telegram bot
 * Loads full project context from GitHub on first request
 */

const TELEGRAM_TOKEN = "8707153044:AAFQEQvq_3QmABdrQSQUHC7osDawsOVtUJc";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
const GITHUB_REPO = "joemagnusbizdev/generator3.0";
const GITHUB_BRANCH = "main";

// Cache for project context
let projectContextCache: string | null = null;
let contextLastFetch = 0;
const CONTEXT_CACHE_TTL = 3600000; // 1 hour

// Conversation contexts per chat
const conversations = new Map<number, { messages: any[]; lastUpdate: number }>();
const CONTEXT_TIMEOUT = 3600000; // 1 hour per conversation

async function loadProjectContext(): Promise<string> {
  const now = Date.now();
  
  // Return cached context if fresh
  if (projectContextCache && now - contextLastFetch < CONTEXT_CACHE_TTL) {
    return projectContextCache;
  }

  let context = "# PROJECT CONTEXT\n\n";

  try {
    // Load CLAUDE.md first
    if (GITHUB_TOKEN) {
      const claudeRes = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/contents/CLAUDE.md`,
        {
          headers: { "Authorization": `token ${GITHUB_TOKEN}` },
          signal: AbortSignal.timeout(5000),
        }
      ).catch(() => null);

      if (claudeRes?.ok) {
        const data: any = await claudeRes.json();
        const content = atob(data.content);
        context += content.substring(0, 3000); // First ~3kB
        context += "\n\n[... see CLAUDE.md in repo for full details]\n\n";
      }
    }

    // Load package.json to show dependencies
    if (GITHUB_TOKEN) {
      const pkgRes = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/contents/package.json`,
        {
          headers: { "Authorization": `token ${GITHUB_TOKEN}` },
          signal: AbortSignal.timeout(5000),
        }
      ).catch(() => null);

      if (pkgRes?.ok) {
        const data: any = await pkgRes.json();
        const content = atob(data.content);
        context += "## Key Dependencies\n";
        context += content.substring(0, 1000);
        context += "\n";
      }
    }

    // List main files in repo
    if (GITHUB_TOKEN) {
      const treeRes = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/git/trees/${GITHUB_BRANCH}?recursive=1`,
        {
          headers: { "Authorization": `token ${GITHUB_TOKEN}` },
          signal: AbortSignal.timeout(5000),
        }
      ).catch(() => null);

      if (treeRes?.ok) {
        const data: any = await treeRes.json();
        const files = data.tree || [];
        const sourceFiles = files.filter(
          (f: any) =>
            !["node_modules/", ".git/", "dist/"].some((e) =>
              f.path.startsWith(e)
            ) && f.type === "blob"
        );

        context += "\n## Repository Structure\n";
        context += `Total tracked files: ${sourceFiles.length}\n`;
        context += "Key source files:\n";

        // Group by directory
        const dirs = new Map<string, number>();
        sourceFiles.forEach((f: any) => {
          const dir = f.path.split("/")[0];
          dirs.set(dir, (dirs.get(dir) || 0) + 1);
        });

        Array.from(dirs.entries()).forEach(([dir, count]) => {
          context += `- ${dir}: ${count} files\n`;
        });
      }
    }
  } catch (error) {
    console.error("Failed to load project context:", error);
    context += "\n[⚠️ Project context loading failed, using fallback]\n";
  }

  projectContextCache = context;
  contextLastFetch = now;
  return context;
}

async function sendTelegramMessage(
  chatId: number,
  text: string,
  replyToMessageId?: number
): Promise<void> {
  const chunks = text.length > 4096
    ? [text.substring(0, 4096), text.substring(4096)]
    : [text];

  for (const chunk of chunks) {
    try {
      await fetch(
        `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: chunk,
            parse_mode: "Markdown",
            reply_to_message_id: replyToMessageId,
          }),
        }
      );
    } catch (error) {
      console.error("Failed to send Telegram message:", error);
    }
  }
}

async function callClaude(userMessage: string, chatId: number): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    return "❌ Claude API key not configured in Deno Deploy environment variables";
  }

  // Get or create conversation
  let conv = conversations.get(chatId);
  if (!conv || Date.now() - conv.lastUpdate > CONTEXT_TIMEOUT) {
    conv = { messages: [], lastUpdate: Date.now() };
    conversations.set(chatId, conv);
  } else {
    conv.lastUpdate = Date.now();
  }

  // Add user message
  conv.messages.push({ role: "user", content: userMessage });

  // Build system prompt with project context
  const projectContext = await loadProjectContext();
  const systemPrompt = `# Lead Project Engineer & Autonomous Agent

You are the primary autonomous agent and knowledge base for the generator3.0 project repository.

${projectContext}

## Your Role
- Read and write files directly from GitHub repository
- Analyze bugs and suggest fixes
- Understand the full codebase structure
- Keep responses short and Telegram-friendly
- Use markdown: \`code\`, *bold*, bullet points
- Always preview changes before applying them

## Available to you:
- GitHub repository access (read/write)
- Claude AI for analysis
- Project documentation and context loaded above
- Full conversation history with user

When users ask questions about the project, reference the context above. When they ask for code changes, show a preview first.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1500,
        system: systemPrompt,
        messages: conv.messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Claude API error:", error);
      return `❌ Claude error: ${error.substring(0, 100)}`;
    }

    const data: any = await response.json();
    const assistantMessage =
      data.content[0]?.type === "text"
        ? data.content[0].text
        : "No response from Claude";

    // Store assistant response
    conv.messages.push({ role: "assistant", content: assistantMessage });

    return assistantMessage;
  } catch (error) {
    console.error("Error calling Claude:", error);
    return `⚠️ Error: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}

async function handleMessage(chatId: number, text: string): Promise<string> {
  const lower = text.toLowerCase();

  // Quick commands
  if (lower === "/help") {
    return `🤖 *Claude Project Bot*

📝 **Commands:**
• \`/read [path]\` - Read file from GitHub
• \`/status\` - Check project status
• \`/help\` - Show this message

💬 **Natural language:**
- Ask anything about the codebase
- Request code changes
- Get explanations of features
- Suggest improvements

_All requests processed by Claude AI_`;
  }

  if (lower.startsWith("/read ")) {
    const filePath = text.slice(6).trim();
    if (!GITHUB_TOKEN) {
      return "❌ GitHub token not configured";
    }

    try {
      const res = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`,
        {
          headers: { "Authorization": `token ${GITHUB_TOKEN}` },
          signal: AbortSignal.timeout(5000),
        }
      );

      if (!res.ok) {
        return `❌ File not found: ${filePath}`;
      }

      const data: any = await res.json();
      const content = atob(data.content);
      const lines = content.split("\n").slice(0, 50);
      const truncated =
        content.split("\n").length > 50
          ? "\n\n... (truncated, showing first 50 lines)"
          : "";

      return `\`\`\`\n${lines.join("\n")}\n\`\`\`${truncated}`;
    } catch (error) {
      return `❌ Error reading file: ${error instanceof Error ? error.message : "Unknown"}`;
    }
  }

  // Pass to Claude for everything else
  return await callClaude(text, chatId);
}

Deno.serve(async (req: Request) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response("OK", {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Telegram bot webhook ready", { status: 200 });
  }

  try {
    const update: any = await req.json();

    if (!update.message) {
      return new Response("OK", { status: 200 });
    }

    const message = update.message;
    const chatId = message.chat.id;
    const text = message.text || "(no text)";

    console.log(`[📨] Message from ${chatId}: ${text}`);

    // Handle message
    const response = await handleMessage(chatId, text);

    // Send response
    await sendTelegramMessage(chatId, response, message.message_id);

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("OK", { status: 200 });
  }
});
