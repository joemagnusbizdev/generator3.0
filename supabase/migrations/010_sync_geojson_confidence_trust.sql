```sql
-- Combined migration: ensure GeoJSON columns, backfill polygons, cleanup invalid alerts,
-- and add confidence_score / trust_score columns and indices.

-- 1) Ensure both JSONB (`geo_json`) and TEXT (`geojson`) columns exist on `alerts`
ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS geo_json JSONB DEFAULT NULL;

ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS geojson TEXT DEFAULT NULL;

-- 2) Indexes to support geojson queries
CREATE INDEX IF NOT EXISTS idx_alerts_geo_json_gin ON alerts USING GIN (geo_json);
CREATE INDEX IF NOT EXISTS idx_alerts_with_geojson ON alerts(id) WHERE geo_json IS NOT NULL;

COMMENT ON COLUMN alerts.geo_json IS 'GeoJSON stored as JSONB for map queries';
COMMENT ON COLUMN alerts.geojson IS 'GeoJSON stored as TEXT for legacy compatibility';

-- 3) Add confidence_score to alerts (if not present)
ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS confidence_score NUMERIC DEFAULT 0.5 CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0);

CREATE INDEX IF NOT EXISTS idx_alerts_confidence_score ON alerts(confidence_score DESC) WHERE status = 'draft';
CREATE INDEX IF NOT EXISTS idx_alerts_confidence_high ON alerts(confidence_score DESC) WHERE confidence_score >= 0.7 AND status = 'draft';

COMMENT ON COLUMN alerts.confidence_score IS 'Factal-style confidence score (0.0-1.0) used to determine publishability';

-- 4) Add trust_score to sources (if not present)
ALTER TABLE sources
  ADD COLUMN IF NOT EXISTS trust_score NUMERIC DEFAULT 0.5 CHECK (trust_score >= 0.0 AND trust_score <= 1.0);

CREATE INDEX IF NOT EXISTS idx_sources_trust_score ON sources(trust_score DESC) WHERE enabled = true;

COMMENT ON COLUMN sources.trust_score IS 'Custom trust score override (0.0-1.0). If set, overrides type-based trust.';

-- 5) Function to generate circular polygon GeoJSON from lat/lon (returns JSONB)
CREATE OR REPLACE FUNCTION generate_circle_geojson_jsonb(
  lat NUMERIC,
  lon NUMERIC,
  radius_km NUMERIC DEFAULT 50
) RETURNS JSONB AS $$
DECLARE
  earth_radius CONSTANT NUMERIC := 6371;
  ang_dist NUMERIC;
  lat_rad NUMERIC;
  lon_rad NUMERIC;
  points INTEGER := 28;
  coords TEXT := '';
  i INTEGER;
  bearing NUMERIC;
  lat2 NUMERIC;
  lon2 NUMERIC;
  point_lat NUMERIC;
  point_lon NUMERIC;
BEGIN
  IF lat IS NULL OR lon IS NULL THEN
    RETURN NULL;
  END IF;

  ang_dist := radius_km / earth_radius;
  lat_rad := radians(lat);
  lon_rad := radians(lon);

  FOR i IN 0..points LOOP
    bearing := (2 * pi() * i) / points;

    lat2 := asin(
      sin(lat_rad) * cos(ang_dist) + 
      cos(lat_rad) * sin(ang_dist) * cos(bearing)
    );

    lon2 := lon_rad + atan2(
      sin(bearing) * sin(ang_dist) * cos(lat_rad),
      cos(ang_dist) - sin(lat_rad) * sin(lat2)
    );

    point_lon := degrees(lon2);
    point_lat := degrees(lat2);

    IF i > 0 THEN
      coords := coords || ',';
    END IF;
    coords := coords || '[' || point_lon::TEXT || ',' || point_lat::TEXT || ']';
  END LOOP;

  RETURN ('{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[' || coords || ']]},"properties":{}}')::jsonb;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 6) Synchronize existing data: ensure both columns populated where possible
-- If only text `geojson` exists, copy into `geo_json` JSONB
UPDATE alerts
SET geo_json = geojson::jsonb
WHERE geo_json IS NULL
  AND geojson IS NOT NULL
  AND trim(geojson) <> '';

-- If only JSONB `geo_json` exists, copy into `geojson` text
UPDATE alerts
SET geojson = geo_json::text
WHERE (geojson IS NULL OR trim(geojson) = '')
  AND geo_json IS NOT NULL;

-- 7) Backfill missing polygons: where both are NULL but lat/lon exist, generate a circle
UPDATE alerts
SET
  geo_json = COALESCE(geo_json, generate_circle_geojson_jsonb(latitude::NUMERIC, longitude::NUMERIC, COALESCE(radius, 50))),
  geojson = COALESCE(geojson, COALESCE(generate_circle_geojson_jsonb(latitude::NUMERIC, longitude::NUMERIC, COALESCE(radius, 50))::text, geojson))
WHERE (geo_json IS NULL OR trim(COALESCE(geojson, '')) = '')
  AND latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND latitude ~ '^-?[0-9]+\.?[0-9]*$'
  AND longitude ~ '^-?[0-9]+\.?[0-9]*$';

-- 8) Remove unrecoverable alerts: no geo information and no coordinates
DELETE FROM alerts
WHERE (geo_json IS NULL OR geo_json = 'null')
  AND (geojson IS NULL OR trim(geojson) = '')
  AND (latitude IS NULL OR longitude IS NULL OR trim(COALESCE(latitude::TEXT, '')) = '' OR trim(COALESCE(longitude::TEXT, '')) = '');

-- 9) Cleanup invalid alerts (legacy checks)
DELETE FROM alerts
WHERE recommendations LIKE '%WordPress integration error%'
   OR recommendations LIKE '%at approveAndPublishToWP%'
   OR recommendations LIKE '%ext:core%';

DELETE FROM alerts
WHERE LOWER(country) IN ('global', 'worldwide', 'international', 'multiple')
  AND status = 'draft';

DELETE FROM alerts
WHERE status = 'draft'
  AND (
    country IS NULL OR trim(country) = ''
    OR location IS NULL OR trim(location) = ''
    OR mainland IS NULL OR trim(mainland) = ''
  );

-- 10) Report counts for verification
DO $$
DECLARE
  backfilled_count INTEGER;
  deleted_count INTEGER;
  total_with_geojson INTEGER;
BEGIN
  SELECT COUNT(*) INTO backfilled_count FROM alerts WHERE geo_json IS NOT NULL OR (geojson IS NOT NULL AND trim(geojson) <> '');
  SELECT COUNT(*) INTO deleted_count FROM alerts WHERE (geo_json IS NULL OR geo_json = 'null') AND (geojson IS NULL OR trim(geojson) = '');
  SELECT COUNT(*) INTO total_with_geojson FROM alerts WHERE geo_json IS NOT NULL OR (geojson IS NOT NULL AND trim(geojson) <> '');

  RAISE NOTICE 'GeoJSON sync complete: % alerts with geojson, % alerts deleted (no coords).', backfilled_count, deleted_count;
  RAISE NOTICE 'Total alerts now with geojson: %', total_with_geojson;
END $$;

-- End of migration
```
