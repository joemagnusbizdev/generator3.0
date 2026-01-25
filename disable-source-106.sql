-- Disable the hanging source and kill the stuck job

-- 1. Disable the problematic source:
UPDATE sources SET enabled = false WHERE id = '2dd7e50d-b0e7-4aa5-9a25-ba3dafdc6c5f';

-- 2. Kill the hanging scour job:
UPDATE scour_jobs 
SET status = 'failed', updated_at = now() 
WHERE status = 'running' 
AND created_at > now() - interval '1 day';

-- 3. Verify the changes:
SELECT id, name, url, enabled FROM sources WHERE id = '2dd7e50d-b0e7-4aa5-9a25-ba3dafdc6c5f';

SELECT id, status, total, processed, created FROM scour_jobs 
ORDER BY created_at DESC 
LIMIT 1;
