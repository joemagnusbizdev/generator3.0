const TELEGRAM_TOKEN = "8707153044:AAFQEQvq_3QmABdrQSQUHC7osDawsOVtUJc";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN") || "";
const SUPABASE_PROJECT_ID = Deno.env.get("SUPABASE_PROJECT_ID") || "";
const SUPABASE_SERVICE_ROLE_SECRET = Deno.env.get("SUPABASE_SERVICE_ROLE_SECRET") || "";
const VERCEL_TOKEN = Deno.env.get("VERCEL_TOKEN") || "";
const VERCEL_PROJECT_ID = Deno.env.get("VERCEL_PROJECT_ID") || "";
const GITHUB_REPO = "joemagnusbizdev/generator3.0";
const GITHUB_BRANCH = "main";

console.log("=== BOT STARTUP ===");
console.log("Telegram token present:", !!TELEGRAM_TOKEN);
console.log("Anthropic API key present:", !!ANTHROPIC_API_KEY);
console.log("Loading project knowledge base...");

const conversations = new Map();
let projectContext = "";

async function getGitHubTree() {
  try {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/git/trees/${GITHUB_BRANCH}?recursive=1`;
    const res = await fetch(url, {
      headers: {
        "Authorization": `token ${GITHUB_TOKEN}`,
        "Accept": "application/vnd.github.v3+json",
      },
    });
    
    if (!res.ok) {
      console.error("Failed to fetch tree:", res.status);
      return [];
    }
    
    const data = await res.json();
    return data.tree || [];
  } catch (err) {
    console.error("Error fetching tree:", err.message);
    return [];
  }
}

async function loadSourceCode() {
  let code = "## Key Source Files:\n\n";
  
  const sourceFiles = [
    "src1/components/ScourManagementInline.tsx",
    "src1/lib/supabase/index.ts",
    "index.ts",
  ];

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
        const preview = content.length > 600 ? content.substring(0, 600) + "\n..." : content;
        code += `### ${filePath}\n\`\`\`typescript\n${preview}\n\`\`\`\n\n`;
      }
    } catch (err) {
      console.error(`Failed to load ${filePath}:`, err.message);
    }
  }
  
  return code;
}

async function loadSupabaseSchema() {
  let schema = "## Supabase Database Schema:\n\n";
  
  try {
    const url = `https://${SUPABASE_PROJECT_ID}.supabase.co/rest/v1/?apikey=${SUPABASE_SERVICE_ROLE_SECRET}`;
    const res = await fetch(url, {
      headers: {
        "apikey": SUPABASE_SERVICE_ROLE_SECRET,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_SECRET}`,
      },
    });

    if (res.ok) {
      const tables = await res.json();
      schema += `Available tables: ${tables.map(t => t.name).join(", ")}\n\n`;
      
      // Load schema for each table
      for (const table of tables.slice(0, 5)) {
        try {
          const schemaUrl = `https://${SUPABASE_PROJECT_ID}.supabase.co/rest/v1/${table.name}?limit=0`;
          const schemaRes = await fetch(schemaUrl, {
            headers: {
              "apikey": SUPABASE_SERVICE_ROLE_SECRET,
              "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_SECRET}`,
            },
          });
          
          if (schemaRes.ok) {
            const headers = schemaRes.headers;
            schema += `Table "${table.name}": `;
            schema += Array.from(headers.entries())
              .filter(([k]) => k === "content-range")
              .map(([k, v]) => `${v}`)
              .join("; ") || "schema loaded";
            schema += "\n";
          }
        } catch (err) {
          console.error(`Failed to load schema for ${table.name}:`, err.message);
        }
      }
    }
  } catch (err) {
    console.error("Error loading Supabase schema:", err.message);
    schema += "Unable to load schema\n";
  }
  
  return schema;
}

