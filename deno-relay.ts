const TELEGRAM_TOKEN = "8707153044:AAFQEQvq_3QmABdrQSQUHC7osDawsOVtUJc";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN") || "";
const SUPABASE_PROJECT_ID = Deno.env.get("SUPABASE_PROJECT_ID") || "";
const SUPABASE_SERVICE_ROLE_SECRET = Deno.env.get("SUPABASE_SERVICE_ROLE_SECRET") || "";
const GITHUB_REPO = "joemagnusbizdev/generator3.0";
const GITHUB_BRANCH = "main";

const conversations = new Map();

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
  const match = text.match(/```(?:\w+)?\n([\s\S]*?)\n```/);
  return match ? match[1] : null;
}

async function callClaude(userMessage, chatId) {
  let conv = conversations.get(chatId) || { messages: [], lastResponse: "" };
  conv.messages.push({ role: "user", content: userMessage });
  conversations.set(chatId, conv);

  try {
    // Build project context directly
    let projectInfo = "PROJECT CONTEXT:\n";
    projectInfo += "- Repo: joemagnusbizdev/generator3.0\n";
    projectInfo += "- Branch: main\n";
    projectInfo += "- Key files: src1/components/, src1/lib/, package.json\n";
    
    // Try to fetch actual GitHub data
    try {
      const treeRes = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/git/trees/${GITHUB_BRANCH}?recursive=1`,
        { headers: { "Authorization": `token ${GITHUB_TOKEN}` }, signal: AbortSignal.timeout(5000) }
      );
      if (treeRes.ok) {
        const tree = (await treeRes.json()).tree || [];
        const files = tree.filter(f => !["node_modules/", ".git/"].some(e => f.path.startsWith(e)) && f.type === "blob");
        projectInfo += `- Total files: ${files.length}\n`;
        projectInfo += "- File list:\n  " + files.slice(0, 20).map(f => f.path).join("\n  ");
      }
    } catch (e) {
      projectInfo += `- GitHub access error: ${e.message}\n`;
    }

    const systemPrompt = `You are Claude AI on Telegram with full project knowledge.

You understand:
- The complete project structure
- Source code
- Database schema

${projectInfo}

User commands:
- /help - Show commands
- /test - Test bot
- /read FILE - Read file
- /edit FILE CODE - Edit file
- /apply FILE - Apply last fix
- /db TABLE - Query database
- Any question - Ask Claude`;

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
      return "Claude error: " + res.status;
    }

    const data = await res.json();
    if (!data.content?.[0]) {
      return "Invalid response";
    }
    
    const reply = data.content[0].text;
    conv.messages.push({ role: "assistant", content: reply });
    conv.lastResponse = reply;
    conversations.set(chatId, conv);
    return reply;
  } catch (err) {
    return "Error: " + err.message;
  }
}

async function readFileFromGitHub(filePath) {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}?ref=${GITHUB_BRANCH}`,
      { headers: { "Authorization": `token ${GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3.raw" } }
    );
    if (!res.ok) return `Error: ${res.status}`;
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
    return res.ok ? " Committed" : "Error: " + res.status;
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
    return `${table}:\n${JSON.stringify(data, null, 2).substring(0, 800)}`;
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
        let reply = "Unknown";

        if (text === "/help") {
          reply = "Bot commands:\n/help - This\n/test - Test bot\n/read FILE\n/edit FILE CODE\n/apply FILE\n/db TABLE\nOr ask Claude anything";
        } else if (text === "/test") {
          reply = " Bot working! I can access:\n- GitHub repo: joemagnusbizdev/generator3.0\n- Telegram API\n- Claude AI\n- Supabase\n\nAsk me anything about your project!";
        } else if (text.startsWith("/apply ")) {
          const filePath = text.substring(7).trim();
          const conv = conversations.get(chatId);
          const code = conv?.lastResponse ? extractCodeBlock(conv.lastResponse) : null;
          reply = code ? await writeFileToGitHub(filePath, code, `Apply fix`) : "No code fix found";
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
          reply = content ? await writeFileToGitHub(filePath, content, `Update`) : "Usage: /edit <file> <content>";
        } else {
          reply = await callClaude(text, chatId);
        }
        await sendTelegramMessage(chatId, reply);
      }
    } catch (err) {
      console.error("Error:", err.message);
    }
    return new Response(JSON.stringify({ ok: true }));
  }
  return new Response("ok");
});
