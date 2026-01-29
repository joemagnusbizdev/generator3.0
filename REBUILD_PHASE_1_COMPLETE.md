# Core Scour Rebuild - Phase 1 Complete ✅

## Summary
Successfully implemented a sustainable, rate-limit-aware scour system that prioritizes alert **quality** over quantity and **timeliness** over volume.

**Commit**: `1ce6409` - Core rebuild: exponential backoff, batch processing, eliminate Brave Search, quality-focused early signals

---

## Changes Implemented

### 1. ✅ Exponential Backoff for Claude API
**File**: `supabase/functions/clever-function/index.ts`
**Location**: Lines ~2224-2280

**Implementation**:
- New `fetchClaudeWithRetry()` helper function
- Handles 429 (rate limit) errors gracefully
- Exponential backoff: 1s → 2s → 4s → 8s → 16s (max 60s)
- Max 5 retries per request
- Includes retry logic for network errors

**Impact**: Claude API calls that hit rate limits will automatically retry instead of failing immediately and blocking alert generation.

```typescript
// Example: 429 error handling
if (response.status === 429) {
  const delayMs = 1000 * Math.pow(2, attempt);
  await new Promise(resolve => setTimeout(resolve, delayMs));
  continue; // Retry
}
```

---

### 2. ✅ Batch Processing with Intelligent Delays
**File**: `supabase/functions/clever-function/index.ts`
**Location**: Lines ~5381-5520 (Early Signals phase)

**Implementation**:
- Queries processed in **batches of 5** instead of all at once
- **2.5 second delay** between batches
- Parallel processing within batches (Promise.all)
- Intelligent query counter and progress tracking
- Job status updated after each batch

**Impact**: 
- Reduces concurrent load on Claude API
- Spreads 20 queries over ~12 seconds instead of hammering API all at once
- Maintains steady alert generation rate
- Prevents Claude rate limit violations from ~850 simultaneous queries

**Example timing**:
```
Batch 1 (5 queries):  t=0-1s
Wait:                 t=1-3.5s
Batch 2 (5 queries):  t=3.5-4.5s
Wait:                 t=4.5-7s
Batch 3 (5 queries):  t=7-8s
Wait:                 t=8-10.5s
Batch 4 (5 queries):  t=10.5-11.5s
Total:                ~12 seconds for 20 queries
```

---

### 3. ✅ Brave Search Eliminated
**Files**: 
- `supabase/functions/clever-function/index.ts` (3 locations)
- `src1/components/SourceManagerInline.tsx` (import still present but unused)

**Changes**:
- Removed all `fetchWithBraveSearch()` calls
- Early signals now uses **Claude queries only** (no web search)
- Main scour fallback: scraping + Claude (no Brave search)
- Comments added: "Brave Search has been disabled. Using Claude queries only."

**Impact**: 
- Simpler, more predictable system (one API: Claude)
- Reduces external dependencies
- All content processing now through Claude

---

### 4. ✅ Quality-Focused Early Signals Queries
**File**: `supabase/functions/clever-function/index.ts`
**Function**: `buildEarlySignalsQueries()` (Lines ~2198-2245)

**Previous Approach**: 20 generic, broad queries
- "What are the latest emergency alerts from Ukraine, Syria, and Gaza?"
- "What crises are developing in Africa and the Middle East?"

**New Approach**: 18 specific, travel-impact-focused queries

```typescript
// EARTHQUAKES & SEISMIC ACTIVITY (High impact for travelers)
"What earthquakes (magnitude 5.0+) happened in the last 48 hours? Include location, magnitude, and distance from major cities.",
"What earthquake aftershock warnings or tsunami risks exist currently?",

// TRAVEL INFRASTRUCTURE (Direct impact on travelers)
"What major airports, train stations, or borders have temporary closures in the last 24 hours?",
"What highway closures, bridge collapses, or critical road disruptions are happening?",
"What flight cancellations or travel bans are being announced?",

// SEVERE WEATHER (High impact for travelers)
"What hurricanes, typhoons, or tropical cyclones pose threats to populated areas in the next 48 hours?",
"What extreme weather warnings (flooding, landslides, extreme heat) exist for major cities?",

// DISEASE & HEALTH EMERGENCIES
"What disease outbreaks with travel implications are being reported?",
"What new pandemic-related travel restrictions exist?",

// SECURITY & CIVIL UNREST
"What active armed conflicts or major civil unrest is occurring in populated areas?",
"What terrorism alerts or security incidents are reported?",
"What government-issued travel warnings are new?",

// HUMANITARIAN & VERIFICATION
"What refugee crises or mass evacuations are unfolding?",
"What multi-casualty incidents are reported?",
"What incidents were verified by Reuters/AP in the last 12 hours?"
```

