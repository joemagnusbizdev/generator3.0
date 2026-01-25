-- Find and disable source 83

WITH numbered_sources AS (
  SELECT 
    ROW_NUMBER() OVER (ORDER BY id) as position,
    id,
    name,
    url,
    enabled,
    created_at
  FROM sources
)
SELECT * FROM numbered_sources
WHERE position = 83;

-- Once you have the UUID, run:
-- UPDATE sources SET enabled = false WHERE id = '[UUID_FROM_ABOVE]';
