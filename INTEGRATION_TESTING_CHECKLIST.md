# Integration Testing Checklist

**Purpose:** Prevent backend endpoints from being deployed before frontend integration is complete.

## Before Creating New Backend Endpoint

- [ ] **Endpoint Purpose Clear** - What does this endpoint return? What does frontend send?
- [ ] **Frontend Code Exists** - Has frontend code been updated to call this endpoint?
- [ ] **Same Commit** - Both backend endpoint AND frontend caller are in the same commit
- [ ] **Parameter Format Match** - Is request body/query param format consistent?

## When Creating New Endpoint (Backend Dev)

```
✅ DO:
  1. Create endpoint in clever-function or scour-worker
  2. Add comprehensive logging: [ENDPOINT_NAME] Received request
  3. Test endpoint locally (if possible) or in Supabase dashboard
  4. Create response with standard format:
     {
       "ok": true/false,
       "data": { /* actual data */ },
       "error": "error message if ok=false"
     }

❌ DON'T:
  1. Deploy without frontend integration
  2. Use inconsistent response formats
  3. Return different fields in success vs error cases
  4. Deploy if you haven't tested with real frontend code
```

## When Integrating Frontend Call (Frontend Dev)

- [ ] **Endpoint Path Matches** - Frontend imports.meta.env.VITE_SUPABASE_URL matches backend URL
- [ ] **Request Format Correct** - Headers, body, query params match endpoint expectations
- [ ] **Response Handling** - Frontend knows what to do with response (success and error cases)
- [ ] **Error State** - What happens if endpoint returns error? Is UI properly handled?
- [ ] **Loading State** - Is there spinner/loading while waiting for response?

## Integration Test Checklist

Before merging ANY pull request that touches backend endpoints:

### 1. Build & Deploy
- [ ] `npm run build` succeeds with no errors
- [ ] Push to GitHub triggers Vercel build
- [ ] Wait 5 minutes for Vercel to complete
- [ ] `supabase functions deploy` completes successfully
- [ ] Check Supabase dashboard - no error messages in function logs

### 2. Browser Testing (Hard Refresh First - Ctrl+F5)
- [ ] Open DevTools (F12)
- [ ] Go to Network tab
- [ ] Trigger the feature in UI
- [ ] Check Network tab for correct endpoint URL
- [ ] Check response status (should be 200, not 404 or 500)
- [ ] Check response body - correct data returned?

### 3. Console Logs
- [ ] Open DevTools Console
- [ ] Trigger the feature
- [ ] Look for log messages from both frontend and backend
- [ ] Any errors shown? (red text)
- [ ] Check sequence: request logged → server processes → response received

### 4. Functional Test
- [ ] Does the feature work as expected?
- [ ] If it requires database action, check database - was it saved?
- [ ] Are all UI elements updating correctly?
- [ ] Try edge case (empty data, errors, etc.)

## Common Integration Issues

| Issue | Frontend | Backend | Fix |
|-------|----------|---------|-----|
| `404 Not Found` | Calling `/scour/status` | Endpoint checks `startsWith()` which doesn't match full path | Use `includes()` or `endsWith()` |
| `job=NULL` in response | Polling expects `.job` field | Endpoint returns different structure | Standardize response format |
| Continuous "Job queued..." | No check for stopped jobs | Polling loop never breaks | Check `runningGroupIds` each iteration |
| Blank UI, no updates | Cache has old code | Vercel not fully deployed | Hard refresh (Ctrl+F5) or wait longer |

## Sign-Off

- [ ] Both backend AND frontend code reviewed
- [ ] Both in same commit
- [ ] All tests passed
- [ ] Operator can use feature without errors
- [ ] Ready to merge
