# Supabase Migration: Add confidence_score field
# File: supabase/migrations/005_add_confidence_score.sql

## How to Apply the Migration:

### Option 1: Via Supabase Dashboard (Recommended for now)
1. Go to: https://supabase.com/dashboard/project/gnobnyzezkuyptuakztf/sql/new
2. Copy the SQL from `supabase/migrations/005_add_confidence_score.sql`
3. Paste into the SQL Editor
4. Click "Run"
5. Verify: "ALTER TABLE ... SUCCESS"

### Option 2: Via CLI (after Docker is running)
```bash
cd c:\Users\Joe Serkin\Documents\GitHub\generator3.0
npx supabase db push
```

## What the Migration Does:

1. Adds `confidence_score` column to alerts table
   - Type: NUMERIC (0.0-1.0)
   - Default: 0.5
   - Constraint: Enforced range check

2. Creates optimized indices:
   - Index on confidence_score for sorting/filtering draft alerts
   - Composite index for confidence categories

3. Adds documentation comment

## Verification After Migration:

Run in SQL Editor:
```sql
-- Check column exists
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'alerts' AND column_name = 'confidence_score';

-- Should return:
-- column_name       | data_type | column_default
-- ─────────────────────────────────────────────
-- confidence_score  | numeric   | 0.5

-- Check indices exist
SELECT indexname FROM pg_indexes 
WHERE tablename = 'alerts' AND indexname LIKE '%confidence%';

-- Should return:
-- idx_alerts_confidence_score
-- idx_alerts_confidence_category
```

## Next Steps:

1. Apply migration (above options)
2. Verify indices created
3. Confidence scoring is now active for all new/updated alerts
4. Test by creating a sample alert: confidence_score should be auto-calculated
