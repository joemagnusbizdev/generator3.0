# Phase 1.5 Implementation: Confidence Scoring (Factal-Style)

**Status**: ✅ Backend Complete, Awaiting Deployment

## Overview

Implemented Factal-style confidence scoring to measure alert publishability on a 0.0-1.0 scale. All new alerts are automatically scored based on source authority, data quality, and timing. No auto-publishing (human approval always required).

## What Was Implemented

### 1. Confidence Calculation Engine

**Location**: `supabase/functions/clever-function/index.ts` (Lines 194-295)

#### Key Functions:

- **`calculateConfidence(alert, source)`**: Computes confidence score
  - Base trust from source authority (0.5-0.95)
  - +0.1 for precise coordinates
  - +0.05 for event timing
  - +0.08 for official sources + critical/warning severity
  - +0.05 for high AI confidence
  - -0.2 for vague location
  - -0.15 for missing summary
  - -0.25 for stale data (>30 days)

- **`getSourceTrustScore(source)`**: Maps source type to authority score
  - USGS/USGS-Atom: 0.95 (highest)
  - NWS/CAP/NWS-CAP: 0.92
  - FAA/FAA-NAS/FAA-JSON: 0.90
  - NOAA/NOAA-Tropical: 0.90
  - RSS/Atom/Feed: 0.55
  - Default/Unknown: 0.50

- **`getConfidenceCategory(score)`**: Routes by confidence threshold
  - <0.4: `noise` (discard)
  - 0.4-0.59: `early-signal` (monitor)
  - 0.6-0.69: `review` (analyst review required)
  - 0.7-0.85: `publish` (publish when approved)
  - ≥0.85: `verified` (high confidence)

### 2. Integration Points

#### In `runScourWorker()` (Line 1665):
```typescript
// Calculate confidence score (Factal-style)
const confidenceScore = calculateConfidence(alert, source);
alert.confidence_score = confidenceScore;
const confidenceCategory = getConfidenceCategory(confidenceScore);

console.log(`    ?? Confidence: ${(confidenceScore * 100).toFixed(1)}% (${confidenceCategory})`);
```

#### In POST `/alerts` Endpoint (Line 2694):
```typescript
// Calculate confidence if not already provided
if (!alertData.confidence_score) {
  const tempAlert = alertData as Alert;
  alertData.confidence_score = calculateConfidence(tempAlert);
}
```

### 3. Data Model

#### Alert Interface Update:
```typescript
interface Alert {
  // ... existing fields ...
  confidence_score?: number;  // Factal-style confidence (0.0-1.0)
}
```

#### Database Migration:
File: `supabase/migrations/005_add_confidence_score.sql`
- Adds `confidence_score` NUMERIC column (default 0.5)
- Constraint: 0.0 ≤ score ≤ 1.0
- Index on `confidence_score DESC` for draft alerts
- Composite index for confidence categories

## Deployment Steps

### Step 1: Apply Database Migration

In Supabase SQL Editor (or via CLI):

```sql
-- Copy entire contents of supabase/migrations/005_add_confidence_score.sql and execute
```

Or via CLI:
```bash
npx supabase db push
```

### Step 2: Deploy Function Update

```bash
cd c:\Users\Joe Serkin\Documents\GitHub\generator3.0
npx supabase functions deploy clever-function --project-ref gnobnyzezkuyptuakztf
```

### Step 3: Verify Deployment

```powershell
# Health check
$uri = "https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function/health"
Invoke-WebRequest -Uri $uri | Select-Object StatusCode, Content
```

Expected response:
```json
{
  "ok": true,
  "time": "2026-01-22T...",
  "env": {
    "AI_ENABLED": true,
    "SCOUR_ENABLED": true,
    ...
  }
}
```

### Step 4: Test Alert Creation

Create a test alert via API:

```bash
curl -X POST https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function/alerts \
  -H "Authorization: Bearer YOUR_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Alert",
    "country": "United States",
    "location": "New York, NY",
    "summary": "Test summary for confidence scoring",
    "event_type": "Test",
    "severity": "caution",
    "source_url": "https://example.com",
    "ai_generated": false,
    "ai_model": "manual"
  }'
```

