# Early Signals Debug Guide - Claude API Response Logging

## Problem Statement
Early signals returns 0 results in ~3 seconds, and the edge function logs show that requests were sent to Claude but no response is being logged.

## Root Cause Analysis

The issue is likely one of these:

1. **Claude API is not responding** - requests timeout or fail silently
2. **Claude response is not being captured** - no logs showing what Claude returns
3. **JSON parsing is failing silently** - Claude responds but the JSON extraction fails
4. **Response format is unexpected** - Claude returns valid JSON but not in the expected structure

## Recent Improvements (Commit f802ed3)

Added comprehensive logging throughout the `executeEarlySignalQuery()` function in `scour-worker/index.ts` to trace each step:

### Logging Checkpoints

**Phase 1: Brave Search**
```
[CLAUDE_DASHBOARD_LOG] Brave Search API call for: "{query}"
[CLAUDE_DASHBOARD_LOG] Brave response received, status: {status}
[CLAUDE_DASHBOARD_LOG] Brave returned {count} results    // OR
[CLAUDE_DASHBOARD_LOG] Brave returned empty results or no .web property
[CLAUDE_DASHBOARD_LOG] No Brave API key configured, skipping web search
```

**Phase 2: Claude API Call**
```
[CLAUDE_DASHBOARD_LOG] Sending {count} search results to Claude
[CLAUDE_DASHBOARD_LOG] About to fetch from Claude API with timeout 15s
[CLAUDE_DASHBOARD_LOG] Claude API response received, status: {status}
```

**Phase 3: Error Handling (if status != 200)**
```
[CLAUDE_DASHBOARD_LOG] Claude API error: {status} - {error text}
```

**Phase 4: Response Parsing**
```
[CLAUDE_RESPONSE_DATA] Full response: {first 500 chars of JSON}
[CLAUDE_RESPONSE_DATA] Content array found with {count} blocks
[CLAUDE_RESPONSE_DATA] Text block: {first 300 chars of text}
[CLAUDE_RESPONSE_DATA] JSON match found, attempting parse...
[CLAUDE_DASHBOARD_LOG] Extracted {count} alerts
```

**Phase 5: If No Alerts Found**
```
[CLAUDE_RESPONSE_DATA] No content array in response or content is not an array
[CLAUDE_RESPONSE_DATA] No JSON array found in text: "{content}"
[CLAUDE_RESPONSE_DATA] JSON match parsing failed, no valid alerts
[EARLY_SIGNAL_DONE] "{query}": 0 alerts (no matches found)
```

**Phase 6: If Error Occurs**
```
[EARLY_SIGNAL_ERROR] Query "{query}" failed with error: {error}
[EARLY_SIGNAL_ERROR] Error message: {error message}
[EARLY_SIGNAL_ERROR] Error stack: {stack trace}
```

## How to Diagnose