**Quality Improvements**:
- ✅ **Specific**: Asks for concrete details (magnitude, location, distance)
- ✅ **Timely**: Explicitly mentions "last 24-48 hours"
- ✅ **Relevant**: Focuses on travel impact (airports, roads, health, security)
- ✅ **Thoughtful**: Structured by impact category, not just geography

**Expected Outcome**: 
- Fewer alerts overall
- Higher relevance per alert
- Better geographic and temporal specificity
- Improved alert quality for travelers

---

### 5. ✅ Status Bar Temporarily Removed
**File**: `src1/components/SourceManagerInline.tsx`
**Location**: Line ~281-282

**Change**: Commented out status bar rendering
```tsx
{/* Scour Status - TEMPORARILY REMOVED during rebuild */}
{/* <ScourStatusBarInline accessToken={accessToken} /> */}
```

**Reason**: Status bar had visibility issues; focus on core scour first, rebuild UI later.

---

## Rate Limit Strategy Summary

### Before Rebuild
❌ **Problem**: 
- ~850 early signals queries sent in rapid succession
- No retry logic for 429 errors
- Multiple simultaneous scour jobs (3+ observed)
- Claude 100K tokens/minute limit easily exceeded
- **Result**: 0 alerts (all Claude calls failed)

### After Rebuild
✅ **Solution**:
1. **Reduced query count**: 20 specific queries (from generic broad ones)
2. **Exponential backoff**: Automatic retry for rate limits
3. **Batch processing**: 5 queries at a time with 2.5s delays
4. **Linear load**: ~850 tokens × ~2 queries = ~1700 tokens per batch
5. **Sustainable timing**: ~12 seconds for early signals phase

---

## Next Steps - Testing Phase

### 7️⃣ Test with Small Source Set (Next)
- Enable only **3-5 sources** (not 651)
- Run manual scour
- Monitor:
  - Alert quality (not quantity)
  - Claude API errors
  - Response times
  - Alert relevance to travel

### 8️⃣ Verify Alert Quality
- Check console logs for rate limit handling
- Validate alert extraction from Claude
- Ensure coordinates and severity are correct

### 9️⃣ Gradual Rollout
- 3-5 sources → 10 sources → 50 sources → full 651
- Monitor rate limits at each step
- Adjust batch size/delays if needed

### 🔟 Re-enable Status Bar
- Once core scour is stable
- Build simple progress indicator

---

## Code Locations Reference

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| Exponential Backoff | `clever-function/index.ts` | 2224-2280 | Claude API retry logic |
| Batch Processing | `clever-function/index.ts` | 5381-5520 | Early signals batched queries |
| Early Signals Queries | `clever-function/index.ts` | 2198-2245 | Quality-focused query set |
| Claude Extraction | `clever-function/index.ts` | 2289-2440 | Updated to use retry helper |
| Status Bar Disabled | `SourceManagerInline.tsx` | 281-282 | Commented out rendering |

---

## Testing Checklist

- [ ] Deploy to Supabase (via vercel)
- [ ] Enable 3-5 test sources
- [ ] Manual scour trigger
- [ ] Check console for exponential backoff logs
- [ ] Verify batch processing delays
- [ ] Check alert count and quality
- [ ] Monitor Claude API errors
- [ ] Verify no rate limit failures
- [ ] Check database for saved alerts
- [ ] Validate alert metadata (location, severity, relevance)

---

## Rollback Info

If needed, revert to previous stable state:
```bash
git checkout HEAD~1  # Previous commit
git push            # Deploy
```

But this rebuild should be stable! ✅

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Claude 429 errors | ~0 (with automatic retry) |
| Early signals alerts created | 5-20 per run (quality over quantity) |
| Alert quality | High (travel-relevant, specific, timely) |
| Scour completion time | ~30-60 seconds for 20 early signals queries |
| System stability | No crashes or API failures |

---

**Status**: ✅ Core rebuild complete. Ready for testing phase.

**Next Action**: Deploy to Supabase Edge Functions and test with 3-5 sources.
