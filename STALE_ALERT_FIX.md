# Stale Alert Cleanup Guide

## The Problem

You're seeing 3-4 year old alerts despite implementing 7-day validation thresholds. This is **NOT a bug in the new validation logic** — it's because:

1. **Old alerts already exist in the database** from before date validation was added
2. The new 7-day validation **prevents NEW old alerts** from being created
3. But it doesn't automatically remove **EXISTING old alerts** that are already stored

## Solution

### Phase 1: Immediate (Deployed)
✅ **Server-side filtering in `/alerts/review` endpoint** (commit a45fd83)
- Review queue now filters out stale alerts at response time
- Only shows:
  - Alerts from last 14 days, OR
  - Alerts with ongoing events (`event_end_date` > now)
- Rejects display of 3-4 year old alerts

### Phase 2: Permanent (Optional Cleanup)
📋 **Database cleanup migration: `cleanup-stale-alerts.sql`**

To permanently remove old junk from the database:

```bash
# Method 1: Using Supabase CLI
supabase db push < cleanup-stale-alerts.sql

# Method 2: Using psql directly
psql "postgresql://postgres:PASSWORD@db.XXX.supabase.co:5432/postgres" < cleanup-stale-alerts.sql

# Method 3: Via Supabase Dashboard
# SQL Editor > New Query > Copy contents of cleanup-stale-alerts.sql > Run
```

**What it does:**
- Deletes draft alerts created >14 days ago
- WITHOUT ongoing events (event_end_date in future)
- Keeps alerts with active/ongoing events

## Timeline of Fixes

| Date | Issue | Fix | Status |
|------|-------|-----|--------|
| Phase 1 | Early signals: 0 results, Claude 404 | Fixed Claude model name | ✅ |
| Phase 1 | Early signals: 2020 COVID alerts in 2026 | Added 60-day date check | ✅ |
| Phase 1 | Early signals: no source URLs | Required source URLs, filtered social media | ✅ |
| Phase 2 | General scour: 60-day threshold too loose | Reduced to 7 days, reject in postProcessing | ✅ |
| Phase 3 | Review queue: showing 3-4 year old alerts | Server-side filtering + cleanup migration | ✅ |

## How to Verify

1. **Check review queue** - should show only recent alerts
2. **Run a fresh scour** - will only create new 7-day-recent alerts
3. **(Optional) Run cleanup SQL** - to permanently remove old data

## Code Changes Summary

### scour-worker/index.ts
- ✅ Validation threshold: 60 days → 7 days
- ✅ Rejects stale events before saving
- ✅ Claude prompts updated to REJECT >7 day events
- ✅ URL domain validation (no social media)

### clever-function/index.ts
- ✅ `/alerts/review` endpoint now filters stale alerts
- ✅ Keeps ongoing events (future end_date)
- ✅ Server-side enforcement (not just frontend)

### cleanup-stale-alerts.sql
- ✅ Migration to permanently delete old alerts
- ✅ Safe: only affects draft alerts >14 days old without ongoing events
