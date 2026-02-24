/// <reference lib="deno.unstable" />

/**
 * Telegram Claude Bot - Public webhook endpoint
 * This function accepts unauthenticated POST requests from Telegram
 */

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
const GITHUB_REPO = Deno.env.get("GITHUB_REPO") || "joemagnusbizdev/generator3.0";
const GITHUB_BRANCH = Deno.env.get("GITHUB_BRANCH") || "main";
const TELEGRAM_API_URL = "https://api.telegram.org/bot";
const GITHUB_API_URL = "https://api.github.com";

const systemPrompt = `# Lead Project Engineer & Autonomous Agent

You are the primary knowledge base and autonomous agent for the joemagnusbizdev/generator3.0 repository. Your role is to manage, develop, maintain, and architect this project with full autonomy.

## 1. Project Context & Indexing
- **Deep Scan**: Before answering architectural questions, analyze the repository structure, package.json, and core configuration files
- **File Awareness**: Maintain mental maps of file structure. When implementing features, identify ALL affected files first
- **Stack Intelligence**: Understand the complete tech stack, dependencies, and existing patterns

## 2. Operating Procedures (Read/Write)
- **Research First**: For bugs/features, use search tools to find relevant code before suggesting changes
- **Atomic Changes**: Changes must be modular - if modifying interfaces, update implementations immediately
- **Verification**: After changes, check for errors and logical inconsistencies. Suggest test commands

## 3. Team Collaboration & Handover
- **Self-Documentation**: Update README.md or CHANGELOG.md with all significant changes so team can follow progress
- **Branch Strategy**: Suggest feature branches (e.g., feature/xyz) rather than direct main commits
- **Natural Language Processing**: Interpret vague requests (e.g., "Make it faster") by analyzing current implementation and proposing technical solutions

## 4. Constraints & Safety
- **No Deletions**: Never delete large code blocks without explaining rationale and confirming
- **Security**: Never commit API keys/secrets to codebase. Check .gitignore for sensitive files
- **Testing**: Always include test verification steps

## 5. Available Commands (Telegram)
- \`/read [path]\` - Read file from GitHub (e.g., /read src1/index.ts)
- \`/edit [instruction]\` - Modify code based on instruction  
- \`/status\` - Get current project status and outstanding issues
- \`/help\` - Show available commands
- Or ask naturally: "fix the timeout issue", "add caching", etc.

## 6. Communication Style
- **Telegram-Friendly**: Keep responses short, direct, and scannable
- **Formatted**: Use \`code\`, *bold*, bullet points
- **Contextual**: Show diffs/previews before applying changes
- **Attribution**: Include commit messages with changes

*Current Repo: joemagnusbizdev/generator3.0 | Status: Production + Active Development*`;

