-- Clean up stale alerts older than 14 days (created more than 14 days ago)
-- AND without ongoing events (event_end_date in future)
-- Run this to remove historical junk from the database

BEGIN;

-- Check what we're about to delete
SELECT COUNT(*) as stale_alerts_to_delete,
       COUNT(CASE WHEN event_end_date > NOW() THEN 1 END) as alerts_with_ongoing_events
FROM alerts
WHERE (created_at < NOW() - INTERVAL '14 days')
  AND (event_end_date IS NULL OR event_end_date <= NOW());

-- Delete stale draft alerts
DELETE FROM alerts
WHERE status = 'draft'
  AND (created_at < NOW() - INTERVAL '14 days')
  AND (event_end_date IS NULL OR event_end_date <= NOW());

-- Log summary
SELECT 'Deleted stale draft alerts created more than 14 days ago without ongoing events' as action;

COMMIT;
