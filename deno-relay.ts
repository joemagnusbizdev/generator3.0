const TELEGRAM_TOKEN = "8707153044:AAFQEQvq_3QmABdrQSQUHC7osDawsOVtUJc";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";

const conversations = new Map();

async function sendTelegramMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

async function callClaude(userMessage, chatId) {
  let conv = conversations.get(chatId) || { messages: [], lastTime: Date.now() };
  conv.lastTime = Date.now();
  conv.messages.push({ role: "user", content: userMessage });
  conversations.set(chatId, conv);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1500,
        system: "You are Claude on Telegram. Be helpful and concise.",
        messages: conv.messages,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error("Claude API error:", res.status, error);
      return "Sorry, Claude API error: " + res.status;
    }

    const data = await res.json();
    if (!data.content || !data.content[0]) {
      console.error("Invalid Claude response:", data);
      return "Sorry, invalid Claude response";
    }
    const reply = data.content[0].text;
    conv.messages.push({ role: "assistant", content: reply });
    conversations.set(chatId, conv);
    return reply;
  } catch (err) {
    console.error("Claude call error:", err);
    return "Sorry, error calling Claude: " + err.message;
  }
}

Deno.serve(async (req) => {
  if (req.method === "POST") {
    const body = await req.json();
    const msg = body.message;
    if (msg?.text) {
      const chatId = msg.chat.id;
      let reply = "Hello!";
      if (msg.text === "/help") {
        reply = "📚 Claude Bot - Ask me anything!";
      } else {
        reply = await callClaude(msg.text, chatId);
      }
      await sendTelegramMessage(chatId, reply);
    }
    return new Response(JSON.stringify({ ok: true }));
  }
  return new Response("ok");
});
