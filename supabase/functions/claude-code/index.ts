/**
 * Claude Code Edge Function - OPTIMIZED FOR SPEED
 * Supabase function with smart context loading
 * <15 second response guarantee for simple questions
 */

import Anthropic from "npm:@anthropic-ai/sdk@^0.16.0";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
const GITHUB_REPO = "joemagnusbizdev/generator3.0";
const GITHUB_BRANCH = "main";

// Cache project context
let projectContextCache: string | null = null;
let contextLastFetch = 0;
const CONTEXT_CACHE_TTL = 3600000; // 1 hour
const REQUEST_TIMEOUT_BUFFER = 25000; // 25 second hard limit (5s buffer for Telegram)

function shouldUseFullContext(message: string): boolean {
  const lowerMsg = message.toLowerCase();
  
  // Simple questions that don't need full context
  const simplePatterns = [
    /^what is|^what's|^hello|^hi|^test|^help/,
    /^define|^explain.*tech|^tech stack/,
  ];
  
  // Complex questions that DO need full context
  const complexPatterns = [
    /scour|worker|issue|bug|error|fix|problem|not.*working|timestamp|completion/,
    /read.*file|analyze|review|code|function|implementation/,
  ];
  
  // If it matches complex patterns, use full context
  if (complexPatterns.some(p => p.test(lowerMsg))) {
    return true;
  }
  
  // If it matches simple patterns, skip context
  if (simplePatterns.some(p => p.test(lowerMsg))) {
    return false;
  }
  
  // Default: use full context for safety
  return true;
}

