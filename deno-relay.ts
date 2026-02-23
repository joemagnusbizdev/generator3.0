const TELEGRAM_TOKEN = "8707153044:AAFQEQvq_3QmABdrQSQUHC7osDawsOVtUJc";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN") || "";
const SUPABASE_PROJECT_ID = Deno.env.get("SUPABASE_PROJECT_ID") || "";
const SUPABASE_SERVICE_ROLE_SECRET = Deno.env.get("SUPABASE_SERVICE_ROLE_SECRET") || "";
const VERCEL_TOKEN = Deno.env.get("VERCEL_TOKEN") || "";
const VERCEL_PROJECT_ID = Deno.env.get("VERCEL_PROJECT_ID") || "";
const GITHUB_REPO = "joemagnusbizdev/generator3.0";
const GITHUB_BRANCH = "main";

console.log("=== DENO BOT STARTUP ===");
console.log("Token present:", !!TELEGRAM_TOKEN);
console.log("API key present:", !!ANTHROPIC_API_KEY);
console.log("GitHub token present:", !!GITHUB_TOKEN);

const conversations = new Map();
let projectContext = "# PROJECT CONTEXT (Loading...)\n\nBooting up knowledge base from GitHub and Supabase...";

async function loadProjectContext() {
  try {
    console.log("Starting project context load...");
    let context = "# PROJECT KNOWLEDGE BASE\n\n";
    
    // Load file tree
    console.log("Fetching GitHub tree...");
    const treeUrl = `https://api.github.com/repos/${GITHUB_REPO}/git/trees/${GITHUB_BRANCH}?recursive=1`;
    const treeRes = await fetch(treeUrl, {
      headers: {
        "Authorization": `token ${GITHUB_TOKEN}`,
        "Accept": "application/vnd.github.v3+json",
      },
    });
    
    if (treeRes.ok) {
      const treeData = await treeRes.json();
      const tree = treeData.tree || [];
      const excludePatterns = ["node_modules/", ".git/", ".next/", "dist/", "build/"];
      const filteredTree = tree.filter(item => 
        !excludePatterns.some(pattern => item.path.startsWith(pattern)) &&
        item.type === "blob"
      );
      
      context += `## Project Files (${filteredTree.length} total):\n`;
      filteredTree.forEach(item => {
        context += `- ${item.path}\n`;
      });
      context += "\n";
    }
    
    // Load key source code
    console.log("Loading source files...");
    const sourceFiles = [
      "src1/components/ScourManagementInline.tsx",
      "src1/lib/supabase/index.ts",
      "index.ts",
      "package.json",
    ];

    context += "## Key Source Code:\n\n";
    
    for (const filePath of sourceFiles) {
      try {
        const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}?ref=${GITHUB_BRANCH}`;
        const res = await fetch(url, {
          headers: {
            "Authorization": `token ${GITHUB_TOKEN}`,
            "Accept": "application/vnd.github.v3.raw",
          },
        });
        
        if (res.ok) {
          const content = await res.text();
          const preview = content.length > 500 ? content.substring(0, 500) + "\n..." : content;
          context += `### ${filePath}\n\`\`\`\n${preview}\n\`\`\`\n\n`;
          console.log(`Loaded ${filePath}`);
        } else {
          console.log(`Could not load ${filePath}: ${res.status}`);
        }
      } catch (err) {
        console.error(`Error loading ${filePath}:`, err.message);
      }
    }
    
    // Load git history
    console.log("Loading git history...");
    try {
      const commitUrl = `https://api.github.com/repos/${GITHUB_REPO}/commits?per_page=10&sha=${GITHUB_BRANCH}`;
      const commitRes = await fetch(commitUrl, {
        headers: {
          "Authorization": `token ${GITHUB_TOKEN}`,
          "Accept": "application/vnd.github.v3+json",
        },
      });

      if (commitRes.ok) {
        const commits = await commitRes.json();
        context += "## Recent Changes:\n";
        commits.slice(0, 8).forEach(commit => {
          context += `- ${commit.commit.message.split('\n')[0]} (${commit.sha.substring(0, 7)})\n`;
        });
        context += "\n";
      }
    } catch (err) {
      console.error("Error loading git history:", err.message);
    }
    
    projectContext = context;
    console.log(`Project context loaded: ${projectContext.length} characters`);
    return true;
  } catch (err) {
    console.error("CRITICAL: Failed to load project context:", err.message);
    projectContext = "# PROJECT CONTEXT FAILED TO LOAD - Using fallback";
    return false;
  }
}