Expected: Response includes `confidence_score` field (e.g., 0.55-0.70 depending on data quality).

## How Confidence Scores Work

### Calculation Example 1: Official USGS Earthquake Alert
```
Base trust (USGS):         0.95
+ Precise coordinates:     +0.10
+ Event timing info:       +0.05
+ Official + warning:      +0.08
- Penalty (if any):        (none)
─────────────────────────
TOTAL:                     1.18 → clamped to 1.0
Category:                  "verified" (publish immediately upon approval)
```

### Calculation Example 2: Generic RSS Feed Alert
```
Base trust (RSS):          0.55
+ Rough location:          +0.05
+ No event dates:          (no boost)
+ No severity match:       (no boost)
- Vague location:          -0.05
─────────────────────────
TOTAL:                     0.55
Category:                  "early-signal" (monitor for 24-48h before publishing)
```

### Calculation Example 3: High-Quality AI Alert
```
Base trust (AI default):   0.50
+ Precise coordinates:     +0.10
+ Event timing:            +0.05
+ AI confidence > 0.7:     +0.05
- Missing summary:         (none, has summary)
─────────────────────────
TOTAL:                     0.70
Category:                  "publish" (analyst review, then publish)
```

## Frontend Changes (Coming)

### Display Confidence on Alert Cards

The frontend will show:
- **Confidence percentage** (e.g., "87% Confidence")
- **Category badge** (Verified / Publish / Review / Early Signal / Noise)
- **Trust factors breakdown** (optional detailed view)

Example UI:
```
┌─────────────────────────────────────────────┐
│ USGS Earthquake - Magnitude 5.8              │
│ California, United States                    │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│ Severity: ⚠️  Warning                        │
│ Confidence: ████████░ 87% [Verified] ✓      │
│ Source: USGS (Trust: 95%)                    │
│ [Approve] [Edit] [Dismiss]                  │
└─────────────────────────────────────────────┘
```

## Decision Workflow (Manual)

Since no auto-publishing is configured:

1. **Score < 0.4**: Analyst can dismiss (usually noise)
2. **Score 0.4-0.59**: Monitor for 24-48h, reassess
3. **Score 0.6-0.69**: Review for accuracy, missing data
4. **Score 0.7-0.85**: Approve for publishing (high quality)
5. **Score ≥ 0.85**: Approve with high confidence (official source)

## Phase 2+ Roadmap

### Phase 2: Event Clustering
- Group similar alerts by location + event_type + 7-day window
- Aggregate confidence across cluster
- Reduce false positives

### Phase 3: Analyst Workflow
- Add `lifecycle_state` field (candidate → triaged → confirmed → published → resolved)
- Create `analyst_reviews` table (analyst_id, reasoning, override_confidence, decision)
- Build analyst dashboard for review queue

### Phase 4: Audit Trail & ML Training
- Log all analyst decisions
- Use patterns for future ML confidence tuning
- Track override reasons

## Key Guarantees

✅ **No breaking changes**: All existing alerts continue to work
✅ **No auto-publishing**: All alerts require human approval
✅ **Backward compatible**: Old alerts without confidence_score work fine
✅ **Default safe**: Unknown sources = 0.5 confidence (moderate)
✅ **Configurable**: Thresholds can be adjusted per source type

## Testing Checklist

- [ ] Migrate database (005_add_confidence_score.sql applied)
- [ ] Deploy function update
- [ ] Health check returns 200 OK
- [ ] Create alert via POST /alerts → includes confidence_score
- [ ] Scour job creates alerts with confidence logged
- [ ] USGS alerts score ≥ 0.9
- [ ] RSS alerts score 0.5-0.65
- [ ] AI alerts score varies 0.5-0.8 based on quality

## Questions for Joe

1. ✅ **No auto-publish?** Confirmed - all alerts require approval
2. ✅ **Implement now?** Yes
3. ❌ **Track analyst overrides?** No
4. Coming: **Frontend display?** What confidence format do you prefer? (percentage, stars, bar, etc.)

---

**Implementation Status**: ✅ COMPLETE (Backend)
**Next Step**: Run database migration, deploy function, verify with test alert
