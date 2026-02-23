const TELEGRAM_TOKEN = "8707153044:AAFQEQvq_3QmABdrQSQUHC7osDawsOVtUJc";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";

// In-memory conversation storage
const conversations = new Map<number, { messages: unknown[]; lastUpdate: number }>();
const CONTEXT_TIMEOUT = 3600000; // 1 hour

async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  const messages = text.match(/[\s\S]{1,4000}/g) || [text];
  for (const msg of messages) {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: msg }),
    });
  }
}

async function callClaude(userMessage: string, chatId: number): Promise<string> {
  let conversation = conversations.get(chatId);
  if (!conversation || Date.now() - conversation.lastUpdate > CONTEXT_TIMEOUT) {
    conversation = { messages: [], lastUpdate: Date.now() };
    conversations.set(chatId, conversation);
  }
  conversation.lastUpdate = Date.now();

  (conversation.messages as unknown[]).push({ role: "user", content: userMessage });

  const systemPrompt = `You are Claude, a helpful coding assistant on Telegram.
Keep responses concise (under 1000 chars when possible).
Be direct and helpful.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1500,
        system: systemPrompt,
        messages: conversation.messages,
      }),
    });

    if (!response.ok) {
      console.error("Claude API error:", response.status);
      return "Sorry, there was an error calling Claude API.";
    }

    const data = (await response.json()) as { content: Array<{ type: string; text: string }> };
    const assistantMessage = data.content[0].text;
    (conversation.messages as unknown[]).push({ role: "assistant", content: assistantMessage });

    return assistantMessage;
  } catch (error) {
    console.error("Error calling Claude:", error);
    return "Sorry, there was an error. Please try again.";
  }
}

async function handleMessage(chatId: number, messageText: string): Promise<string> {
  if (!messageText) return "No message text";

  if (messageText === "/help") {
    return `📚 Claude Bot\n/help - Show help\n/clear - Clear chat\n\nOr chat naturally!`;
  }

  if (messageText === "/clear") {
    conversations.delete(chatId);
    return "Chat cleared!";
  }

  return await callClaude(messageText, chatId);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Only POST" }), { status: 405 });
  }

  try {
    const body = (await req.json()) as {
      message?: { from?: { id?: number }; chat?: { id?: number }; text?: string };
    };

    const message = body.message;
    if (!message) return new Response(JSON.stringify({ ok: true }), { status: 200 });

    const chatId = message.chat?.id;
    const text = message.text;

    if (!chatId || !text) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    console.log(`[${chatId}] ${text}`);

    const response = await handleMessage(chatId, text);
    await sendTelegramMessage(chatId, response);

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Failed" }), { status: 500 });
  }
});
