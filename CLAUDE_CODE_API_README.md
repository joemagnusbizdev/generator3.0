# Claude Code API Setup Guide

This guide explains how to set up the **local Claude Code API server** that powers the Telegram bot's code editing and project understanding capabilities.

## Architecture Overview

```
Telegram Message
    ↓
Deno Deploy Relay (https://generator30.joemagnusbizdev.deno.net)
    ↓
Local Claude Code API Server (http://localhost:3001)
    ↓
[File System] + [Claude AI] + [Git Commands]
    ↓
Telegram Response
```

**Benefits:**
- ✅ Full file system access (read/write local files)
- ✅ Git integration (commit, log, status, etc.)
- ✅ Complete project context understanding
- ✅ Atomic multi-file changes
- ✅ No infrastructure limits

---

## Installation

### 1. Install Dependencies

```bash
npm install
```

This installs:
- `express` - API server framework
- `@anthropic-ai/sdk` - Claude AI API client
- All existing project dependencies

### 2. Set Environment Variables

Create a `.env` file in the project root (if not exists):

```env
ANTHROPIC_API_KEY=sk-ant-...your-claude-api-key...
PORT=3001
```

Or set via environment:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export PORT=3001
```

### 3. Start the Local API Server

```bash
npm run claude-code-api
```

You should see:
```
🚀 Claude Code API Server started on port 3001
📁 Project root: /path/to/generator3.0
🔑 API key configured: true

Endpoints:
  GET  /health              - Server status
  POST /process             - Process message with Claude
  POST /files/read          - Read file
  POST /files/write         - Write file
  POST /git/exec            - Execute git command
```

### 4. Verify It's Running

Test the health endpoint:

```bash
curl http://localhost:3001/health
```

Should return:
```json
{
  "status": "ok",
  "message": "Claude Code API Server running",
  "projectRoot": "/path/to/generator3.0",
  "hasApiKey": true
}
```

---

## Connecting to Deno Deploy

The Deno Deploy relay automatically tries to call `http://localhost:3001`. If you're running Telegram bot in **production**, you need to:

### Option A: Run Locally (Development)
- ✅ Start Claude Code API: `npm run claude-code-api`
- ✅ Deno Deploy calls your local machine (requires port forwarding or ngrok)
- ⚠️ Works for testing, not for 24/7 operation

### Option B: Deploy to Production Server
- Deploy this server to a VPS (EC2, Linode, DigitalOcean, etc.)
- Set `CLAUDE_CODE_API_URL` env var in Deno Deploy to your server's URL
- Example:
  ```
  CLAUDE_CODE_API_URL=https://claude-api.yourdomain.com
  ```

### Option C: Use ngrok for Local Tunneling
For testing without deploying:

```bash
# In another terminal, expose localhost:3001 to internet
npx ngrok http 3001
```

Then in Deno Deploy settings, set:
```
CLAUDE_CODE_API_URL=https://your-ngrok-url.ngrok.io
```

---

## API Endpoints

### POST /process
Send a message, get Claude response with full project context.

**Request:**
```json
{
  "userMessage": "Fix the timeout issue in scour-worker",
  "conversationHistory": [
    {"role": "user", "content": "What files should I look at?"},
    {"role": "assistant", "content": "Check scour-worker/index.ts..."}
  ]
}
```

**Response:**
```json
{
  "success": true,
  "response": "I found the issue... here's the fix...",
  "usage": {
    "inputTokens": 2048,
    "outputTokens": 512
  }
}
```

### POST /files/read
Read a file from the project.

**Request:**
```json
{
  "filePath": "src1/App.tsx"
}
```

**Response:**
```json
{
  "filePath": "src1/App.tsx",
  "content": "import React from 'react'...",
  "lineCount": 250,
  "truncated": true
}
```

### POST /files/write
Write or create a file, optionally commit to git.

**Request:**
```json
{
  "filePath": "src1/new-component.tsx",
  "content": "export function NewComponent() {...}",
  "message": "Add new component for alerts dashboard"
}
```

**Response:**
```json
{
  "success": true,
  "filePath": "src1/new-component.tsx",
  "message": "Committed to git"
}
```

### POST /git/exec
Execute safe git commands.

**Request:**
```json
{
  "command": "log --oneline -n 5"
}
```

**Response:**
```json
{
  "success": true,
  "command": "log --oneline -n 5",
  "output": "6410a9b Fix Claude model name...\n99bee9f Improve bot...\n..."
}
```

---

## Troubleshooting

### "Cannot reach Claude Code API"
- ✅ Is the server running? `npm run claude-code-api`
- ✅ Is it on port 3001? Check output or `lsof -i :3001`
- ✅ Is ANTHROPIC_API_KEY set? Check: `echo $ANTHROPIC_API_KEY`

### "ANTHROPIC_API_KEY not configured"
```bash
# Set in PowerShell
$env:ANTHROPIC_API_KEY = "sk-ant-..."

# Or in .env file
ANTHROPIC_API_KEY=sk-ant-...
```

### Telegram bot says "Access denied"
- Check if running in production without exposing the API
- Use ngrok if running locally: `npx ngrok http 3001`
- Or deploy the API server to a public URL

### File write fails with "Access denied"
- Directory traversal protection prevents writing outside project root
- Only files within `/path/to/generator3.0/` can be modified

### Git commands not working
- Only whitelisted commands allowed: `status`, `log`, `diff`, `show`, `branch`
- Commit commands must go through `/files/write` endpoint

---

## Development Tips

### Auto-reload the API Server
```bash
npm install -D nodemon
npm run claude-code-api:dev
```

### Debug Mode
Add logging to `claude-code-api.js`:
```javascript
console.log("[🔍 DEBUG] Processing:", userMessage);
console.log("[🔍 DEBUG] Project context size:", projectContext.length);
```

### Test Claude Connection Locally
```bash
curl -X POST http://localhost:3001/process \
  -H "Content-Type: application/json" \
  -d '{"userMessage":"What is this project?","conversationHistory":[]}'
```

---

## Performance Considerations

- **First request slower**: Project context loaded from CLAUDE.md and package.json
- **Context cached**: Reused for 1 hour to reduce file I/O
- **Conversations stored in memory**: Lost if server restarts
- **File operations**: Direct file system (faster than GitHub API)

---

## Security Notes

- 🔒 API only accessible on localhost by default
- 🔒 Directory traversal protection prevents accessing files outside project
- 🔒 Git commands whitelisted (no `rm`, `push`, etc.)
- 🚨 API key stored in environment, never in code
- 🚨 If deployed publicly, add authentication middleware

---

## Next Steps

1. **Start the API server:**
   ```bash
   npm run claude-code-api
   ```

2. **Test it's working:**
   ```bash
   curl http://localhost:3001/health
   ```

3. **Send a test message from Telegram:**
   ```
   How can I improve the scour-worker performance?
   ```

4. **Check the bot response:**
   Bot should now respond with full project context understanding!

---

For issues or questions, check the Telegram bot logs or the API server console output.
