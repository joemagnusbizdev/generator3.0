-- Find sources near index 105-110 to identify which one is hanging
-- Run in Supabase SQL Editor

WITH numbered_sources AS (
  SELECT 
    ROW_NUMBER() OVER (ORDER BY id) as position,
    id,
    name,
    url,
    enabled,
    trust_score,
    created_at
  FROM sources
)
SELECT * FROM numbered_sources
WHERE position BETWEEN 100 AND 115
ORDER BY position;

-- Once you identify the problematic source, use these commands:
-- Replace 'SOURCE_ID_HERE' with the actual UUID from results above

-- 1. Disable it temporarily:
-- UPDATE sources SET enabled = false WHERE id = 'SOURCE_ID_HERE';

-- 2. Or delete it:
-- DELETE FROM sources WHERE id = 'SOURCE_ID_HERE';

-- 3. Check current scour job status:
-- SELECT * FROM scour_jobs 
-- ORDER BY created_at DESC 
-- LIMIT 1;

-- 4. Kill the hanging job (set status to failed):
-- UPDATE scour_jobs 
-- SET status = 'failed', updated_at = now() 
-- WHERE status = 'running' 
-- AND created_at > now() - interval '1 day';
