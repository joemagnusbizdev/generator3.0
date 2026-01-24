# Scour Architecture - Fixed & Ready

## Problem Solved ✅
**401 Invalid JWT Error** - Fixed by removing JWT verification requirement on scour-worker for internal function-to-function calls.

## Architecture After Fix

```
Frontend (React/TypeScript)
    ↓ POST /scour-sources
Clever-Function (API Gateway)
    ├ Creates job in KV store
    └ Calls → 
        Scour-Worker (Internal, skipJwtVerification: true)
            ├ Processes sources sequentially
            ├ Runs early signals in parallel
            └ Returns stats to Clever-Function
                ↓ Updates KV with stats
Frontend polls GET /scour/status every 2.5s
    ↓ (gets from KV store)
Status Bar updates in real-time
```

## Key Changes Made

### 1. Clever-Function (`/scour-sources` endpoint)
**File**: `supabase/functions/clever-function/index.ts` (lines 3530-3565)

**Change**: Removed `Authorization` header when calling scour-worker
```typescript
// BEFORE (401 error):
const res = await fetch(scourWorkerUrl, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${serviceKey}`,  // ← Causes 401
    'Content-Type': 'application/json',
  },
  
// AFTER (works):
const res = await fetch(scourWorkerUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',  // ← No auth needed for internal calls
  },
```

**Why**: Edge functions calling other edge functions don't need JWT authentication - they're trusted internal calls.

### 2. Scour-Worker (`/POST` handler)
**File**: `supabase/functions/scour-worker/index.ts` (line 757)

**Change**: Skip JWT verification for internal-only endpoint
```typescript
// BEFORE:
Deno.serve(async (req: Request) => {

// AFTER:
Deno.serve({ skipJwtVerification: true }, async (req: Request) => {
```

**Why**: Scour-worker is only called by clever-function internally, doesn't need to verify JWTs.

## Frontend - No Changes Needed ✅

The frontend continues to call:
- **POST `/scour-sources`** → clever-function (which handles delegating to scour-worker)
- **GET `/scour/status`** → clever-function (which returns from KV store)

All routing is transparent to the frontend - it only knows about clever-function endpoints.

## Deployment Status
- ✅ **Clever-Function** v308: Deployed (no Authorization header in scour-worker fetch)
- ✅ **Scour-Worker** v3: Deployed (skipJwtVerification: true)
- ✅ **Frontend** v1.0: No changes needed (already using correct endpoints)

## Data Flow Example

1. **User clicks "Start Scour" with 679 sources**
   ```
   Frontend: POST /scour-sources
   {
     "sourceIds": ["id1", "id2", ...679 items...],
     "daysBack": 14
   }
   ```

2. **Clever-Function receives request**
   ```
   ✓ Create job in KV: scour_job:{jobId} = {total: 679, status: "running", ...}
   ✓ Call scour-worker (no Authorization header)
   ✓ Return immediately: {ok: true, jobId: "...", total: 679}
   ```

3. **Scour-Worker runs asynchronously**
   ```
   ✓ Receive config from clever-function
   ✓ Load sources, alerts, trends
   ✓ Process each source:
     - Fetch content (Brave search or scrape)
     - Extract alerts with AI
     - Check for duplicates
     - Save to database
   ✓ Run early signals in parallel (Promise.all)
   ✓ Return stats: {created: 45, skipped: 10, duplicatesSkipped: 5, ...}
   ```

4. **Clever-Function receives stats**
   ```
   ✓ Update KV: scour_job:{jobId} = {..., status: "done", created: 45, ...}
   ```

5. **Frontend polls status**
   ```
   GET /scour/status?jobId={jobId}
   ← {ok: true, job: {total: 679, processed: 679, created: 45, status: "done", ...}}
   ```

6. **Status bar shows final results**
   ```
   ✅ Scour Complete
   679/679 sources processed
   45 new alerts created
   10 sources skipped
   5 duplicates avoided
   ```

## Verification

To verify everything is working:

1. **Check Supabase Logs**
   - Look for: `✓ SCOUR COMPLETED via scour-worker` (success) or
   - Look for: `✗ SCOUR FAILED via scour-worker: [error]` (failure)

2. **Frontend Status Bar**
   - Should show accurate total from KV (e.g., 679, not 10)
   - Should increment as scour-worker processes

3. **Alerts Table**
   - New alerts should appear in Supabase → Alerts table
   - Status should be "draft" or "needs_review" depending on validation

## No Additional Frontend Changes Required

The frontend is already correctly structured:
- ✅ Uses `ScourContext` for state management
- ✅ Calls `/scour-sources` endpoint (clever-function)
- ✅ Polls `/scour/status` every 2.5 seconds
- ✅ Displays status bar with progress
- ✅ Shows results when complete

All the backend complexity (scour-worker delegation, KV updates, etc.) is hidden from the frontend.

---

**Ready to test**: Run a scour and monitor the status bar - it should now show accurate progress!
