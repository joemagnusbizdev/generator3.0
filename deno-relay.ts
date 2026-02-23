const TELEGRAM_TOKEN = "8707153044:AAFQEQvq_3QmABdrQSQUHC7osDawsOVtUJc";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN") || "";
const SUPABASE_PROJECT_ID = Deno.env.get("SUPABASE_PROJECT_ID") || "";
const SUPABASE_SERVICE_ROLE_SECRET = Deno.env.get("SUPABASE_SERVICE_ROLE_SECRET") || "";
const GITHUB_REPO = "joemagnusbizdev/generator3.0";
const GITHUB_BRANCH = "main";

const conversations = new Map();
let projectContext = "";
let contextLoaded = false;

async function buildProjectContext() {
  try {
    console.log("Building project context...");
    let context = "# PROJECT KNOWLEDGE BASE\n\n";
    
    // Quick file tree
    console.log("Fetching GitHub files...");
    const treeRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/git/trees/${GITHUB_BRANCH}?recursive=1`,
      { headers: { "Authorization": `token ${GITHUB_TOKEN}` } }
    );
    
    if (treeRes.ok) {
      const tree = (await treeRes.json()).tree || [];
      const exclude = ["node_modules/", ".git/", ".next/", "dist/"];
      const files = tree.filter(f => !exclude.some(e => f.path.startsWith(e)) && f.type === "blob");
      context += `## All Project Files (${files.length} files):\n`;
      files.forEach(f => context += `- ${f.path}\n`);
      context += "\n";
    }
    
    // Load 3 key files
    const sourceFiles = [
      "src1/components/ScourManagementInline.tsx",
      "src1/lib/supabase/index.ts",
      "package.json",
    ];

    context += "## Key Source Files:\n\n";
    for (const file of sourceFiles) {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/contents/${file}?ref=${GITHUB_BRANCH}`,
          { headers: { "Authorization": `token ${GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3.raw" } }
        );
        if (res.ok) {
          const content = await res.text();
          const preview = content.length > 400 ? content.substring(0, 400) + "\n..." : content;
          context += `### ${file}\n\`\`\`\n${preview}\n\`\`\`\n\n`;
        }
      } catch (e) {
        console.error(`Failed to load ${file}:`, e.message);
      }
    }
    
    projectContext = context;
    contextLoaded = true;
    console.log(`Context ready (${context.length} chars)`);
  } catch (e) {
    console.error("Context build error:", e.message);
    projectContext = "# Project context (reduced mode)\nYou have access to the codebase via /read command";
    contextLoaded = true;
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
  const match = text.match(/```(?:\w+)?\n([\s\S]*?)\n```/);
  return match ? match[1] : null;
}

async function callClaude(userMessage, chatId) {
  // Ensure context is loaded
  if (!contextLoaded) {
    await buildProjectContext();
  }

  let conv = conversations.get(chatId) || { messages: [], lastClaudeResponse: "" };
  conv.messages.push({ role: "user", content: userMessage });
  conversations.set(chatId, conv);

  try {
    const systemPrompt = `You are Claude AI on Telegram - expert codebase assistant.

You have full access to:
- Complete project file structure
- Source code files
- Supabase database

When helping:
1. Reference real files from the project
2. Suggest specific fixes with code blocks
3. Use exact file paths
4. Wrap code in markdown blocks

${projectContext}`;

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
      return "Claude API error: " + res.status;
    }

    const data = await res.json();
    const reply = data.content?.[0]?.text || "No response";
    conv.messages.push({ role: "assistant", content: reply });
    conv.lastClaudeResponse = reply;
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
    return res.ok ? await res.text() : `Error: ${res.status}`;
  } catch (err) {
    return `Error: ${err.message}`;
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

    return res.ok ? ` Committed` : `Error: ${res.status}`;
  } catch (err) {
    return `Error: ${err.message}`;
  }
}

async function querySupabase(table, limit = 5) {
  try {
    const res = await fetch(
      `https://${SUPABASE_PROJECT_ID}.supabase.co/rest/v1/${table}?limit=${limit}`,
      {
        headers: {
          "apikey": SUPABASE_SERVICE_ROLE_SECRET,
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_SECRET}`,
        },
      }
    );
    if (!res.ok) return `Error: ${res.status}`;
    const data = await res.json();
    const preview = JSON.stringify(data, null, 2).substring(0, 1500);
    return ` ${table}:\n\n${preview}`;
  } catch (err) {
    return `Error: ${err.message}`;
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
        let reply = "Hello!";

        if (text === "/help") {
          reply = ` Commands:
/help - Show this
<question> - Ask Claude (knows your code!)
/read <file> - Read file
/edit <file> <content> - Edit file
/apply <file> - Apply last fix
/db <table> - Query Supabase`;
        } else if (text.startsWith("/apply ")) {
          const filePath = text.substring(7).trim();
          const conv = conversations.get(chatId);
          const code = conv?.lastClaudeResponse ? extractCodeBlock(conv.lastClaudeResponse) : null;
          reply = code ? await writeFileToGitHub(filePath, code, `Apply fix`) : "No fix found";
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

console.log("Bot started");
