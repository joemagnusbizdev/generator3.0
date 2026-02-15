-- Delete all Reddit sources from the database
-- This removes all sources with type='reddit' or name like 'Reddit%'

BEGIN;

-- Count before deletion
SELECT COUNT(*) as reddit_sources_before
FROM sources
WHERE type = 'reddit' OR name ILIKE 'Reddit%';

-- Delete all Reddit sources
DELETE FROM sources
WHERE type = 'reddit' OR name ILIKE 'Reddit%';

-- Confirm deletion
SELECT COUNT(*) as total_sources_remaining
FROM sources;

COMMIT;

-- Verification query (run after deployment):
-- SELECT COUNT(*) FROM sources WHERE type='reddit' OR name ILIKE 'Reddit%';
-- Should return: 0