async function sendTelegramMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  const chunks = text.length > 4096 ? [text.substring(0, 4096), text.substring(4096)] : [text];
  for (const chunk of chunks) {
    await fetch(url, {
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
  console.log("Claude called");

  let conv = conversations.get(chatId) || { messages: [], lastTime: Date.now(), lastClaudeResponse: "" };
  conv.lastTime = Date.now();
  conv.messages.push({ role: "user", content: userMessage });
  conversations.set(chatId, conv);

  try {
    const systemPrompt = `You are Claude AI on Telegram - expert codebase assistant with full project knowledge.

You have access to:
- Complete project file structure
- Source code files
- Git commit history
- Supabase database schema
- Project configuration

When helping:
1. Reference specific real files from the project
2. Suggest fixes with complete code blocks
3. Use exact file paths that exist
4. Wrap code in markdown blocks (e.g., \`\`\`typescript)

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
      const error = await res.text();
      console.error("Claude API error:", res.status);
      return "API Error " + res.status;
    }

    const data = await res.json();

    if (!data.content || !data.content[0]) {
      console.error("Invalid Claude response");
      return "Invalid response format";
    }
    const reply = data.content[0].text;
    conv.messages.push({ role: "assistant", content: reply });
    conv.lastClaudeResponse = reply;
    conversations.set(chatId, conv);
    return reply;
  } catch (err) {
    console.error("Claude error:", err.message);
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
      const error = await res.json();
      return `Error: ${error.message || res.status}`;
    }
    return ` Committed: ${message || filePath}`;
  } catch (err) {
    return `Error: ${err.message}`;
  }
}

async function querySupabase(table, limit = 5) {
  try {
    if (!SUPABASE_PROJECT_ID || !SUPABASE_SERVICE_ROLE_SECRET) {
      return " Supabase not configured";
    }

    const url = `https://${SUPABASE_PROJECT_ID}.supabase.co/rest/v1/${table}?limit=${limit}`;
    const res = await fetch(url, {
      headers: {
        "apikey": SUPABASE_SERVICE_ROLE_SECRET,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_SECRET}`,
      },
    });

    if (!res.ok) {
      return ` Error querying ${table}: ${res.status}`;
    }

    const data = await res.json();
    const jsonStr = JSON.stringify(data, null, 2);
    const preview = jsonStr.length > 1500 ? jsonStr.substring(0, 1500) + "\n..." : jsonStr;
    return ` Table "${table}" (first ${limit} rows):\n\n${preview}`;
  } catch (err) {
    return `Error: ${err.message}`;
  }
}

async function getSupabaseTableCount(table) {
  try {
    if (!SUPABASE_PROJECT_ID || !SUPABASE_SERVICE_ROLE_SECRET) {
      return " Supabase not configured";
    }

    const url = `https://${SUPABASE_PROJECT_ID}.supabase.co/rest/v1/${table}?count=exact&select=id`;
    const res = await fetch(url, {
      headers: {
        "apikey": SUPABASE_SERVICE_ROLE_SECRET,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_SECRET}`,
      },
    });

    if (!res.ok) {
      return ` Error querying ${table}: ${res.status}`;
    }

    const count = res.headers.get("content-range")?.split("/")[1] || "?";
    return ` Table "${table}": ${count} rows`;
  } catch (err) {
    return `Error: ${err.message}`;
  }
}

console.log("Loading project context before serving...");
await loadProjectContext();
console.log("Context loaded, starting server...");

Deno.serve(async (req) => {
  if (req.method === "POST") {
    const body = await req.json();
    const msg = body.message;
    if (msg?.text) {
      const chatId = msg.chat.id;
      const text = msg.text.trim();
      let reply = "Hello!";

      if (text === "/help") {
        reply = ` Claude Bot Commands:
/help - Show this help
<question> - Ask Claude (Full codebase knowledge!)
/read <file> - Read file from repo
/edit <file> <content> - Edit file  
/apply <file> - Apply Claude's last fix
/db <table> - Query Supabase
/db-count <table> - Count rows`;
      } else if (text.startsWith("/apply ")) {
        const filePath = text.substring(7).trim();
        const conv = conversations.get(chatId);
        
        if (!conv || !conv.lastClaudeResponse) {
          reply = " No Claude response. Ask first.";
        } else {
          const code = extractCodeBlock(conv.lastClaudeResponse);
          if (!code) {
            reply = " No code block found.";
          } else {
            reply = await writeFileToGitHub(filePath, code, `Apply fix to ${filePath}`);
          }
        }
      } else if (text.startsWith("/db-count ")) {
        const table = text.substring(10).trim();
        reply = await getSupabaseTableCount(table);
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
        if (content) {
          reply = await writeFileToGitHub(filePath, content, `Update ${filePath}`);
        } else {
          reply = "Error: /edit <file> <content>";
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
