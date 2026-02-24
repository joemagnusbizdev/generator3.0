/**
 * Telegram Claude Bot Relay - Deno Deploy
 * Routes messages to Supabase Edge Function (claude-code)
 */

const TELEGRAM_TOKEN = "8707153044:AAFQEQvq_3QmABdrQSQUHC7osDawsOVtUJc";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ||
  "https://gnobnyzezkuyptuakztf.supabase.co";
const SUPABASE_SERVICE_ROLE_SECRET = Deno.env.get("SUPABASE_SERVICE_ROLE_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const conversations = new Map<number, any[]>();
const CONTEXT_TIMEOUT = 3600000; // 1 hour

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

async function callClaudeAPI(
  userMessage: string,
  chatId: number
): Promise<string> {
  try {
    // Get conversation history
    let history = conversations.get(chatId) || [];
    const now = Date.now();

    // Check if conversation is stale
    const lastUpdate = (history as any).lastUpdate || 0;
    if (now - lastUpdate > CONTEXT_TIMEOUT) {
      history = [];
    }

    if (!SUPABASE_SERVICE_ROLE_SECRET) {
      return " Supabase credentials not configured";
    }

    console.log(`[] Calling Supabase Edge Function claude-code`);

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/claude-code`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_SECRET}`,
        },
        body: JSON.stringify({
          userMessage,
          conversationHistory: history,
        }),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(
        `Supabase function error (${response.status}):`,
        error.substring(0, 200)
      );

      if (response.status === 503 || response.status === 502) {
        return " Claude is temporarily busy, try again in a moment";
      }
      return ` Error: ${error.substring(0, 100)}`;
    }

    const result: any = await response.json();

    if (!result.success) {
      return result.error || " Claude processing failed";
    }

    console.log(`[] Response received from Claude`);

    // Update conversation history
    history.push({ role: "user", content: userMessage });
    history.push({ role: "assistant", content: result.response });
    (history as any).lastUpdate = now;

    // Keep only last 10 messages
    if (history.length > 20) {
      history = history.slice(-20);
    }

    conversations.set(chatId, history);

    return result.response;
  } catch (error) {
    console.error("Claude API call error:", error);
    return ` Connection error: ${error instanceof Error ? error.message : "Unknown"}`;
  }
}

async function handleMessage(
  chatId: number,
  messageText: string,
  messageId: number
): Promise<void> {
  console.log(`[] Message from chat ${chatId}: ${messageText}`);

  // Handle commands
  if (messageText.startsWith("/help")) {
    const helpText = ` **Claude Code Bot**

I have full access to your generator3.0 project with GitHub integration.

**Commands:**
 \`/help\` - Show this message
 \`/read filename\` - Read a file from the repo (e.g., \`/read CLAUDE.md\`)
 \`/status\` - Check project status

**How to use:**
Just ask me anything about the project! I can:
 Explain architecture and code
 Suggest improvements
 Read any file from GitHub
 Understand the tech stack

**Example queries:**
 "What's the tech stack?"
 "How does the scour worker work?"
 "Show me the Scour table schema"
 "/read src1/components/ScourWidget.tsx"`;

    await sendTelegramMessage(chatId, helpText, messageId);
    return;
  }

  if (messageText.startsWith("/read ")) {
    const filePath = messageText.substring(6).trim();
    const response = await callClaudeAPI(
      `Read and explain this file: ${filePath}`,
      chatId
    );
    await sendTelegramMessage(chatId, response, messageId);
    return;
  }

  if (messageText.startsWith("/status")) {
    const response = await callClaudeAPI(
      "Give a brief status of the generator3.0 project - what's completed, what's in progress, and what's next?",
      chatId
    );
    await sendTelegramMessage(chatId, response, messageId);
    return;
  }

  // Regular message - send to Claude
  const response = await callClaudeAPI(messageText, chatId);
  await sendTelegramMessage(chatId, response, messageId);
}

async function handleWebhook(request: Request): Promise<Response> {
  try {
    const update: any = await request.json();
    console.log("[] Telegram update:", JSON.stringify(update).substring(
      0,
      200
    ));

    if (update.message) {
      const { chat, text, message_id } = update.message;
      if (text && chat) {
        // Don't wait for message handling - process in background`r`n
        handleMessage(chat.id, text, message_id).catch((err) => {`r`n
          console.error("[] Error in handleMessage:", err);`r`n
        });
      }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    console.error("[] Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown" }),
      { status: 500 }
    );
  }
}

Deno.serve(async (request: Request) => {
  // POST: Telegram webhook
  if (request.method === "POST") {
    return handleWebhook(request);
  }

  // GET: Health check
  if (request.method === "GET") {
    return new Response(
      JSON.stringify({
        status: " Telegram Claude Bot Relay Active",
        version: "2.0 (Supabase Edge Function)",
        endpoint: "generator30.joemagnusbizdev.deno.net",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  return new Response("Method not allowed", { status: 405 });
});
