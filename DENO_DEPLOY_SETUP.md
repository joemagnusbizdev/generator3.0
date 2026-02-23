# Deno Deploy Relay Setup

This relay bypasses Supabase Cloud's JWT enforcement by hosting on Deno Deploy (free, no auth required).

## Quick Deploy (2 minutes)

### Option 1: Deploy via GitHub (Recommended)

1. **Commit the relay file to GitHub:**
   ```powershell
   git add deno-relay.ts
   git commit -m "Add Deno Deploy telegram relay"
   git push
   ```

2. **Go to https://dash.deno.com**
   - Sign in with GitHub
   - Click **New Project**
   - Select **Deploy from GitHub** 
   - Choose your repo `generator3.0`
   - Set entrypoint to: `deno-relay.ts`
   - Click **Deploy**

3. **Copy the Deno Deploy URL** (looks like `https://your-project-xyz.deno.dev`)

### Option 2: Deploy via Web Paste

1. **Go to https://dash.deno.com**
   - Sign in with GitHub
   - Click **New Project**
   - Paste the contents of `deno-relay.ts`
   - Click **Deploy**

2. **Copy the URL** when deployment completes

## Set Telegram Webhook

Once you have your Deno Deploy URL, update Telegram:

```powershell
$token = "8707153044:AAFQEQvq_3QmABdrQSQUHC7osDawsOVtUJc"
$deployUrl = "https://your-project-xyz.deno.dev"  # <- Replace with YOUR Deno URL
Invoke-WebRequest -Uri "https://api.telegram.org/bot$token/setWebhook?url=$deployUrl" -UseBasicParsing | Select-Object -ExpandProperty Content
```

You should see: `{"ok":true,"result":true,"description":"Webhook is already set"}`

## Verify It Works

1. **Check webhook status:**
   ```powershell
   $token = "8707153044:AAFQEQvq_3QmABdrQSQUHC7osDawsOVtUJc"
   Invoke-WebRequest -Uri "https://api.telegram.org/bot$token/getWebhookInfo" -UseBasicParsing | ConvertFrom-Json | Select-Object result
   ```

2. **Test in Telegram:**
   - Find your bot
   - Send `/help`
   - You should get the command list back
   - Try `/status`

3. **Monitor in Deno Deploy:**
   - Go to https://dash.deno.com and click your project
   - Click **Logs** to see relay activity
   - Should see messages like: `[Relay] Received webhook...`

## Why This Works

- **Deno Deploy** - Free, no authentication required, public by default
- **Telegram → Deno Deploy** - Posts webhook directly (no JWT)
- **Deno Deploy → Supabase** - Forwards with apikey header (bypasses JWT check)
- **Flow:** Telegram → Deno Deploy (public) → Supabase (authenticated) → Claude → Telegram

## Troubleshooting

### Webhook still showing 401 error
- Make sure webhook URL is correctly set in Telegram (no trailing slash)
- Wait 30 seconds after setting webhook
- Verify the Deno Deploy project is deployed (green status in dashboard)

### Bot not responding in Telegram
- Check Deno Deploy logs for errors
- Verify SUPABASE_URL and key in `deno-relay.ts` match your Supabase project
- Make sure `telegram-claude` function exists and is deployed

### Deno Deploy logs show errors
- Check if relay is getting POST requests (should show `[Relay] Received webhook...`)
- If no logs, Telegram webhook isn't reaching Deno Deploy URL
- Verify relay code is deployed: https://dash.deno.com → Your Project → Logs

## Cost

**$0** - Completely free. Deno Deploy includes generous free tier.

## Next Steps

Once working:
1. Test all commands: `/help`, `/read`, `/edit`, `/commit`
2. Add team members to Telegram group
3. Optional: Add `ALLOWED_TELEGRAM_IDS` to restrict access
