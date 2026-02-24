/**
 * Claude Code API Server
 * Local backend with full project access for Telegram bot
 * Runs on port 3001
 */

import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = __dirname;

const app = express();
const PORT = process.env.PORT || 3001;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
});

app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Claude Code API Server running",
    projectRoot: PROJECT_ROOT,
    hasApiKey: !!ANTHROPIC_API_KEY,
  });
});

/**
 * Main endpoint - process messages with full project context
 */
app.post("/process", async (req, res) => {
  try {
    const { userMessage, conversationHistory = [] } = req.body;

    if (!userMessage) {
      return res.status(400).json({ error: "Missing userMessage" });
    }

    if (!ANTHROPIC_API_KEY) {
      return res
        .status(500)
        .json({ error: "ANTHROPIC_API_KEY not configured" });
    }

    console.log(`[📨] Processing: ${userMessage.substring(0, 50)}...`);

    // Load project context
    const projectContext = getProjectContext();

    // Build system prompt
    const systemPrompt = `# Lead Project Engineer & Code Executor

You are the autonomous agent for the generator3.0 project with FULL FILE SYSTEM ACCESS.

## Project Context
${projectContext}

## Capabilities (use liberally)
- Read any file in the project: /read src1/index.ts
- Write files and create changes
- Run git commands and commit changes
- Understand the complete project architecture
- Make atomic multi-file changes

## Available Tools (mention to request)
- \`readFile(path)\` - Read file contents
- \`writeFile(path, content)\` - Write/create files
- \`runGit(command)\` - Execute git commands
- \`listDirectory(path)\` - List folder contents
- \`searchFiles(pattern)\` - Search across files

## Constraints
- Never commit to main without explicit permission
- Always preview changes before executing
- Keep responses Telegram-friendly (~500 chars)
- Include commit messages with changes

## Communication
- Be direct and technical
- Show diffs for code changes
- Explain the 'why' behind suggestions
- One atomic change per response`;

    // Call Claude with project context
    const messages = [
      ...conversationHistory,
      { role: "user", content: userMessage },
    ];

    const response = await anthropic.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 2000,
      system: systemPrompt,
      messages: messages,
    });

    const assistantMessage =
      response.content[0].type === "text"
        ? response.content[0].text
        : "No response from Claude";

    console.log(`[✅] Response: ${assistantMessage.substring(0, 50)}...`);

    res.json({
      success: true,
      response: assistantMessage,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    });
  } catch (error) {
    console.error("[❌] Error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * File operations endpoint
 */
app.post("/files/read", (req, res) => {
  try {
    const { filePath } = req.body;
    const fullPath = path.join(PROJECT_ROOT, filePath);

    // Security: prevent directory traversal
    if (!fullPath.startsWith(PROJECT_ROOT)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const content = fs.readFileSync(fullPath, "utf-8");
    const lines = content.split("\n");
    const truncated = lines.length > 100;

    res.json({
      filePath,
      content: lines.slice(0, 100).join("\n"),
      lineCount: lines.length,
      truncated,
    });
  } catch (error) {
    res
      .status(400)
      .json({ error: error instanceof Error ? error.message : "Read failed" });
  }
});

app.post("/files/write", (req, res) => {
  try {
    const { filePath, content, message } = req.body;
    const fullPath = path.join(PROJECT_ROOT, filePath);

    // Security: prevent directory traversal
    if (!fullPath.startsWith(PROJECT_ROOT)) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Create directories if needed
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content, "utf-8");

    // Try to git commit if message provided
    let commitResult = "";
    if (message) {
      try {
        execSync(`cd "${PROJECT_ROOT}" && git add "${filePath}" && git commit -m "${message}"`, {
          encoding: "utf-8",
        });
        commitResult = "Committed to git";
      } catch (e) {
        commitResult = "Write successful but git commit skipped";
      }
    }

    res.json({
      success: true,
      filePath,
      message: commitResult || "File written",
    });
  } catch (error) {
    res
      .status(400)
      .json({ error: error instanceof Error ? error.message : "Write failed" });
  }
});

app.post("/git/exec", (req, res) => {
  try {
    const { command } = req.body;

    // Whitelist safe commands
    const safePrefixes = ["status", "log", "diff", "show", "branch"];
    if (!safePrefixes.some((p) => command.toLowerCase().startsWith(p))) {
      return res.status(403).json({ error: "Command not allowed" });
    }

    const result = execSync(`cd "${PROJECT_ROOT}" && git ${command}`, {
      encoding: "utf-8",
    });

    res.json({
      success: true,
      command,
      output: result,
    });
  } catch (error) {
    res
      .status(400)
      .json({ error: error instanceof Error ? error.message : "Git failed" });
  }
});

/**
 * Helper: Load project context
 */
function getProjectContext() {
  let context = "";

  // Load CLAUDE.md
  try {
    const claudePath = path.join(PROJECT_ROOT, "CLAUDE.md");
    if (fs.existsSync(claudePath)) {
      const content = fs.readFileSync(claudePath, "utf-8");
      context += content.substring(0, 4000);
      context += "\n\n[... see CLAUDE.md for full details]\n\n";
    }
  } catch (e) {
    console.warn("Could not load CLAUDE.md");
  }

  // Load package.json for dependencies
  try {
    const pkgPath = path.join(PROJECT_ROOT, "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      context += `## Tech Stack\n`;
      context += `- React: ${pkg.dependencies.react || "not found"}\n`;
      context += `- TypeScript: ${pkg.devDependencies.typescript || "not found"}\n`;
      context += `- Vite: ${pkg.devDependencies.vite || "not found"}\n`;
      context += `- Tailwind: ${pkg.devDependencies.tailwindcss || "not found"}\n`;
    }
  } catch (e) {
    console.warn("Could not load package.json");
  }

  // List main directories
  try {
    const entries = fs.readdirSync(PROJECT_ROOT, { withFileTypes: true });
    const dirs = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => e.name);

    context += `\n## Directory Structure\n`;
    context += dirs.slice(0, 15).join(", ") + "\n";
  } catch (e) {
    console.warn("Could not list directories");
  }

  return context;
}

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Claude Code API Server started on port ${PORT}`);
  console.log(`📁 Project root: ${PROJECT_ROOT}`);
  console.log(`🔑 API key configured: ${!!ANTHROPIC_API_KEY}`);
  console.log(`\nEndpoints:`);
  console.log(`  GET  /health              - Server status`);
  console.log(`  POST /process             - Process message with Claude`);
  console.log(`  POST /files/read          - Read file`);
  console.log(`  POST /files/write         - Write file`);
  console.log(`  POST /git/exec            - Execute git command`);
  console.log(`\n`);
});
