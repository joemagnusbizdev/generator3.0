# ✅ Phase 1.5 Deployment Checklist

**Date**: January 22, 2026  
**Implementation**: Complete ✅  
**Deployment**: In Progress ⏳

---

## Pre-Deployment Verification ✅

### Backend
- [x] Confidence calculation function implemented
- [x] Source trust scoring logic added
- [x] Integration into runScourWorker() completed
- [x] Integration into POST /alerts endpoint completed
- [x] Alert interface updated with confidence_score field
- [x] TypeScript type checking: 0 errors
- [x] Function deployed to production (gnobnyzezkuyptuakztf)
- [x] Health endpoint returns 200 OK
- [x] All env vars present (AI_ENABLED, SCOUR_ENABLED, etc.)

### Frontend
- [x] ConfidenceBadge component created
- [x] Component integrated into AlertReviewQueueInline
- [x] Color-coded display (5 confidence levels)
- [x] Emoji indicators added
- [x] Responsive design
- [x] TypeScript type checking: 0 errors
- [x] Alert interface updated

### Database
- [x] Migration script created (005_add_confidence_score.sql)
- [x] Migration uses IF NOT EXISTS (safe/idempotent)
- [x] Confidence_score column defined (NUMERIC, 0.0-1.0)
- [x] CHECK constraint included
- [x] Indices created for filtering
- [x] Documentation comments added

### Documentation
- [x] IMMEDIATE_ACTION_ITEMS.md created
- [x] PHASE_1_5_COMPLETE.md created
- [x] PHASE_1_5_DEPLOYMENT_SUMMARY.md created
- [x] PHASE_1_5_IMPLEMENTATION.md created
- [x] CONFIDENCE_SCORING_GUIDE.md created
- [x] MIGRATION_INSTRUCTIONS.md created

---

## Immediate Deployment Steps

### Step 1: Apply Database Migration ⏳ **DO THIS FIRST**

**Via Supabase Dashboard (Recommended)**:
1. [ ] Navigate to: https://supabase.com/dashboard/project/gnobnyzezkuyptuakztf/sql/new
2. [ ] Open file: `supabase/migrations/005_add_confidence_score.sql`
3. [ ] Copy all 25 lines
4. [ ] Paste into Supabase SQL Editor
5. [ ] Click "Run" button
6. [ ] Verify: See "ALTER TABLE ... SUCCESS" message

**Or via CLI** (when Docker is available):
```bash
cd "C:\Users\Joe Serkin\Documents\GitHub\generator3.0"
npx supabase db push
```

### Step 2: Verify Migration Success

In Supabase SQL Editor, run:

```sql
-- Verify column exists
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'alerts' AND column_name = 'confidence_score';

-- Expected: One row showing confidence_score | numeric | 0.5
```

**Success Criteria**: Column is `numeric` type, default is `0.5`

### Step 3: Verify Indices Created

```sql
SELECT indexname FROM pg_indexes 
WHERE tablename = 'alerts' AND indexname LIKE '%confidence%';

-- Expected: Two rows:
--   idx_alerts_confidence_score
--   idx_alerts_confidence_category
```

**Success Criteria**: Both indices exist

---

## Testing & Validation

### Test 1: Create High-Confidence Alert

```bash
curl -X POST https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function/alerts \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test High Confidence Alert",
    "country": "United States",
    "location": "San Francisco, CA",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "summary": "A test alert with complete data",
    "event_type": "Test Event",
    "severity": "warning",
    "source_url": "https://example.com",
    "event_start_date": "2026-01-22T12:00:00Z",
    "ai_generated": false,
    "ai_model": "manual"
  }'
```

**Success Criteria**:
- [ ] HTTP 200 response
- [ ] Response includes `"confidence_score": 0.7` to `0.8`
- [ ] ✅ Confidence score in response = migration worked

### Test 2: Create Low-Confidence Alert

```bash
curl -X POST https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function/alerts \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Low Confidence",
    "country": "Unknown",
    "location": "?",
    "summary": "No details",
    "event_type": "Unknown",
    "severity": "informative",
    "source_url": "https://example.com",
    "ai_generated": false,
    "ai_model": "manual"
  }'
```

**Success Criteria**:
- [ ] HTTP 200 response
- [ ] Response includes `"confidence_score": 0.2` to `0.35`
- [ ] ✅ Low score for poor quality data = calculation working

### Test 3: Frontend Display

1. [ ] Open Scour dashboard/review queue
2. [ ] Look for your test alerts
3. [ ] High confidence alert shows: **"✓ 73% Publish"** (or similar green badge)
4. [ ] Low confidence alert shows: **"❌ 28% Noise"** (or similar red badge)
5. [ ] ✅ Badges visible and correct = frontend working

