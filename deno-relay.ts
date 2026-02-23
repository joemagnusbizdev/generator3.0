const TELEGRAM_TOKEN = "8707153044:AAFQEQvq_3QmABdrQSQUHC7osDawsOVtUJc";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN") || "";
const SUPABASE_PROJECT_ID = Deno.env.get("SUPABASE_PROJECT_ID") || "";
const SUPABASE_API_KEY = Deno.env.get("SUPABASE_API_KEY") || "";
const VERCEL_TOKEN = Deno.env.get("VERCEL_TOKEN") || "";
const VERCEL_PROJECT_ID = Deno.env.get("VERCEL_PROJECT_ID") || "";
const GITHUB_REPO = "joemagnusbizdev/generator3.0";
const GITHUB_BRANCH = "main";

console.log("=== BOT STARTUP ===");
console.log("Telegram token present:", !!TELEGRAM_TOKEN);
console.log("Anthropic API key present:", !!ANTHROPIC_API_KEY);
console.log("GitHub token present:", !!GITHUB_TOKEN);
console.log("Supabase API key present:", !!SUPABASE_API_KEY);
console.log("Vercel token present:", !!VERCEL_TOKEN);
console.log("API key length:", ANTHROPIC_API_KEY.length);
console.log("API key starts with:", ANTHROPIC_API_KEY.substring(0, 10));

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
  console.log("callClaude called with:", userMessage);
  console.log("API Key present:", !!ANTHROPIC_API_KEY);
  
  let conv = conversations.get(chatId) || { messages: [], lastTime: Date.now() };
  conv.lastTime = Date.now();
  conv.messages.push({ role: "user", content: userMessage });
  conversations.set(chatId, conv);

  try {
    console.log("Calling Claude API...");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 1500,
        system: "You are Claude on Telegram. Be helpful and concise.",
        messages: conv.messages,
      }),
    });

    console.log("Claude response status:", res.status);
    
    if (!res.ok) {
      const error = await res.text();
      console.error("Claude API error:", res.status, error);
      return "API Error " + res.status + ": " + error.substring(0, 100);
    }

    const data = await res.json();
    console.log("Claude data:", JSON.stringify(data).substring(0, 200));
    
    if (!data.content || !data.content[0]) {
      console.error("Invalid Claude response:", data);
      return "Invalid response format";
    }
    const reply = data.content[0].text;
    conv.messages.push({ role: "assistant", content: reply });
    conversations.set(chatId, conv);
    return reply;
  } catch (err) {
    console.error("Claude call error:", err.message);
    return "Error: " + err.message;
  }
}

async function readFileFromGitHub(filePath) {
  try {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}?ref=${GITHUB_BRANCH}`;
    const res = await fetch(url, {
      headers: {
        "Authorization": `token ${GITHUB_TOKEN}`,
        "Accept": "application/vnd.github.v3.raw",
      },
    });
    if (!res.ok) return `Error reading ${filePath}: ${res.status}`;
    return await res.text();
  } catch (err) {
    return `Error: ${err.message}`;
  }
}

async function writeFileToGitHub(filePath, content, message) {
  try {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`;
    
    // Get current file SHA for update
    const getRes = await fetch(url + `?ref=${GITHUB_BRANCH}`, {
      headers: { "Authorization": `token ${GITHUB_TOKEN}` },
    });
    
    let sha = undefined;
    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
    }
    
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Authorization": `token ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: message || `Update ${filePath} via Telegram bot`,
        content: btoa(content),
        branch: GITHUB_BRANCH,
        sha: sha,
      }),
    });
    
    if (!res.ok) {
      const error = await res.json();
      return `Error: ${error.message || res.status}`;
    }
    return `✅ Committed: ${message || filePath}`;
  } catch (err) {
    return `Error: ${err.message}`;
  }
}

async function deployToSupabase() {
  try {
    if (!SUPABASE_PROJECT_ID || !SUPABASE_API_KEY) {
      return "❌ Supabase not configured (missing SUPABASE_PROJECT_ID or SUPABASE_API_KEY)";
    }
    
    const url = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/clever-function`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUPABASE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "deploy" }),
    });
    
    if (!res.ok) {
      return `❌ Supabase deploy failed (${res.status})`;
    }
    return `✅ Supabase deployed successfully`;
  } catch (err) {
    return `Error: ${err.message}`;
  }
}

async function deployToVercel() {
  try {
    if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
      return "❌ Vercel not configured (missing VERCEL_TOKEN or VERCEL_PROJECT_ID)";
    }
    
    const res = await fetch(
      `https://api.vercel.com/v13/deployments?project=${VERCEL_PROJECT_ID}`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${VERCEL_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: VERCEL_PROJECT_ID,
          gitSource: {
            ref: GITHUB_BRANCH,
            repoId: "joemagnusbizdev/generator3.0",
          },
        }),
      }
    );
    
    if (!res.ok) {
      const error = await res.text();
      return `❌ Vercel deploy failed (${res.status}): ${error.substring(0, 100)}`;
    }
    return `✅ Vercel deployment triggered`;
  } catch (err) {
    return `Error: ${err.message}`;
  }
}

Deno.serve(async (req) => {
  if (req.method === "POST") {
    const body = await req.json();
    const msg = body.message;
    if (msg?.text) {
      const chatId = msg.chat.id;
      const text = msg.text.trim();
      let reply = "Hello!";
      
      if (text === "/help") {
        reply = `📚 Claude Bot Commands:
/help - Show this help
<question> - Ask Claude anything
/read <file> - Read a file from repo
/edit <file> <content> - Write to file
/deploy supabase - Deploy to Supabase
/deploy vercel - Deploy to Vercel`;
      } else if (text.startsWith("/read ")) {
        const filePath = text.substring(6).trim();
        reply = await readFileFromGitHub(filePath);
      } else if (text.startsWith("/edit ")) {
        const parts = text.substring(6).split(" ");
        const filePath = parts[0];
        const content = text.substring(6 + filePath.length).trim();
        if (content) {
          reply = await writeFileToGitHub(filePath, content, `Updated ${filePath}`);
        } else {
          reply = "Error: /edit <file> <content>";
        }
      } else if (text.startsWith("/deploy ")) {
        const target = text.substring(8).trim().toLowerCase();
        if (target === "supabase") {
          reply = await deployToSupabase();
        } else if (target === "vercel") {
          reply = await deployToVercel();
        } else {
          reply = "Error: /deploy [supabase|vercel]";
        }
      } else {
        reply = await callClaude(text, chatId);
      }
      await sendTelegramMessage(chatId, reply);
    }
    return new Response(JSON.stringify({ ok: true }));
  }
  return new Response("ok");
});
