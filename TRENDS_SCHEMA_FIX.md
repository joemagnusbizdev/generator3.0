# Trends Table Schema Fix

## Problem
The Trends API was returning error 500:
```
"Could not find the 'category' column of 'trends' in the schema cache"
```

## Root Cause
The `trends` table in the database had a different schema than what the API was expecting:
- **API expects**: `category`, `country`, `count`, `highest_severity`, `alert_ids`, `last_seen_at`
- **Database had**: `title`, `description`, `event_type`, `severity`, `first_seen`, `last_seen`

This mismatch occurred because:
1. The original `001_complete_schema.sql` created a trends table with the wrong columns
2. The newer `20240101000000_create_trends_table.sql` migration was meant to fix this, but didn't drop and recreate the table

## Solution
We've updated the migrations to:

### 1. Fixed `001_complete_schema.sql`
- Removed the old trends table creation (lines 110-156)
- Added a comment noting that trends table is created in separate migration
- Made all RLS policies idempotent with `DROP POLICY IF EXISTS` before creating

### 2. Updated `20240101000000_create_trends_table.sql`
- Now drops the existing trends table with `DROP TABLE IF EXISTS trends CASCADE`
- Creates the table with correct schema (category, country, count, highest_severity, alert_ids, last_seen_at)
- Disables RLS initially, then re-enables with proper policies
- Adds all required indexes and triggers
- Restores the foreign key from alerts table

### 3. Fixed `002_reddit_sources.sql`
- Commented out the entire migration as it references the deprecated "query" column
- Kept the file for migration history

## How to Apply

### Option A: Automated (Preferred)
Wait for the migration pipeline to complete:
```bash
supabase db push
```

### Option B: Manual (If migrations are stuck)
1. Go to: https://supabase.com/dashboard → SQL Editor → New Query
2. Copy and run the contents of `TRENDS_FIX_MANUAL.sql`
3. Then call the rebuild endpoint

## Verification

After the fix is applied, test with:

```bash
# Test rebuild trends
curl -X POST https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function/trends/rebuild \
  -H "Content-Type: application/json" \
  -d '{}'

# Should return: {"ok":true,"created":X,"windowDays":14,"minAlerts":3}
# Or: {"ok":true,"created":0,"windowDays":14,"minAlerts":3} if no dismissed alerts
```

## Next Steps

1. Dismissed alerts (status = 'dismissed') from the last 14 days will be grouped by country + event_type
2. Any group with 3+ alerts will be aggregated into a trend
3. Trends appear in the Trends view dashboard
4. Users can generate reports on trends using Claude AI

## Files Modified
- `supabase/migrations/001_complete_schema.sql` - Fixed RLS policies, removed old trends creation
- `supabase/migrations/20240101000000_create_trends_table.sql` - Now drops and recreates with correct schema
- `supabase/migrations/002_reddit_sources.sql` - Deprecated, commented out

## API Endpoints
- `POST /trends/rebuild` - Aggregate dismissed alerts into trends
- `GET /trends` - List all trends
- `GET /trends/:id/alerts` - Get alerts for a specific trend
- `POST /trends/:id/generate-report` - Generate Claude report
- `DELETE /trends/:id` - Delete a trend
