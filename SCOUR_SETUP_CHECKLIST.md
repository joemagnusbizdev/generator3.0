# Scour System Setup Checklist

## Why No Alerts Are Being Created

The scour system is running but failing silently due to missing configuration. Here's what needs to be fixed:

---

## ✅ CRITICAL: Configure Claude API Key

**Problem:** Edge Function can't call Claude without API key
**Solution:**

1. Go to [Supabase Dashboard - Functions](https://supabase.com/dashboard/project/gnobnyzezkuyptuakztf/settings/functions)
2. Click on `clever-function`
3. Go to "Settings" tab
4. Add Environment Variable:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** Your Claude API key from https://console.anthropic.com

**Test it:**
```bash
curl https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function/test-claude
```

Expected response if working:
```json
{
  "ok": true,
  "message": "Claude API is working correctly",
  "model": "claude-3-haiku-20240307"
}
```

Expected response if missing:
```json
{
  "ok": false,
  "error": "ANTHROPIC_API_KEY not set in Edge Function secrets"
}
```

---

## ✅ Database Table (Already Done)

The `app_kv` table exists for tracking scour jobs. ✓

---

## ✅ Optional: Configure Brave Search (For Early Signals)

Early Signals use Brave Search for real-time web data. Without this, Early Signals won't work (but main scour will).

1. Get API key from https://brave.com/search/api/
2. Add to Supabase Edge Function secrets:
   - **Name:** `BRAVRE_SEARCH_API_KEY` (note the typo in the code)
   - **Value:** Your Brave API key

---

## 🔍 Diagnostic Endpoints

### Check Configuration Status
```bash
curl https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function/status
```

Shows:
- Claude API key configured
- Brave API key configured
- Recent scour jobs

### Test Claude API
```bash
curl https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function/test-claude
```

### Health Check
```bash
curl https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function/health
```

---

## 📊 How Scour Works (Once Configured)

### Main Scour (RSS Feeds)
1. User clicks "Run Scour"
2. Frontend calls `/scour-sources-v2`
3. Edge Function:
   - Gets all enabled sources (651 RSS feeds)
   - Processes in batches of 50
   - For each source:
     - Fetches RSS/web content
     - Calls Claude to extract alerts
     - Saves alerts to database
     - Updates job progress in `app_kv`
4. Frontend polls job status every 2s
5. Status bar shows progress

### Early Signals (Web Search)
1. User clicks "Run Early Signals"
2. Edge Function:
   - Runs 42 travel-focused queries via Brave Search
   - Processes results in batches of 5
   - For each result set:
     - Calls Claude to extract alerts
     - Deduplicates against existing
     - Saves to database
3. Adds ~10-50 timely alerts based on current events

---

## 🐛 Troubleshooting

### Issue: "SCOURING IN PROGRESS" but no alerts created

**Causes:**
1. Claude API key not set → Check `/test-claude` endpoint
2. Claude API rate limits → Check Anthropic dashboard
3. RSS feeds failing → Check Edge Function logs
4. Alerts being skipped as duplicates → Check dedup logic

**Debug:**
```bash
# Check recent scour jobs
curl https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function/status

# Check alerts in database
# (Use Supabase dashboard > Table Editor > alerts > Filter: created_at > today)
```

### Issue: Early Signals not working

**Cause:** Brave API key not configured

**Fix:** Add `BRAVRE_SEARCH_API_KEY` to Edge Function secrets

---

## ⚡ Quick Start

1. Add `ANTHROPIC_API_KEY` to Edge Function secrets
2. Test: `curl .../test-claude`
3. Hard refresh browser (`Ctrl+Shift+R`)
4. Click "Run Scour" in UI
5. Watch status bar for progress

---

## 📝 Next Steps After Configuration

1. Run test scour with small batch
2. Monitor for Claude rate limits (429 errors)
3. Check alert quality (relevance, deduplication)
4. Adjust batch sizes if timeouts occur
5. Fine-tune Claude prompts if extraction is poor

