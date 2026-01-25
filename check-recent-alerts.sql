-- Check for recently created alerts
SELECT 
  id,
  title,
  TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
  TO_CHAR(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at,
  status,
  ai_generated,
  location,
  country
FROM alerts
ORDER BY created_at DESC
LIMIT 20;

-- Count by status to see activity
SELECT 
  status,
  ai_generated,
  COUNT(*) as count,
  MAX(created_at) as latest
FROM alerts
GROUP BY status, ai_generated
ORDER BY latest DESC;

-- Count total alerts created in last 24 hours
SELECT 
  COUNT(*) as alerts_last_24h,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM alerts
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Check if any alerts exist from TODAY (Jan 25)
SELECT 
  COUNT(*) as alerts_today,
  MIN(created_at) as oldest_today,
  MAX(created_at) as newest_today
FROM alerts
WHERE DATE(created_at) = CURRENT_DATE;
