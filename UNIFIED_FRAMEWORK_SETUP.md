# Unified Framework: Claude Telegram Bot

## Architecture Overview

Everything runs within your **existing Supabase + Deno Deploy framework**:

```
┌─────────────┐       ┌──────────────────┐       ┌─────────────────┐
│  Telegram   │──────→│ Deno Deploy      │──────→│ Supabase Edge   │
│  Messages   │       │ Relay            │       │ Function        │
│             │←──────│ (deno-relay.ts)  │←──────│ (claude-code)   │
└─────────────┘       └──────────────────┘       └─────────────────┘
                                 ↓
                      ┌──────────────────┐
                      │ GitHub API       │
                      │ (Project Context)│
                      └──────────────────┘
```

## No Additional Services
✅ **Telegram** - Already configured
✅ **Deno Deploy** - Already hosting the relay
✅ **Supabase Edge Functions** - Built into your project
✅ **GitHub** - Already integrated

## Files Deployed

### 1. **deno-relay.ts** (Deployed to Deno Deploy)
- **Location**: Root of GitHub repo
- **Function**: Public webhook receiver for Telegram messages
- **Architecture**: Routes all messages to Supabase Edge Function
- **No Additional Auth**: Already public and accessible
- **Status**: ✅ Live at `https://generator30.joemagnusbizdev.deno.net`

### 2. **claude-code** Edge Function (Deployed to Supabase)
- **Location**: `supabase/functions/claude-code/index.ts`
- **Function**: Processes messages with full project context
- **Features**:
  - Loads CLAUDE.md for project understanding
  - Reads files from GitHub
  - Calls Claude 3 Sonnet for responses
  - Maintains conversation history
- **Status**: ✅ Deployed

## Setup Required

### 1. Set Supabase Edge Function Secrets

The Claude Code Edge Function needs two secrets:

```bash
# Option A: Using CLI (from project directory)
supabase secrets set ANTHROPIC_API_KEY "sk-..." --project-ref gnobnyzezkuyptuakztf
supabase secrets set GITHUB_TOKEN "ghp_..." --project-ref gnobnyzezkuyptuakztf
```

**Option B: Using Supabase Dashboard**
1. Go to: [Supabase Dashboard](https://supabase.com/dashboard)
2. Select project: `gnobnyzezkuyptuakztf`
3. Settings → Edge Functions → Secrets
4. Add:
   - `ANTHROPIC_API_KEY`: Your Claude API key (starts with `sk-`)
   - `GITHUB_TOKEN`: Your GitHub personal access token (starts with `ghp_`)

### 2. Set Deno Deploy Environment Variables

The Deno Deploy relay needs one secret (already hardcoded, but should set for production):

1. Go to: [Deno Deploy Dashboard](https://deno.com/deploy)
2. App: `generator30`
3. Settings → Environment Variables
4. Add:
   - `SUPABASE_SERVICE_ROLE_SECRET`: From Supabase Settings → API

## How It Works

### Message Flow
1. **Telegram** → Message sent to bot `/start`
2. **Deno Deploy Relay** → Receives webhook, routes to Supabase
3. **Supabase Edge Function** → 
   - Loads project context from GitHub
   - Calls Claude with conversation history
   - Returns response to relay
4. **Deno Deploy Relay** → Sends response back to Telegram user

### Example: User sends "What's the tech stack?"

```
User: "What's the tech stack?"
  ↓
Telegram → Deno Deploy relay (/functions/v1/claude-code)
  ↓
Supabase Edge Function:
  - GET CLAUDE.md from GitHub
  - Send to Claude: "What's the tech stack?" + context
  - Claude reads: "React, Vite, TypeScript, Supabase..."
  ↓
Response → Deno Deploy relay → Telegram User
```

## Testing

### Test 1: Check Deno Deploy is running
```bash
curl https://generator30.joemagnusbizdev.deno.net
# Should return: {"status": "✅ Telegram Claude Bot Relay Active"}
```

### Test 2: Check Supabase Edge Function
```bash
# First, set SUPABASE_SERVICE_ROLE_SECRET locally
export SUPABASE_SERVICE_ROLE_SECRET="your-service-role-secret"

curl -X POST https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/claude-code \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_SECRET" \
  -d '{"userMessage": "What is generator3.0?", "conversationHistory": []}'
```

### Test 3: Send Telegram message
1. Open Telegram
2. Message your bot: `/help`
3. Should see help text with commands
4. Try: `What's the tech stack?`
5. Should get Claude response with project context

## Telegram Bot Commands

Once set up, users can:

```
/help                    - Show available commands
/read CLAUDE.md          - Read a specific file
/status                  - Get project status
What's the tech stack?   - Ask any natural language question
```

## Troubleshooting

### "Connection refused" error
- Check that Supabase edge function is deployed: `supabase functions list`
- Verify secrets are set: Go to Supabase Dashboard

### "Unauthorized" error
- Missing or incorrect `SUPABASE_SERVICE_ROLE_SECRET` in Deno Deploy
- Set in Deno Deploy → Settings → Environment Variables

### Claude getting wrong context
- Check GitHub token has access to private repos
- Verify CLAUDE.md exists in GitHub (public or readable with token)

### Edge Function timeout
- Supabase functions have 5-minute timeout
- Current response includes project loading (~2-3 seconds)
- If timeouts persist, reduce context size in `claude-code/index.ts`

## Architecture Benefits

✅ **No External Services**: Everything in Supabase ecosystem
✅ **No Local Server**: No need to run anything locally
✅ **No Tunneling**: No ngrok, exposing local ports, or keeping machine on
✅ **Scalable**: Supabase Edge Functions auto-scale
✅ **Integrated**: Works with existing Supabase project

## Files Changed

1. ✅ `deno-relay.ts` - Now calls Supabase Edge Function
2. ✅ `supabase/functions/claude-code/index.ts` - New Edge Function
3. ✅ Pushed to GitHub on commit `8f00490`

## Next Steps

1. Add secrets to Supabase (ANTHROPIC_API_KEY + GITHUB_TOKEN)
2. Set SUPABASE_SERVICE_ROLE_SECRET in Deno Deploy (optional, for security)
3. Send message to Telegram bot to test
4. Monitor Supabase Edge Function logs

## Monitoring

Check Edge Function logs:
```bash
supabase functions logs claude-code --project-ref gnobnyzezkuyptuakztf
```

Or in Supabase Dashboard → Edge Functions → claude-code → Logs tab

---

**Status**: ✅ Architecture deployed and ready for secrets configuration
