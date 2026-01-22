-- Backfill missing polygons for alerts that have coordinates but no geojson
-- This fixes alerts created before polygon enforcement was added

-- Function to generate a circle polygon from lat/lon/radius
CREATE OR REPLACE FUNCTION generate_circle_geojson(
  lat NUMERIC,
  lon NUMERIC,
  radius_km NUMERIC DEFAULT 50
) RETURNS TEXT AS $$
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
  
  RETURN '{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[' || coords || ']]},"properties":{}}';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update alerts that have lat/lon but no geojson
UPDATE alerts
SET geojson = generate_circle_geojson(
  latitude::NUMERIC,
  longitude::NUMERIC,
  COALESCE(radius, 50)
)
WHERE geojson IS NULL
  AND latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND latitude ~ '^-?[0-9]+\.?[0-9]*$'
  AND longitude ~ '^-?[0-9]+\.?[0-9]*$';

-- Delete alerts that have no geojson and no lat/lon (can't be fixed)
DELETE FROM alerts
WHERE geojson IS NULL
  AND (latitude IS NULL OR longitude IS NULL OR latitude = '' OR longitude = '');

-- Log results
DO $$
DECLARE
  backfilled_count INTEGER;
  deleted_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO backfilled_count FROM alerts WHERE geojson IS NOT NULL;
  SELECT COUNT(*) INTO deleted_count FROM alerts WHERE geojson IS NULL;
  
  RAISE NOTICE 'Polygon backfill complete: % alerts have polygons, % alerts deleted (no coordinates)', backfilled_count, deleted_count;
END $$;
