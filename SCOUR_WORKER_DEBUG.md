# Scour-Worker Debugging Guide

## Problem Statement
- User reports: "nothing happening in the scour-worker logs"
- Status bar shows: 1/679 → then 1/10 (fallback estimate)
- Expected: scour-worker to process sources in parallel with early signals

## Recent Changes & Fixes

### 1. Enhanced Logging in Clever-Function
- Added detailed console logs for scour-worker invocation
- Logs URL, response status, stats returned
- Logs any errors with stack traces
- All wrapped in try-catch with fallback error handling

### 2. Fixed Typo in Scour-Worker
- **FIXED**: `BRAVRE_SEARCH_API_KEY` → `BRAVE_SEARCH_API_KEY` (line 85)
- This was preventing Brave API from being loaded properly

### 3. Enhanced Scour-Worker Request Handler
- Added detailed console logs for all stages:
  - `🔵 [SCOUR-WORKER] Received request`
  - `🔵 [SCOUR-WORKER] Parsing body`
  - `🔵 [SCOUR-WORKER] Starting runScourWorker`
  - `🔵 [SCOUR-WORKER] Returning stats`
  - `🔴 [SCOUR-WORKER] Request error` (for failures)

### 4. Enhanced runScourWorker Logging
- Logs configuration with: jobId, sourceIds count, keys availability
- Logs at each major step for traceability

## How to Monitor Next Scour

### In Clever-Function Logs (check Supabase Dashboard)
Look for:
1. `🎯 SCOUR START REQUEST: jobId=...` - Scour initiated
2. `🔴 No source IDs provided` - if sourceIds empty
3. `🎯 SCOUR JOB CREATED: X sources to process` - Job created in KV
4. `🎯 Delegating to scour-worker edge function...` - About to call worker
5. `🎯 Scour-worker URL: ...` - The URL being called
6. `🎯 Fetching scour-worker...` - Request in flight
7. `🎯 Scour-worker response status: 200` - Response received

Then either:
- `✓ SCOUR COMPLETED via scour-worker: ...` - Success with stats
- `✗ SCOUR FAILED via scour-worker: ...` - Error with message

### In Scour-Worker Logs (check Supabase Dashboard)
Look for:
1. `🔵 [SCOUR-WORKER] Received request: POST /` - Request received
2. `🔵 [SCOUR-WORKER] Parsing request body...` - Body parsing
3. `🔵 [SCOUR-WORKER] Body received: jobId=..., sourceIds=...` - Config loaded
4. `🔵 [SCOUR-WORKER] Starting runScourWorker...` - Main function started
5. `🟢 [runScourWorker] STARTING with config...` - runScourWorker logging

Then for each source:
- `🚀 Starting Scour: X sources`
- `📊 Loading alerts... + trends`
- `📰 Processing: [source name]`
- `⚡ Triggering early signals`
- etc.

Finally:
- `✅ Scour completed: X created, Y skipped, Z duplicates`
- `🔵 [SCOUR-WORKER] Returning stats: {...}`

## Key Files Modified

### /supabase/functions/clever-function/index.ts
- **Lines 3527-3566**: Enhanced scour-worker invocation with async IIFE
- Now wraps fetch in proper async function with better error handling
- Logs URL being called, status codes, and full error messages

### /supabase/functions/scour-worker/index.ts
- **Line 85**: Fixed BRAVE_API_KEY env var reading (removed typo)
- **Lines 756-799**: Enhanced request handler with 🔵 🔴 emojis
- **Lines 510-520**: Enhanced runScourWorker entry logging

## Network Topology

```
Frontend (Vercel)
    ↓ (apiPostJson)
Clever-Function (/scour-sources endpoint)
    ↓ (waitUntil + fetch)
Scour-Worker (/POST handler)
    ↓ (parallel requests)
Supabase REST API (sources, alerts, app_kv tables)
    + OpenAI API (alert extraction)
    + Brave Search API (content fetching)
    + Web Scraping (fallback)
```

## Expected Behavior After Fix

1. User clicks "Start Scour"
2. Frontend calls `/scour-sources` with sourceIds
3. Clever-function:
   - Creates job in KV store with `total: sourceIds.length` (e.g., 679)
   - Calls scour-worker via fetch
   - Logs each step with timestamps
4. Scour-worker:
   - Receives config
   - Logs configuration
   - Processes each source in sequence
   - Runs early signals in PARALLEL (Promise.all)
   - Returns stats
5. Clever-function receives stats and updates KV
6. Frontend polls `/scour/status` every 2.5 seconds
7. Status bar shows accurate progress from KV store

## If Still Not Working

### Check 1: Verify Scour-Worker URL is Correct
- Expected: `https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/scour-worker`
- This is calculated as: `${supabaseUrl}/functions/v1/scour-worker`

### Check 2: Verify Authorization Header
- Brave-function must pass: `Authorization: Bearer ${serviceKey}`
- Service key should be the SUPABASE_SERVICE_ROLE_KEY env var

### Check 3: Verify Request Body Format
Scour-worker expects:
```json
{
  "jobId": "uuid",
  "sourceIds": ["id1", "id2", ...],
  "daysBack": 14,
  "supabaseUrl": "https://...",
  "serviceKey": "eyJ...",
  "openaiKey": "sk-...",
  "braveApiKey": "..."
}
```

### Check 4: Function Size
- Scour-worker might be timing out if too large
- Current: ~800 lines of TypeScript
- Should be within Supabase edge function limits (~20s execution)

### Check 5: Brave API Key Issue
- With the typo fix, Brave key should now load correctly
- If no Brave API key, early signals will skip silently (graceful fallback)

## Deployment Status
- ✅ Clever-function v307: Deployed with enhanced logging
- ✅ Scour-worker v2: Deployed with typo fix + enhanced logging
- ✅ Frontend v1.0: Built and deployed (no changes needed for this fix)

## Next Steps if Issue Persists

1. Check Supabase function logs for any 500 errors
2. Verify Deno runtime version compatibility
3. Check if serviceKey is properly loaded in both functions
4. Monitor network requests from frontend to see response times
5. Consider adding telemetry/metrics to track function performance

---

**Last Updated**: Jan 23, 2026
**Status**: Both functions deployed with logging enhancements ready for next scour test
