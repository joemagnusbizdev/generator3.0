# Early Signals Response Issue - Diagnostic & Fix Summary

**Date:** February 5, 2026  
**Issue:** Early signals returns 0 results in ~3 seconds; edge function shows requests sent to Claude but no response logged  
**Status:** 🔧 Diagnostic logging deployed; awaiting log review

## Problem Analysis

### User Report
- Early signals completes in 3 seconds (too fast)
- Returns 0 results consistently
- Edge function logs show Claude requests were sent
- **No logs showing Claude response or what data was returned**

### Initial Hypothesis
The issue is that Claude responses are not being logged or captured, making it impossible to diagnose whether:
1. Claude is timing out
2. Claude is returning empty arrays (no incidents found)
3. Claude is returning unexpected response format
4. Claude API key is not configured
5. Network error between Deno and Claude

## Solutions Implemented

### 1. Comprehensive Logging Added (Commit f802ed3)
Added detailed logging at every step of the `executeEarlySignalQuery()` function:

**File:** `supabase/functions/scour-worker/index.ts` (lines 1955-2168)

**Logging Checkpoints:**

```
[CLAUDE_DASHBOARD_LOG] Brave Search API call for: "{query}"
[CLAUDE_DASHBOARD_LOG] Brave response received, status: {status}
[CLAUDE_DASHBOARD_LOG] Brave returned {count} results
[CLAUDE_DASHBOARD_LOG] Sending {count} search results to Claude
[CLAUDE_DASHBOARD_LOG] About to fetch from Claude API with timeout 15s
[CLAUDE_DASHBOARD_LOG] Claude API response received, status: {status}
[CLAUDE_RESPONSE_DATA] Full response: {first 500 chars}
[CLAUDE_RESPONSE_DATA] Content array found with {count} blocks
[CLAUDE_RESPONSE_DATA] Text block: {first 300 chars}
[CLAUDE_RESPONSE_DATA] JSON match found, attempting parse...
[CLAUDE_DASHBOARD_LOG] Extracted {count} alerts
[EARLY_SIGNAL_ERROR] Query "{query}" failed with error: {error}
```

**Changes:**
- Added response status logging after Claude API call
- Logging of full Claude response (first 500 chars) for inspection
- Logging of text block extraction
- Logging of JSON parsing attempts
- Logging of failures with error messages and stack traces
- Better error handling with try-catch wrapper

### 2. Query Improvements (Commit 865b0aa)
Improved the base queries to be more travel-safety focused:

**Before:**
```typescript
"earthquake today reported"
"flood warning alert"
"protest breaking news"
```

**After:**
```typescript
"travel warning earthquake"
"travel alert flood warning"
"travel safety protest breaking news"
```

**Rationale:** Generic queries might return results that Claude correctly filters out as non-travel-safety incidents. Queries that explicitly include "travel" will get more relevant search results from Brave.

### 3. Debugging Guide Created (Commit 865b0aa)
Created [EARLY_SIGNALS_DEBUG_GUIDE.md](./EARLY_SIGNALS_DEBUG_GUIDE.md) with:
- Timeline analysis showing expected vs actual execution
- Specific log patterns for each failure scenario
- Environment variable checklist
- Testing instructions
- Interpretation guide for logs

## What to Look For Now

When you trigger early signals, check Supabase function logs for these patterns:

### ✅ Success Pattern (should see all of these)
```
[EARLY_SIGNAL_QUERY] Starting: "travel warning earthquake United States"
[CLAUDE_DASHBOARD_LOG] Query initiated...
[CLAUDE_DASHBOARD_LOG] Brave Search API call for...
[CLAUDE_DASHBOARD_LOG] Brave returned X results
[CLAUDE_DASHBOARD_LOG] Sending X search results to Claude
[CLAUDE_DASHBOARD_LOG] About to fetch from Claude API with timeout 15s
[CLAUDE_DASHBOARD_LOG] Claude API response received, status: 200
[CLAUDE_RESPONSE_DATA] Full response: {...}
[CLAUDE_RESPONSE_DATA] Content array found with 1 blocks
[CLAUDE_DASHBOARD_LOG] Extracted N alerts
```

### 🔴 Failure Patterns

**If logs stop at:**
```
[CLAUDE_DASHBOARD_LOG] About to fetch from Claude API
```
→ Claude API is timing out or blocking

**If you see:**
```
[CLAUDE_DASHBOARD_LOG] Claude API error: 401
```
→ `ANTHROPIC_API_KEY` is missing or invalid

**If you see:**
```
[CLAUDE_DASHBOARD_LOG] Claude API error: 429
```
→ Rate limited; need exponential backoff

**If you see:**
```
[CLAUDE_RESPONSE_DATA] No content array in response
```
→ Claude returned unexpected response format; check logged response

**If you see:**
```
[EARLY_SIGNAL_DONE] "{query}": 0 alerts (no matches found)
```
→ Claude legitimately found no travel safety incidents (check if this is correct)

## How to Test

### Quick Test
```powershell
# Trigger early signals
Invoke-WebRequest -Uri "https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function/scour-early-signals" `
  -Method POST `
  -Headers @{"Authorization"="Bearer <token>"} `
  -Body '{}' -UseBasicParsing | ConvertFrom-Json
```

### Monitor Logs
1. Go to [Supabase Functions Dashboard](https://supabase.com/dashboard/project/gnobnyzezkuyptuakztf/functions)
2. Click `scour-worker`
3. Watch realtime logs for the checkpoints above

### Interpret Results
- If you see `[CLAUDE_RESPONSE_DATA]` logs → Claude is responding, problem is response parsing
- If logs stop at "About to fetch" → Claude API is blocking
- If you see `[EARLY_SIGNAL_ERROR]` → Error details will show what went wrong

## Key Code Locations

| File | Lines | Purpose |
|------|-------|---------|
| scour-worker/index.ts | 1836-1925 | `runEarlySignals()` - orchestrates queries |
| scour-worker/index.ts | 1955-2168 | `executeEarlySignalQuery()` - single query with logging |
| scour-worker/index.ts | 1842-1851 | baseQueries array - customize here |

## Timeline

| Commit | Date | Change |
|--------|------|--------|
| f802ed3 | 2026-02-05 | Add comprehensive Claude API logging |
| 865b0aa | 2026-02-05 | Add debug guide + improve queries |

## Environment Verification

Confirmed set in Supabase:
- ✅ `ANTHROPIC_API_KEY` - Present (digest: `b0091f6...`)
- ✅ `BRAVRE_SEARCH_API_KEY` - Present (digest: `6b09ffd...`)

## Next Steps

1. **Trigger early signals** with the new logging
2. **Capture logs** from Supabase dashboard
3. **Look for where logs stop** (missing checkpoint)
4. **Share the log output** showing which checkpoint is missing
5. **Apply fix** based on which checkpoint is missing

Example: If logs show:
```
[CLAUDE_DASHBOARD_LOG] About to fetch from Claude API
[CLAUDE_DASHBOARD_LOG] Claude API response received, status: 200
[CLAUDE_RESPONSE_DATA] Full response: {"error": "overloaded"}
```

Then we know Claude is responding with errors and can handle accordingly.

---

**Status:** Waiting for log data to identify exact failure point  
**Estimated Fix Time:** <30 minutes once logs are reviewed
