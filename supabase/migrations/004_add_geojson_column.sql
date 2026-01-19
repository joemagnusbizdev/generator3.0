-- Add geojson column to alerts table
-- Run this in Supabase SQL Editor

ALTER TABLE alerts 
ADD COLUMN IF NOT EXISTS geo_json JSONB DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_alerts_with_geojson ON alerts(id) WHERE geo_json IS NOT NULL;

COMMENT ON COLUMN alerts.geo_json IS 'GeoJSON polygon or feature for map visualization';