interface TelegramMessage {
  message_id: number;
  chat: { id: number; type: string };
  from: { id: number; username?: string };
  text?: string;
  date: number;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

interface ConversationContext {
  chatId: number;
  messages: Array<{ role: string; content: string }>;
  lastUpdate: number;
}

const conversations = new Map<number, ConversationContext>();
const CONTEXT_TIMEOUT = 3600000; // 1 hour

async function sendTelegramMessage(
  chatId: number,
  text: string,
  replyToMessageId?: number
): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error("[❌ TELEGRAM] Bot token not configured");
    return false;
  }

  console.log(`[📤 TELEGRAM] Sending to chat ${chatId}: ${text.substring(0, 50)}...`);

  // Split long messages (Telegram limit is 4096)
  const maxLength = 4000;
  const messages = text.length > maxLength
    ? splitMessage(text, maxLength)
    : [text];

  for (const msg of messages) {
    try {
      const url = `${TELEGRAM_API_URL}${TELEGRAM_BOT_TOKEN}/sendMessage`;
      console.log(`[📤 TELEGRAM] POST to ${url.substring(0, 80)}...`);
      
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: msg,
          parse_mode: "Markdown",
          reply_to_message_id: replyToMessageId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[❌ TELEGRAM] Failed: ${response.status} - ${errorText}`);
        return false;
      }

      console.log(`[✅ TELEGRAM] Message sent successfully`);
      return true;
    } catch (error) {
      console.error(`[❌ TELEGRAM] Exception: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  return true;
}

function splitMessage(text: string, maxLength: number): string[] {
  const messages: string[] = [];
  let current = "";

  const lines = text.split("\n");
  for (const line of lines) {
    if ((current + line + "\n").length > maxLength) {
      if (current) messages.push(current.trim());
      current = line + "\n";
    } else {
      current += line + "\n";
    }
  }

  if (current) messages.push(current.trim());
  return messages;
}

// GitHub API helpers
async function getFileFromGitHub(filePath: string): Promise<string | null> {
  if (!GITHUB_TOKEN) return null;

  try {
    const url = `${GITHUB_API_URL}/repos/${GITHUB_REPO}/contents/${filePath}?ref=${GITHUB_BRANCH}`;
    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
        "Accept": "application/vnd.github.v3.raw",
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch ${filePath}:`, response.status);
      return null;
    }

    return await response.text();
  } catch (error) {
    console.error(`Error fetching file from GitHub:`, error);
    return null;
  }
}

async function updateFileOnGitHub(
  filePath: string,
  newContent: string,
  message: string
): Promise<boolean> {
  if (!GITHUB_TOKEN) {
    console.error("GitHub token not configured");
    return false;
  }

  try {
    // Get current file SHA for update
    const getUrl = `${GITHUB_API_URL}/repos/${GITHUB_REPO}/contents/${filePath}?ref=${GITHUB_BRANCH}`;
    const getResponse = await fetch(getUrl, {
      headers: {
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
        "Accept": "application/vnd.github.v3+json",
      },
    });

    let sha: string | null = null;
    if (getResponse.ok) {
      const data = await getResponse.json();
      sha = data.sha;
    }

    // Update or create file
    const updateUrl = `${GITHUB_API_URL}/repos/${GITHUB_REPO}/contents/${filePath}`;
    const body: Record<string, string> = {
      message: `${message} (via Telegram Claude Bot)`,
      content: btoa(newContent), // Base64 encode
      branch: GITHUB_BRANCH,
    };

    if (sha) {
      body.sha = sha; // For updates
    }

    const updateResponse = await fetch(updateUrl, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
        "Accept": "application/vnd.github.v3+json",
      },
      body: JSON.stringify(body),
    });

    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      console.error(`Failed to update file:`, error);
      return false;
    }

    console.log(`File updated: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`Error updating file on GitHub:`, error);
    return false;
  }
}

function getOrCreateConversation(chatId: number): ConversationContext {
  // Clean up old conversations
  for (const [id, ctx] of conversations.entries()) {
    if (Date.now() - ctx.lastUpdate > CONTEXT_TIMEOUT) {
      conversations.delete(id);
    }
  }

  if (!conversations.has(chatId)) {
    conversations.set(chatId, {
      chatId,
      messages: [], // Only store user/assistant messages, system stays separate
      lastUpdate: Date.now(),
    });
  }

  const ctx = conversations.get(chatId)!;
  ctx.lastUpdate = Date.now();
  return ctx;
}

