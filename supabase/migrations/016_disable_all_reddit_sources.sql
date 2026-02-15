-- Disable all Reddit sources instead of deleting them
-- This allows recovery if needed later

BEGIN;

UPDATE sources
SET enabled = false
WHERE type = 'reddit' OR name ILIKE 'Reddit%';

-- Verify
SELECT COUNT(*) as reddit_sources_disabled
FROM sources
WHERE (type = 'reddit' OR name ILIKE 'Reddit%') AND enabled = false;

COMMIT;
