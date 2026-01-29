-- Check current scour job status
SELECT 
  key,
  value->>'id' as job_id,
  value->>'status' as status,
  value->>'processed' as processed,
  value->>'total' as total,
  value->>'created' as alerts_created,
  value->>'currentSource' as current_source,
  value->>'startedAt' as started_at,
  value->>'updated_at' as updated_at
FROM app_kv 
WHERE key LIKE 'scour_job:%'
ORDER BY value->>'updated_at' DESC;
