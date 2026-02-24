# CLAUDE.md - Project Knowledge Base

**Last Updated**: February 24, 2026  
**Status**: 🟢 Production + Active Development  
**Maintainer**: Claude (Autonomous Agent + Telegram Bot Integration)

---

## 1. Project Overview

**Repository**: `joemagnusbizdev/generator3.0`  
**Type**: Full-stack intelligence alert & web scraping platform  
**Purpose**: Magnus Safety intelligence alerts system with AI-powered scour management, trend analysis, and team collaboration

---

## 2. Tech Stack

### Frontend
- **Framework**: React (via Vite)
- **Build**: Vite + TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Custom React components in `src1/components/`
- **State**: In-memory (conversation context per user)
- **Deployment**: Vercel

### Backend / Serverless
- **Database**: Supabase (PostgreSQL)
- **API Functions**: 
  - Supabase Edge Functions (Deno runtime)
  - Deno Deploy (public relay, no auth)
- **Authentication**: Supabase Auth + Service Role Keys
- **Webhooks**: Telegram Bot (Deno Deploy relay)

### External Services
- **Claude AI**: Anthropic API (claude-3-5-sonnet-20241022)
- **Search**: Brave Search API (BSA key)
- **WordPress Integration**: REST API + ACF Fields
- **Notifications**: Telegram Bot API
- **Git Integration**: GitHub REST API + webhooks
- **Geocoding**: OpenCage API

### Scripts & Workers
- **Cron Jobs**: Supabase Edge Function: `scour-worker`
- **PowerShell Scripts**: Various deployment/maintenance scripts
- **Database migrations**: SQL scripts in root

---

## 3. File Structure

```
generator3.0/
├── src1/                           # React frontend
│   ├── components/                 # UI components
│   ├── lib/                        # Utilities
│   ├── App.tsx                     # Main app
│   └── index.ts                    # Entry point
├── supabase/                       # Supabase configuration
│   ├── functions/
│   │   ├── telegram-claude/        # Telegram bot relay (Edge Function)
│   │   ├── scour-worker/           # Background job worker
│   │   └── clever-function/        # API utilities
│   └── migrations/                 # Database schema
├── dist/                           # Build output
├── public/                         # Static assets
├── package.json                    # Node dependencies
├── vite.config.ts                  # Vite bundler config
├── tailwind.config.js              # Tailwind CSS config
├── vercel.json                     # Vercel deployment config
├── deno-relay.ts                   # Deno Deploy public relay (backup)
├── deno.json                       # Deno config
└── [docs]                          # 100+ markdown documentation files
```

---

## 4. Core Features Implemented

### ✅ Completed
- Intelligence alert system with database storage
- Scour job management (with 5→15 min polling timeout)
- AI-powered trend analysis (Claude integration)
- Early signals detection and custom geofencing
- WordPress blog integration (ACF fields)
- Team collaboration via Telegram bot
- GitHub file operations (read/write/commit)
- Confidence scoring for alerts
- Multi-source ingestion (RSS, API, webhooks)

### 🔄 In Progress
- Telegram bot deployment (🟢 working via Deno Deploy)
- Claude context loading from GitHub (✅ working)
- Natural language code editing via Telegram (✅ ready)

### 🚀 Planned
- Advanced analytics dashboard
- Real-time WebSocket updates
- Mobile app
- Advanced ML models for signal prediction

---

## 5. Critical Environment Variables

**Set in Deno Deploy**:
```
ANTHROPIC_API_KEY          # Claude API key
GITHUB_TOKEN               # GitHub REST API access
SUPABASE_PROJECT_ID        # Project ID: gnobnyzezkuyptuakztf
SUPABASE_SERVICE_ROLE_SECRET  # Service role key (NOT in frontend)
```

**Set in Supabase Dashboard**:
- All of above (for Edge Functions)
- Plus: TELEGRAM_BOT_TOKEN, BRAVRE_SEARCH_API_KEY, etc.

**Set in Vercel**:
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_URL`
- Frontend-only keys with VITE_ prefix

---

## 6. Deployment Architecture

```
Telegram Messages
    ↓
[Telegram Bot API]
    ↓
https://generator30.joemagnusbizdev.deno.net (PUBLIC, no auth)
    ↓
[Deno Deploy Relay] ← Decoupled from auth
    ↓