### Step 1: Check Supabase Function Logs
1. Go to [Supabase Functions Dashboard](https://supabase.com/dashboard/project/gnobnyzezkuyptuakztf/functions)
2. Click on `scour-worker`
3. Click "View Logs" or "Realtime logs"
4. Trigger early signals
5. Look for the logging checkpoints above

### Step 2: Interpret the Logs

**If you see:**
```
[CLAUDE_DASHBOARD_LOG] About to fetch from Claude API with timeout 15s
```
Then **STOPS**, probably:
- Claude API is timing out (15 second timeout)
- Network issue between Deno runtime and Claude API
- Claude API is overloaded or returning 5xx errors

**If you see:**
```
[CLAUDE_DASHBOARD_LOG] Claude API error: 401
```
Then:
- `ANTHROPIC_API_KEY` environment variable is missing or incorrect
- Check Supabase Settings → Edge Functions → scour-worker → Environment Variables

**If you see:**
```
[CLAUDE_DASHBOARD_LOG] Claude API error: 429
```
Then:
- Claude API rate limit reached
- Need to implement exponential backoff or increase delays between requests

**If you see:**
```
[CLAUDE_RESPONSE_DATA] No content array in response
```
Then:
- Claude returned a response but in unexpected format
- Check the full response logged before this message

**If you see:**
```
[CLAUDE_RESPONSE_DATA] No JSON array found in text
```
Then:
- Claude's text response doesn't contain JSON array `[...]`
- Claude returned natural language instead of JSON
- Check the logged text block to see what Claude actually returned

### Step 3: Specific Debug Scenarios

#### Scenario A: No logs for Brave Search
**Problem:** Early signals aren't even getting to Brave
**Solution:** Check if `BRAVRE_SEARCH_API_KEY` (note the typo in the env var name) is configured

#### Scenario B: Brave returns results but Claude gets no results
**Problem:** Claude is called but returns empty array
**Solution:** Claude might be filtering out all results. Try:
1. Simpler queries (less specific)
2. Different event types (earthquakes vs protests)
3. Check Claude model availability (currently using `claude-3-5-haiku-20241022`)

#### Scenario C: Claude returns results but they're not saved
**Problem:** Alerts extracted but not in database
**Solution:** Check logs for:
```
✓ Saved: {title}    // Success
✗ Failed to save alert: {error}  // Database error
```

#### Scenario D: All phases complete but 0 results in 3 seconds
**Problem:** Execution too fast, might be exiting early
**Causes:**
- Early return from missing Claude key
- Early return from missing Brave key
- Batch completion logging shows "complete" immediately

## Environment Variables Required

For early signals to work, ensure these are set in Supabase:
- `ANTHROPIC_API_KEY` - Claude API key (required)
- `BRAVRE_SEARCH_API_KEY` - Brave Search API key (optional, falls back to no search)
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role for database access

## Testing Early Signals Locally

```powershell
# Trigger early signals
$response = Invoke-WebRequest -Uri "https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function/scour-early-signals" `
  -Method POST `
  -Headers @{"Authorization"="Bearer $token"; "Content-Type"="application/json"} `
  -Body '{}' `
  -UseBasicParsing

$response.Content | ConvertFrom-Json
```

Then check logs in Supabase dashboard within 30 seconds of running.

## Timeline Analysis

If early signals completes in ~3 seconds, the flow is probably:

```
t=0.0s   - Request received
t=0.1s   - Brave search API call starts (10s timeout)
t=0.5s   - Brave returns results (or fails)
t=0.6s   - Claude API call starts (15s timeout)
t=1.0s   - Claude response received OR timeout (3 seconds total suggests early return)
t=1.1s   - JSON parsing or 0 alerts found
t=3.0s   - Response sent back with 0 results

PROBLEM: Actual early signals run should take 10-30+ seconds processing multiple queries
```

## Next Steps

1. **Run early signals** with the updated logging
2. **Check Supabase logs** for the [CLAUDE_DASHBOARD_LOG] and [CLAUDE_RESPONSE_DATA] messages
3. **Share the logs** showing which checkpoint is missing
4. **Post logs** starting from `[EARLY_SIGNAL_QUERY] Starting:` to identify where it stops

Example log you should see (for one query):
```
[EARLY_SIGNAL_QUERY] Starting: "earthquake today reported United States"
[CLAUDE_DASHBOARD_LOG] Query initiated: "earthquake today reported United States"
[CLAUDE_DASHBOARD_LOG] Brave Search API call for: "earthquake today reported United States"
[CLAUDE_DASHBOARD_LOG] Brave response received, status: 200
[CLAUDE_DASHBOARD_LOG] Brave returned 5 results
[CLAUDE_DASHBOARD_LOG] Sending 5 search results to Claude
[CLAUDE_DASHBOARD_LOG] About to fetch from Claude API with timeout 15s
[CLAUDE_DASHBOARD_LOG] Claude API response received, status: 200
[CLAUDE_DASHBOARD_LOG] Claude extraction complete
[CLAUDE_RESPONSE_DATA] Full response: {...json...}
[CLAUDE_RESPONSE_DATA] Content array found with 1 blocks
[CLAUDE_RESPONSE_DATA] Text block: [{...alert json...}]
[CLAUDE_RESPONSE_DATA] JSON match found, attempting parse...
[CLAUDE_DASHBOARD_LOG] Extracted 1 alerts
[EARLY_SIGNAL_FOUND] "earthquake today reported United States": 1 alerts
```

---

**Last Updated:** 2026-02-05  
**Deployed in Commit:** f802ed3  
**Status:** Awaiting log review to identify exact failure point
