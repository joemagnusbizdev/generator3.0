const TELEGRAM_TOKEN = "8707153044:AAFQEQvq_3QmABdrQSQUHC7osDawsOVtUJc";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN") || "";
const SUPABASE_PROJECT_ID = Deno.env.get("SUPABASE_PROJECT_ID") || "";
const SUPABASE_SERVICE_ROLE_SECRET = Deno.env.get("SUPABASE_SERVICE_ROLE_SECRET") || "";
const GITHUB_REPO = "joemagnusbizdev/generator3.0";
const GITHUB_BRANCH = "main";

const conversations = new Map();
let cachedContext = "";

async function getProjectContext() {
  if (cachedContext) return cachedContext;
  
  try {
    console.log("Loading project context...");
    let context = "PROJECT KNOWLEDGE:\n\n";
    
    // Get file tree
    const treeRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/git/trees/${GITHUB_BRANCH}?recursive=1`,
      { headers: { "Authorization": `token ${GITHUB_TOKEN}` } }
    ).then(r => r.json()).catch(() => ({}));
    
    const tree = treeRes.tree || [];
    const files = tree.filter(f => !["node_modules/", ".git/", ".next/", "dist/"].some(e => f.path.startsWith(e)) && f.type === "blob");
    context += `Project has ${files.length} source files:\n`;
    context += files.map(f => `- ${f.path}`).join("\n") + "\n\n";
    
    // Get key source files
    const sources = ["src1/components/ScourManagementInline.tsx", "src1/lib/supabase/index.ts", "package.json"];
    context += "Key files:\n\n";
    
    for (const file of sources) {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/contents/${file}?ref=${GITHUB_BRANCH}`,
          { headers: { "Authorization": `token ${GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3.raw" } }
        );
        if (res.ok) {
          const content = await res.text();
          const preview = content.length > 300 ? content.substring(0, 300) + "..." : content;
          context += `FILE: ${file}\n${preview}\n\n`;
        }
      } catch (e) {}
    }
    
    cachedContext = context;
    console.log("Context loaded: " + context.length + " chars");
    return context;
  } catch (e) {
    console.error("Context error:", e.message);
    return "PROJECT KNOWLEDGE: Unable to load - use /read <file> command";
  }
}

async function sendTelegramMessage(chatId, text) {
  const chunks = text.length > 4096 ? [text.substring(0, 4096), text.substring(4096)] : [text];
  for (const chunk of chunks) {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: chunk }),
    });
  }
}

function extractCodeBlock(text) {
  const match = text.match(/\x60\x60\x60(?:\w+)?\n([\s\S]*?)\n\x60\x60\x60/);
  return match ? match[1] : null;
}

async function callClaude(userMessage, chatId) {
  let conv = conversations.get(chatId) || { messages: [], lastResponse: "" };
  conv.messages.push({ role: "user", content: userMessage });
  conversations.set(chatId, conv);

  try {
    const projectKnowledge = await getProjectContext();
    const systemPrompt = `You are Claude AI on Telegram. You are an expert code assistant with full project knowledge.

You can see:
- All project files and structure
- Complete source code
- Supabase database
- Git history

When a user asks about the project, reference specific files. When they ask for fixes, provide complete code blocks.

${projectKnowledge}

You can also use these commands:
/read <file> - to read any file from GitHub
/edit <file> <code> - to edit a file
/apply <file> - to apply your last suggested code fix
/db <table> - to query Supabase`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 2000,
        system: systemPrompt,
        messages: conv.messages,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error("Claude error:", res.status, error);
      return "Claude API error: " + res.status;
    }

    const data = await res.json();
    if (!data.content?.[0]) {
      console.error("Invalid response:", data);
      return "Invalid response from Claude";
    }
    
    const reply = data.content[0].text;
    conv.messages.push({ role: "assistant", content: reply });
    conv.lastResponse = reply;
    conversations.set(chatId, conv);
    return reply;
  } catch (err) {
    console.error("Error:", err.message);
    return "Error calling Claude: " + err.message;
  }
}

async function readFileFromGitHub(filePath) {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}?ref=${GITHUB_BRANCH}`,
      { headers: { "Authorization": `token ${GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3.raw" } }
    );
    if (!res.ok) return `Error reading file: ${res.status}`;
    return await res.text();
  } catch (err) {
    return "Error: " + err.message;
  }
}

async function writeFileToGitHub(filePath, content, message) {
  try {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`;
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
        message: message || `Update ${filePath}`,
        content: btoa(content),
        branch: GITHUB_BRANCH,
        sha: sha,
      }),
    });
    
    if (!res.ok) {
      return `Error: ${res.status}`;
    }
    return " File committed to GitHub";
  } catch (err) {
    return "Error: " + err.message;
  }
}

async function querySupabase(table) {
  try {
    const res = await fetch(
      `https://${SUPABASE_PROJECT_ID}.supabase.co/rest/v1/${table}?limit=5`,
      {
        headers: {
          "apikey": SUPABASE_SERVICE_ROLE_SECRET,
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_SECRET}`,
        },
      }
    );
    if (!res.ok) return `Error: ${res.status}`;
    const data = await res.json();
    return `Table "${table}":\n\n${JSON.stringify(data, null, 2).substring(0, 1000)}`;
  } catch (err) {
    return "Error: " + err.message;
  }
}

Deno.serve(async (req) => {
  if (req.method === "POST") {
    try {
      const body = await req.json();
      const msg = body.message;
      if (msg?.text) {
        const chatId = msg.chat.id;
        const text = msg.text.trim();
        let reply = "Unknown command";

        if (text === "/help") {
          reply = " Claude Bot - Commands:\n/help - This help\n<anything> - Ask Claude\n/read FILE - Read file\n/edit FILE CODE - Edit file\n/apply FILE - Apply last fix\n/db TABLE - Query Supabase\n/test - Test bot connection";
        } else if (text === "/test") {
          const ctx = await getProjectContext();
          reply = "Bot is working! Project context loaded:\n" + ctx.substring(0, 300) + "...";
        } else if (text.startsWith("/apply ")) {
          const filePath = text.substring(7).trim();
          const conv = conversations.get(chatId);
          const code = conv?.lastResponse ? extractCodeBlock(conv.lastResponse) : null;
          if (code) {
            reply = await writeFileToGitHub(filePath, code, `Apply fix to ${filePath}`);
          } else {
            reply = "No code fix found. Ask Claude for a code fix first.";
          }
        } else if (text.startsWith("/db ")) {
          const table = text.substring(4).trim();
          reply = await querySupabase(table);
        } else if (text.startsWith("/read ")) {
          const filePath = text.substring(6).trim();
          reply = await readFileFromGitHub(filePath);
        } else if (text.startsWith("/edit ")) {
          const parts = text.substring(6).split(" ");
          const filePath = parts[0];
          const content = text.substring(6 + filePath.length).trim();
          reply = content ? await writeFileToGitHub(filePath, content, `Manual edit: ${filePath}`) : "Usage: /edit <file> <content>";
        } else {
          reply = await callClaude(text, chatId);
        }
        
        await sendTelegramMessage(chatId, reply);
      }
    } catch (err) {
      console.error("Webhook error:", err.message);
    }
    return new Response(JSON.stringify({ ok: true }));
  }
  return new Response("ok");
});

console.log("Bot server started");