[Claude API] → Process request
[GitHub API] → Read/write code
[Supabase] → Query database
    ↓
[Telegram Bot API]
    ↓
User's Telegram Chat (Response)
```

**Why Deno Deploy?** Supabase Edge Functions enforce JWT auth at infrastructure level, but Telegram webhooks can't provide JWT tokens. Deno Deploy is public by default, solving this architectural constraint.

---

## 7. Key Code Patterns

### Reading Files from GitHub
```typescript
const url = `https://api.github.com/repos/joemagnusbizdev/generator3.0/contents/${filePath}`;
const response = await fetch(url, {
  headers: { "Authorization": `Bearer ${GITHUB_TOKEN}` },
});
const content = await response.text();
```

### Writing Files to GitHub
```typescript
// GET SHA, then PUT with Base64 content
const update = await fetch(url, {
  method: "PUT",
  body: JSON.stringify({
    message: "Update via Claude",
    content: btoa(newContent),
    sha: existingSHA, // Only for updates
  }),
});
```

### Querying Claude
```typescript
const response = await fetch("https://api.anthropic.com/v1/messages", {
  body: JSON.stringify({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1500,
    system: systemPrompt,
    messages: [...conversationHistory],
  }),
});
```

---

## 8. Development Workflow

### Local Development
```bash
# Install dependencies
npm install

# Start Vite dev server
npm run dev

# Serve Supabase Edge Functions locally
supabase functions serve telegram-claude

# Or test Deno Deploy locally
deno run --allow-net --allow-env deno-relay.ts
```

### Deployment
```bash
# Frontend (automatic on push to Vercel)
git push origin main

# Edge Functions (automatic on file change)
supabase functions deploy telegram-claude

# Deno Deploy (automatic on GitHub push, checks for deno-relay.ts)
# Just push changes - Deno Deploy auto-rebuilds!
```

### GitHub Integration
- All changes logged via commits
- Service Role Secret allows writing to GitHub from Edge Functions
- Claude can read any file, write to any branch

---

## 9. Current Issues & Workarounds

| Issue | Root Cause | Solution |
|-------|-----------|----------|
| Supabase JWT blocking Telegram webhooks | Infrastructure enforcement | Using Deno Deploy public relay |
| File sync between local and deno-relay.ts | Deno Deploy checks git, local may differ | Use `git checkout HEAD -- deno-relay.ts` if corrupted |
| Long-running Claude responses | 30s timeout on serverless | Keep max_tokens ≤ 1500 |

---

## 10. Telegram Bot Capabilities

**Webhook URL**: `https://generator30.joemagnusbizdev.deno.net`  
**Token**: Hardcoded in deno-relay.ts (consider moving to env var)

### Commands
- `/help` - Show available commands
- `/read [path]` - Load file from GitHub
- `/edit [instruction]` - Modify code via Claude
- `/status` - Get system health
- Regular messages → Claude processes them

### Group Chat Behavior
- Bot must be **@mentioned** in group chats (privacy mode enabled)
- Works in DMs without mention
- Maintains conversation context per chat_id

---

## 11. Next Steps for Development

1. **Immediate**:
   - [ ] Test bot in team Telegram group
   - [ ] Verify all env vars set in Deno Deploy
   - [ ] Monitor logs for errors

2. **Short-term**:
   - [ ] Move TELEGRAM_BOT_TOKEN to env var (not hardcoded)
   - [ ] Add rate limiting to bot responses
   - [ ] Implement command authorization checks

3. **Medium-term**:
   - [ ] Add caching layer for GitHub reads
   - [ ] Implement multi-file atomic commits
   - [ ] Add more sophisticated error recovery

4. **Long-term**:
   - [ ] Migrate to unified frontend + backend architecture
   - [ ] Real-time collaborative editing
   - [ ] Advanced analytics dashboard

---

## 12. Key Contacts & Resources

- **Claude Bot**: Via Telegram (`@generator3_alert_bot`)
- **Repository**: https://github.com/joemagnusbizdev/generator3.0
- **Deno Deploy**: https://dash.deno.com → generator30
- **Supabase Dashboard**: https://supabase.com/dashboard/project/gnobnyzezkuyptuakztf
- **Vercel Project**: https://vercel.com/joe-serkins-projects/generator3.0

---

**This file is maintained by Claude. Update it when major architecture changes occur.**
