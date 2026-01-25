-- Check if any alerts were saved in the last 30 minutes
SELECT 
  id,
  title,
  location,
  country,
  status,
  ai_generated,
  created_at,
  source_url
FROM alerts
WHERE created_at > NOW() - INTERVAL '30 minutes'
ORDER BY created_at DESC
LIMIT 50;

-- If no results above, check all alerts to see what's in database
SELECT COUNT(*) as total_alerts FROM alerts;
SELECT COUNT(*) as draft_alerts FROM alerts WHERE status = 'draft';
SELECT COUNT(*) as ai_generated_alerts FROM alerts WHERE ai_generated = true;
