# Telegram Claude Bot Setup Guide

Enable your team to access Claude and edit code via Telegram messages. **Completely free.**

## Overview

Your team can now:
- Ask Claude questions about the codebase
- Read and search files
- Make code changes via natural language
- Get system status updates
- All via Telegram messages in real-time

## Quick Setup (5 minutes)

### Step 1: Create a Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot`
3. Give it a name like "Claude Code Bot"
4. Copy the **bot token** (looks like: `123456:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef`)

### Step 2: Deploy the Bot Function

Deploy to Supabase:

```bash
supabase functions deploy telegram-claude
```

### Step 3: Add Environment Variable

In Supabase function secrets, add:

```
TELEGRAM_BOT_TOKEN=123456:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef
```

(Keep your bot token secret - don't share or commit it)

### Step 4: Connect Telegram to Your Function

Use this PowerShell command to set the webhook (replace your bot token and URL):

```powershell
$token = "YOUR_BOT_TOKEN_HERE"
$url = "https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/telegram-claude"
Invoke-WebRequest -Uri "https://api.telegram.org/bot$token/setWebhook?url=$url" -UseBasicParsing
```

**Or using curl:**
```bash
curl "https://api.telegram.org/botYOUR_BOT_TOKEN_HERE/setWebhook?url=https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/telegram-claude"
```

You should get: `{"ok":true,"result":true,"description":"Webhook is already set"}`

### Step 5: Test It

1. Find your bot in Telegram (search by bot name)
2. Send `/help`
3. You should get back the command list
4. Try: `/status` or `/search polling timeout`

**Done!** Your bot is live.

## Usage Examples

### View Code
```
/read src1/components/ScourManagementInline.tsx
```

### Search Codebase
```
/search error handling in scour functions
```

### Ask About Code
```
why is the polling timeout 15 minutes?
```

### Make Changes
```
increase the polling timeout to 20 minutes in ScourManagementInline.tsx
```

## Available Commands

- `/help` - Show command list
- `/read [file path]` - View a file
- `/search [query]` - Search the codebase
- `/status` - Check scour job status
- `/health` - System health check
- Chat naturally - Ask Claude anything about the code

## How It Works

1. Team member sends Telegram message
2. Telegram forwards to your Supabase function
3. Function passes message to Claude API
4. Claude reads/searches files and responds
5. Response sent back to Telegram
6. Conversation context maintained (1 hour timeout)

## Using in Group Chats

You can add the bot to a Telegram group:

1. Create or open a Telegram group
2. Click **Add Members**
3. Search for your bot by name
4. Add it to the group

Now the whole team can ask questions with:
```
@YourBotName what files changed recently?
```

## Getting Your Function URL

In Supabase dashboard:

1. Go to **Functions**
2. Click **telegram-claude**
3. Copy the full URL (should be something like):
   ```
   https://[project-id].supabase.co/functions/v1/telegram-claude
   ```

## Security Notes

- **Bot token is secret** - Never share or commit it
- **No authentication by default** - Anyone who finds your bot can message it
- Conversation context stored in memory (cleared after 1 hour)
- All Claude calls go through Anthropic API (same as your existing setup)

## To Add Authentication

If you want to restrict to specific people:

1. Add to environment variables:
   ```
   ALLOWED_TELEGRAM_IDS=123456789,987654321
   ```

2. Update code in `index.ts` to check:
   ```typescript
   const allowed = Deno.env.get("ALLOWED_TELEGRAM_IDS")?.split(",") || [];
   if (allowed.length > 0 && !allowed.includes(message.from.id.toString())) {
     await sendTelegramMessage(chatId, "❌ Not authorized");
     return;
   }
   ```

To find Telegram ID: Send `/start` to @userinfobot

## Troubleshooting

### Bot not responding
- Check bot token is correct in function secrets
- Check webhook URL in @BotFather matches your function URL
- Check function logs: `supabase functions logs telegram-claude`

### Invalid webhook error from @BotFather
- Make sure function URL is public and accessible
- Try without the trailing slash
- Wait 30 seconds and try again

### Claude API errors
- Verify `ANTHROPIC_API_KEY` is set in secrets
- Check if API quota is exceeded
- Check Anthropic dashboard for billing issues

## Customization

Edit `supabase/functions/telegram-claude/index.ts`:

- Change `systemPrompt` for different AI behavior
- Add more slash commands in `handleIncomingMessage`
- Adjust `CONTEXT_TIMEOUT` for longer conversation memory
- Change `max_tokens` for longer/shorter responses
- Use different Claude model if needed

## Managing the Bot

### See bot commands
In @BotFather: `/help` then select your bot

### Revoke token
If token is compromised: `/mybots` → select bot → API Token → /deletetoken

### Delete bot
In @BotFather: `/setcommands` → select bot to delete

### Get bot username
In @BotFather: `/mybots` → select bot → shows username like @ClaudeCodeBot

## Cost

**$0** - Completely free. No costs at all.

Telegram has no API fees. Your only cost is the Anthropic API (which you already pay for).

## Support

- **Telegram Bot API docs**: https://core.telegram.org/bots/api
- **Supabase Functions**: https://supabase.com/docs/guides/functions