async function callClaude(
  userMessage: string,
  conversation: ConversationContext
): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    return "❌ Claude API not configured";
  }

  conversation.messages.push({ role: "user", content: userMessage });

  try {
    // Build messages for API (system is passed separately)
    const messagesForApi = conversation.messages.map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    console.log("[Claude] Calling API with", messagesForApi.length, "messages");

    // Create abort controller with 25 second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

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
        messages: messagesForApi,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.text();
      console.error("Claude API error:", error);
      return `❌ Claude error ${response.status}: ${error.substring(0, 100)}`;
    }

    const data = await response.json();
    const assistantMessage =
      data.content[0]?.type === "text" ? data.content[0].text : "No response";

    conversation.messages.push({
      role: "assistant",
      content: assistantMessage,
    });

    return assistantMessage;
  } catch (error) {
    console.error("Error calling Claude:", error);
    return `⚠️ Error: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}

async function handleIncomingMessage(
  message: TelegramMessage
): Promise<string> {
  const chatId = message.chat.id;
  const userId = message.from.id;
  const userInput = message.text || "(no text message)";

  console.log(
    `[Telegram] Message from ${message.from.username || userId}: ${userInput}`
  );

  // Get or create conversation context
  const conversation = getOrCreateConversation(chatId);

  // Check for quick commands
  const lowerInput = userInput.toLowerCase();

  if (lowerInput === "/help") {
    console.log("[Telegram] Returning /help response");
    return `🤖 *Claude Telegram Bot* - Available Commands:

📝 *Code Operations:*
• \`/read [file path]\` - View a file
• \`/edit [instruction]\` - Modify code
• Ask in natural language to edit code

🚨 *System Status:*
• \`/status\` - Check scour job status
• \`/health\` - System health check

💬 *General:*
• Ask anything about the codebase
• Describe what you want to do
• Get code suggestions & help

_All requests processed by Claude AI_`;
  }

  if (lowerInput === "/status") {
    const ctx = getOrCreateConversation(chatId);
    return await callClaude("What is the current scour job status?", ctx);
  }

  if (lowerInput === "/health") {
    const ctx = getOrCreateConversation(chatId);
    return await callClaude(
      "Check the system health and give me a status report",
      ctx
    );
  }

  if (lowerInput.startsWith("/read ")) {
    const filePath = userInput.slice(6).trim();
    const fileContent = await getFileFromGitHub(filePath);
    if (!fileContent) {
      return `❌ Could not read file: ${filePath}`;
    }
    
    const lines = fileContent.split("\n").slice(0, 50); // First 50 lines
    const truncated = fileContent.split("\n").length > 50 ? "\n\n... (file truncated, showing first 50 lines)" : "";
    return `📄 **${filePath}**\n\n\`\`\`\n${lines.join("\n")}\n\`\`\`${truncated}`;
  }

  if (lowerInput.startsWith("/edit ")) {
    const instruction = userInput.slice(6).trim();
    const ctx = getOrCreateConversation(chatId);
    return await callClaude(`User wants to edit code: "${instruction}". Please help them with this edit request.`, ctx);
  }

  if (lowerInput.startsWith("/commit ")) {
    const args = userInput.slice(8).trim();
    const ctx = getOrCreateConversation(chatId);
    return await callClaude(`File edit request with commit message: ${args}`, ctx);
  }

  // Pass to Claude AI for processing
  const response = await callClaude(userInput, conversation);
  return response;
}

export default async (req: Request): Promise<Response> => {
  // Handle CORS - allow public access
  if (req.method === "OPTIONS") {
    return new Response("OK", {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  console.log(`\n[🔔 WEBHOOK] ${req.method} request received`);
  console.log(`[🔔 WEBHOOK] Telegram token exists: ${!!TELEGRAM_BOT_TOKEN}`);
  console.log(`[🔔 WEBHOOK] Claude API key exists: ${!!ANTHROPIC_API_KEY}`);
  console.log(`[🔔 WEBHOOK] GitHub token exists: ${!!GITHUB_TOKEN}`);

  if (req.method !== "POST") {
    return new Response("OK", { status: 200 });
  }

  try {
    const update: TelegramUpdate = await req.json();
    console.log(`[🔔 WEBHOOK] Parsed JSON successfully, has message: ${!!update.message}`);

    if (!update.message) {
      console.log("[🔔 WEBHOOK] No message in update, returning OK");
      return new Response("OK", { status: 200 });
    }

    const message = update.message;
    console.log(`[📨 MESSAGE] From user ${message.from.username || message.from.id}: "${message.text}"`);
    
    // Check credentials on first use
    if (!TELEGRAM_BOT_TOKEN) {
      console.error("[❌ CONFIG] TELEGRAM_BOT_TOKEN not set!");
      await sendTelegramMessage(message.chat.id, "❌ Bot token not configured");
      return new Response("OK", { status: 200 });
    }

    // Process message and generate response
    console.log(`[⚙️  PROCESSING] Starting message handler...`);
    const responseText = await handleIncomingMessage(message);
    console.log(`[✅ RESPONSE] Got response: ${responseText.substring(0, 80)}...`);

    // Send response back
    console.log(`[📤 SENDING] Sending response to chat ${message.chat.id}...`);
    await sendTelegramMessage(message.chat.id, responseText, message.message_id);
    console.log(`[✅ COMPLETE] Webhook handled successfully\n`);

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error(`[❌ ERROR] Webhook processing failed:`, error);
    console.error(`[❌ DETAILS] ${error instanceof Error ? error.message : String(error)}\n`);
    return new Response("OK", { status: 200 });
  }
};