async function loadGitHistory() {
  let history = "## Recent Git History:\n\n";
  
  try {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/commits?per_page=10&sha=${GITHUB_BRANCH}`;
    const res = await fetch(url, {
      headers: {
        "Authorization": `token ${GITHUB_TOKEN}`,
        "Accept": "application/vnd.github.v3+json",
      },
    });

    if (res.ok) {
      const commits = await res.json();
      commits.slice(0, 8).forEach(commit => {
        history += `- ${commit.commit.message.split('\n')[0]} (${commit.sha.substring(0, 7)})\n`;
      });
    }
  } catch (err) {
    console.error("Error loading git history:", err.message);
    history += "Unable to load history\n";
  }
  
  return history;
}

async function loadProjectContext() {
  let context = "# PROJECT KNOWLEDGE BASE\n\n";
  
  // Load file tree
  console.log("Loading file tree...");
  const tree = await getGitHubTree();
  const excludePatterns = [
    "node_modules/",
    ".git/",
    ".next/",
    "dist/",
    "build/",
    ".env",
  ];
  const filteredTree = tree.filter(item => 
    !excludePatterns.some(pattern => item.path.startsWith(pattern)) &&
    item.type === "blob"
  );
  
  context += `## Project Files (${filteredTree.length} total):\n`;
  filteredTree.forEach(item => {
    context += `- ${item.path}\n`;
  });
  context += "\n";
  
  // Load source code
  console.log("Loading source code...");
  context += await loadSourceCode() + "\n";
  
  // Load database schema
  console.log("Loading Supabase schema...");
  context += await loadSupabaseSchema() + "\n";
  
  // Load git history
  console.log("Loading git history...");
  context += await loadGitHistory() + "\n";
  
  projectContext = context;
  console.log("Project knowledge base loaded:", projectContext.length, "characters");
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
  console.log("callClaude called");

  let conv = conversations.get(chatId) || { messages: [], lastTime: Date.now(), lastClaudeResponse: "" };
  conv.lastTime = Date.now();
  conv.messages.push({ role: "user", content: userMessage });
  conversations.set(chatId, conv);

  try {
    console.log("Calling Claude API with full project context...");
    const systemPrompt = `You are Claude AI in Telegram - an expert codebase assistant with full project knowledge.

CAPABILITIES:
- Understand the entire codebase structure and dependencies
- Suggest specific fixes to actual files
- Know the database schema and relationships
- Recommend changes based on recent project history

INSTRUCTIONS:
1. When fixing code, reference exact file paths that exist in the project
2. Provide complete code blocks for files being modified
3. Understand the database structure when suggesting queries
4. Be aware of recent changes to avoid conflicting updates
5. Wrap all code fixes in markdown blocks with language (e.g., \`\`\`typescript)
6. Be concise but thorough

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

    console.log("Claude response status:", res.status);

    if (!res.ok) {
      const error = await res.text();
      console.error("Claude API error:", res.status, error);
      return "API Error " + res.status;
    }

    const data = await res.json();

    if (!data.content || !data.content[0]) {
      console.error("Invalid Claude response:", data);
      return "Invalid response format";
    }
    const reply = data.content[0].text;
    conv.messages.push({ role: "assistant", content: reply });
    conv.lastClaudeResponse = reply;
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

async function deployToSupabase() {
  try {
    if (!SUPABASE_PROJECT_ID || !SUPABASE_SERVICE_ROLE_SECRET) {
      return " Supabase not configured";
    }

    const url = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/clever-function`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "deploy" }),
    });

    if (!res.ok) {
      return ` Supabase deploy failed (${res.status})`;
    }
    return ` Supabase deployed successfully`;
  } catch (err) {
    return `Error: ${err.message}`;
  }
}

async function deployToVercel() {
  try {
    if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
      return " Vercel not configured";
    }

    const res = await fetch(
      `https://api.vercel.com/v13/projects/${VERCEL_PROJECT_ID}/deployments`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${VERCEL_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gitSource: {
            type: "github",
            ref: GITHUB_BRANCH,
            repo: "joemagnusbizdev/generator3.0",
          },
        }),
      }
    );

    if (!res.ok) {
      const error = await res.text();
      return ` Vercel deploy failed (${res.status})`;
    }
    const data = await res.json();
    return ` Vercel deployment triggered (${data.uid})`;
  } catch (err) {
    return `Error: ${err.message}`;
  }
}

console.log("Loading project knowledge base on startup...");
await loadProjectContext();

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
<question> - Ask Claude anything (Full codebase knowledge!)
/read <file> - Read from repo
/edit <file> <content> - Edit file
/apply <file> - Apply Claude's last code fix
/db <table> - Query Supabase table
/db-count <table> - Count table rows
/deploy supabase - Deploy to Supabase
/deploy vercel - Deploy to Vercel`;
      } else if (text.startsWith("/apply ")) {
        const filePath = text.substring(7).trim();
        const conv = conversations.get(chatId);
        
        if (!conv || !conv.lastClaudeResponse) {
          reply = " No Claude response to apply. Ask Claude a question first.";
        } else {
          const code = extractCodeBlock(conv.lastClaudeResponse);
          if (!code) {
            reply = " No code block found in Claude's response. Ask for code changes.";
          } else {
            reply = await writeFileToGitHub(filePath, code, `Apply Claude fix to ${filePath}`);
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
