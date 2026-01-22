-- Clean up alerts with missing or invalid data before ACF enforcement

-- 1. Delete alerts with error messages in recommendations
DELETE FROM alerts
WHERE recommendations LIKE '%WordPress integration error%'
   OR recommendations LIKE '%at approveAndPublishToWP%'
   OR recommendations LIKE '%ext:core%';

-- 2. Delete alerts missing both geojson and geo_json
DELETE FROM alerts
WHERE (geojson IS NULL OR geojson = '')
  AND geo_json IS NULL
  AND status = 'draft';

-- 3. For alerts with geo_json JSONB but missing geojson TEXT, populate it
UPDATE alerts
SET geojson = geo_json::text
WHERE (geojson IS NULL OR geojson = '')
  AND geo_json IS NOT NULL;

-- 4. Delete alerts with Global/Worldwide country (shouldn't exist per validation)
DELETE FROM alerts
WHERE LOWER(country) IN ('global', 'worldwide', 'international', 'multiple')
  AND status = 'draft';

-- 5. Delete alerts missing required ACF fields for publish
DELETE FROM alerts
WHERE status = 'draft'
  AND (
    country IS NULL OR country = ''
    OR location IS NULL OR location = ''
    OR mainland IS NULL OR mainland = ''
  );

-- Report what's left
SELECT 
  status,
  COUNT(*) as count,
  COUNT(CASE WHEN geojson IS NOT NULL AND geojson != '' THEN 1 END) as with_geojson,
  COUNT(CASE WHEN geo_json IS NOT NULL THEN 1 END) as with_geo_json_jsonb,
  COUNT(CASE WHEN mainland IS NOT NULL AND mainland != '' THEN 1 END) as with_mainland
FROM alerts
GROUP BY status
ORDER BY status;