async function loadProjectContext(minimal: boolean = false): Promise<string> {
  const now = Date.now();
  
  // Minimal context: just return cached or basic info (instant)
  if (minimal) {
    return `# Generator3.0 Project
- React + Vite + TypeScript frontend
- Supabase backend + Edge Functions
- Deno Deploy for webhooks
- Telegram bot integration
- Scour worker for web scraping & alerts
- Early signals threat detection
- AI extraction with Claude API`;
  }

  if (projectContextCache && now - contextLastFetch < CONTEXT_CACHE_TTL) {
    return projectContextCache;
  }

  let context = "# PROJECT CONTEXT\n\n";

  try {
    // Parallelize all GitHub API calls for speed
    const promises = [];

    // CLAUDE.md
    if (GITHUB_TOKEN) {
      promises.push(
        fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/contents/CLAUDE.md`,
          {
            headers: { "Authorization": `token ${GITHUB_TOKEN}` },
            signal: AbortSignal.timeout(3000),
          }
        )
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      );
    } else {
      promises.push(Promise.resolve(null));
    }

    // package.json
    if (GITHUB_TOKEN) {
      promises.push(
        fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/contents/package.json`,
          {
            headers: { "Authorization": `token ${GITHUB_TOKEN}` },
            signal: AbortSignal.timeout(3000),
          }
        )
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      );
    } else {
      promises.push(Promise.resolve(null));
    }

    // Directory tree
    if (GITHUB_TOKEN) {
      promises.push(
        fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/git/trees/${GITHUB_BRANCH}?recursive=1`,
          {
            headers: { "Authorization": `token ${GITHUB_TOKEN}` },
            signal: AbortSignal.timeout(3000),
          }
        )
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      );
    } else {
      promises.push(Promise.resolve(null));
    }

    const [claudeData, pkgData, treeData] = await Promise.all(promises);

    // Process CLAUDE.md
    if (claudeData) {
      const content = atob(claudeData.content);
      context += content.substring(0, 2000);
      context += "\n\n[... see CLAUDE.md for full details]\n\n";
    }

    // Process package.json
    if (pkgData) {
      const content = atob(pkgData.content);
      context += "## Key Dependencies\n";
      context += content.substring(0, 800);
      context += "\n";
    }

    // Process directory tree
    if (treeData) {
      const files = treeData.tree || [];
      const sourceFiles = files.filter(
        (f: any) =>
          !["node_modules/", ".git/", "dist/"].some((e) =>
            f.path.startsWith(e)
          ) && f.type === "blob"
      );

      context += "\n## Repository Structure\n";
      const dirs = new Map<string, number>();
      sourceFiles.forEach((f: any) => {
        const dir = f.path.split("/")[0];
        dirs.set(dir, (dirs.get(dir) || 0) + 1);
      });

      Array.from(dirs.entries()).forEach(([dir, count]) => {
        context += `${dir}: ${count} files\n`;
      });
    }
  } catch (error) {
    console.error("Project context loading error:", error);
  }

  projectContextCache = context;
  contextLastFetch = now;
  return context;
}

async function processWithClaude(
  userMessage: string,
  conversationHistory: any[] = [],
  requestStartTime: number = Date.now()
): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    return "❌ Claude API key not configured";
  }

  try {
    // Check time budget - if running low, use minimal context
    const elapsed = Date.now() - requestStartTime;
    const timeRemaining = REQUEST_TIMEOUT_BUFFER - elapsed;
    
    if (timeRemaining < 12000) {
      // Less than 12 seconds left - abort to avoid timeout
      return "⏳ Request taking too long. Try again or ask a simpler question.";
    }
    
    // Smart context loading: skip full context for simple questions
    const useFullContext = shouldUseFullContext(userMessage);
    const skipContextLoad = !useFullContext || timeRemaining < 18000;
    
    const projectContext = await loadProjectContext(skipContextLoad);

    const systemPrompt = `# Autonomous Lead Project Engineer - Problem Solver

You are the autonomous problem-solving agent for generator3.0.

## Your Mission
When given a problem, you will:
1. **Autonomously investigate** - Read all relevant files without asking (code, logs, schema, config)
2. **Deep analysis** - Understand the complete flow and identify root causes
3. **Propose solutions** - Suggest specific fixes with code examples and clear explanations
4. **Ask only for go-ahead** - Request approval ONLY when ready to implement changes

## Project Context
${projectContext}

## Investigation Process
- Read relevant source files (don't ask, just analyze)
- Cross-reference with related modules and dependencies
- Check configuration and environment setup
- Analyze database schemas and API contracts
- Review error patterns and logs
- Identify root cause, not just symptoms

## Solution Proposals
For each problem found:
- **What's wrong** - Specific lines/functions causing the issue
- **Why it's wrong** - The root cause and impact
- **How to fix it** - Concrete code changes with diffs
- **Why this works** - Technical explanation of the solution
- **Implementation** - Step-by-step instructions
- **Test approach** - How to verify the fix works

## Request Approval When
- Ready to apply code changes
- Need to deploy or restart services
- Making schema/database modifications
- Large refactoring decisions

## Communication
- Be direct and concise
- Reference specific files and line numbers
- Provide code fixes with diffs
- Connect related issues
- Suggest next steps`;

    const messages = [
      ...conversationHistory,
      { role: "user", content: userMessage },
    ];

    const anthropic = new Anthropic({
      apiKey: ANTHROPIC_API_KEY,
    });

    const response = await anthropic.messages.create({
      model: "claude-opus-4-1-20250805",
      max_tokens: 800, // Reduced for speed
      system: systemPrompt,
      messages: messages,
    });

    const assistantMessage =
      response.content[0].type === "text"
        ? response.content[0].text
        : "No response from Claude";

    return assistantMessage;
  } catch (error) {
    console.error("Claude API error:", error);
    return `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}

Deno.serve(async (req: Request) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response("OK", {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  // Handle health check
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ message: "Claude Code Edge Function" }), {
      status: 200,
    });
  }

  const requestStartTime = Date.now();

  try {
    const body: any = await req.json();
    const { userMessage, conversationHistory } = body;

    if (!userMessage) {
      return new Response(
        JSON.stringify({ error: "Missing userMessage" }),
        { status: 400 }
      );
    }

    console.log(`[📨] Processing: ${userMessage.substring(0, 50)}...`);

    const response = await processWithClaude(userMessage, conversationHistory, requestStartTime);

    console.log(`[✅] Response sent`);

    return new Response(
      JSON.stringify({
        success: true,
        response,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[❌] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 }
    );
  }
});