### Test 4: Database Query

```sql
-- Check alerts have confidence scores
SELECT id, title, confidence_score, status 
FROM alerts 
WHERE created_at > now() - interval '1 hour' 
LIMIT 5;

-- Expected: confidence_score column populated with numeric values 0.0-1.0
```

**Success Criteria**:
- [ ] Query returns results
- [ ] confidence_score column shows numeric values
- [ ] Values are between 0.0 and 1.0

---

## Deployment Checklist

| Item | Status | Verified |
|------|--------|----------|
| Backend function deployed | ✅ | Yes, health 200 OK |
| Frontend component ready | ✅ | Yes, no TS errors |
| Database migration created | ✅ | Yes, reviewed |
| Documentation complete | ✅ | Yes, 6 guides |
| **Migration applied** | ⏳ | **PENDING** |
| **Test 1: High confidence** | ⏳ | **PENDING** |
| **Test 2: Low confidence** | ⏳ | **PENDING** |
| **Test 3: Frontend display** | ⏳ | **PENDING** |
| **Test 4: DB query** | ⏳ | **PENDING** |
| Team trained | ⏳ | Share CONFIDENCE_SCORING_GUIDE.md |
| Production verified | ⏳ | Monitor in Supabase dashboard |

---

## Rollback Plan (If Needed)

**Safe to reverse**:
```sql
-- If something goes wrong, this safely removes the feature
ALTER TABLE alerts DROP COLUMN IF EXISTS confidence_score CASCADE;
DROP INDEX IF EXISTS idx_alerts_confidence_score;
DROP INDEX IF EXISTS idx_alerts_confidence_category;

-- Alert function stops calculating confidence
-- Frontend component handles NULL gracefully
-- Zero data loss (backward compatible)
```

---

## Production Monitoring

After deployment, monitor:

1. **Function Logs**: https://supabase.com/dashboard/project/gnobnyzezkuyptuakztf/functions
   - Should see: "Confidence: XX% (category)" for each alert

2. **Database Health**: https://supabase.com/dashboard/project/gnobnyzezkuyptuakztf/database
   - Monitor index performance if needed

3. **API Metrics**: Response times should be unchanged (<100ms for confidence calculation)

---

## Sign-Off

- [ ] Backend deployed ✅ (already done)
- [ ] Frontend ready ✅ (already done)
- [ ] Migration applied ⏳ (your action)
- [ ] Tests passed ⏳ (your validation)
- [ ] Team trained ⏳ (share docs)
- [ ] Production monitoring active ⏳ (verify daily)

---

## Timeline

| Phase | Effort | Status |
|-------|--------|--------|
| Implementation | ~2 hours | ✅ Complete |
| Backend Deploy | ~5 min | ✅ Complete |
| Frontend Ready | ~0 min | ✅ Ready |
| **Database Migration** | ~5 min | ⏳ **Pending** |
| **Testing** | ~10 min | ⏳ **Pending** |
| **Production Verification** | ~5 min | ⏳ **Pending** |
| **Total remaining** | **~20 min** | ⏳ |

**Estimated Time to Live**: 20 minutes (mostly migration and testing)

---

## Next Actions (In Order)

1. [ ] Read IMMEDIATE_ACTION_ITEMS.md
2. [ ] Apply database migration via Supabase SQL Editor
3. [ ] Run verification queries
4. [ ] Create test alerts (high and low confidence)
5. [ ] Verify ConfidenceBadge displays on frontend
6. [ ] Share CONFIDENCE_SCORING_GUIDE.md with analyst team
7. [ ] Monitor Supabase logs for 24 hours
8. [ ] Adjust thresholds if needed (easy config change)

---

## Success Criteria

✅ **Deployment is successful when:**
1. Database migration applied without errors
2. New alerts include confidence_score in database
3. API responses include confidence_score field
4. Frontend displays ConfidenceBadge correctly
5. Analyst team understands confidence levels
6. No increase in function response time
7. No data loss or corruption

---

**Status**: Implementation complete, deployment in progress  
**Owner**: Joe Serkin  
**Date**: January 22, 2026  
**Next Review**: After migration applied

---

## Quick Links

| Resource | Link |
|----------|------|
| Supabase SQL Editor | https://supabase.com/dashboard/project/gnobnyzezkuyptuakztf/sql/new |
| Function Dashboard | https://supabase.com/dashboard/project/gnobnyzezkuyptuakztf/functions |
| Database Browser | https://supabase.com/dashboard/project/gnobnyzezkuyptuakztf/database |
| Implementation Guide | PHASE_1_5_IMPLEMENTATION.md |
| Analyst Guide | CONFIDENCE_SCORING_GUIDE.md |
| Action Items | IMMEDIATE_ACTION_ITEMS.md |
