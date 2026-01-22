-- Add ACF-aligned fields to alerts table
-- This aligns the database schema with WordPress ACF custom fields
-- Eliminates need for field mapping/transformation during WordPress posting

-- Description field (separate from summary for WordPress display)
ALTER TABLE alerts 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Recommendations field (stores actionable traveler advice)
ALTER TABLE alerts 
ADD COLUMN IF NOT EXISTS recommendations TEXT;

-- Mainland/continent field (Africa, Asia, Europe, etc.)
ALTER TABLE alerts 
ADD COLUMN IF NOT EXISTS mainland TEXT;

-- Intelligence topics field (matches ACF enum: Terrorism, Armed Conflict, etc.)
ALTER TABLE alerts 
ADD COLUMN IF NOT EXISTS intelligence_topics TEXT;

-- Geographic coordinates (stored as TEXT to match ACF format)
ALTER TABLE alerts 
ADD COLUMN IF NOT EXISTS latitude TEXT;

ALTER TABLE alerts 
ADD COLUMN IF NOT EXISTS longitude TEXT;

-- Radius for point-based alerts (in km)
ALTER TABLE alerts 
ADD COLUMN IF NOT EXISTS radius NUMERIC;

-- GeoJSON polygon for area-based alerts
ALTER TABLE alerts 
ADD COLUMN IF NOT EXISTS geojson TEXT;

-- Normalize existing values to valid sets before adding constraints
UPDATE alerts
SET intelligence_topics = 'Security'
WHERE intelligence_topics IS NOT NULL
	AND intelligence_topics NOT IN (
		'Armed Conflict', 'Air Incidents', 'Air Raid Sirens', 'Avalanches', 'Bomb Threats',
		'Building Collapses', 'Chemical Weapons', 'Coronavirus', 'Drought', 'Earthquakes',
		'Elections', 'Evacuations', 'Explosions', 'Fires', 'Floods', 'Health', 'Heat Waves',
		'Internet Outages', 'Kidnappings', 'Landslides', 'Lockdowns', 'Nuclear Weapons',
		'Outbreaks', 'Police Shootings', 'Power Outages', 'Protests', 'Civil Unrest',
		'Rail Incidents', 'Road Incidents', 'Robberies', 'Shootings', 'Stabbings',
		'Strike Actions', 'Suspicious Packages', 'Terrorism', 'Traffic', 'Transportation Incidents',
		'Tornadoes', 'Tropical Cyclones', 'Tsunamis', 'Volcanoes', 'Wildland Fires',
		'Water Quality', 'Winter Storms', 'Severe Weather', 'Security', 'Safety',
		'Flight Disruptions', 'Gas Leaks', 'Pro-Palestinian Protest'
	);

UPDATE alerts
SET mainland = NULL
WHERE mainland IS NOT NULL
	AND mainland NOT IN (
		'Africa', 'Antarctica', 'Asia', 'Europe', 'North America', 'Australia (Oceania)', 'South America'
	);

-- Enforce enumerated sets for ACF select fields
ALTER TABLE alerts
ADD CONSTRAINT alerts_intelligence_topics_valid
CHECK (
	intelligence_topics IS NULL OR intelligence_topics IN (
		'Armed Conflict', 'Air Incidents', 'Air Raid Sirens', 'Avalanches', 'Bomb Threats',
		'Building Collapses', 'Chemical Weapons', 'Coronavirus', 'Drought', 'Earthquakes',
		'Elections', 'Evacuations', 'Explosions', 'Fires', 'Floods', 'Health', 'Heat Waves',
		'Internet Outages', 'Kidnappings', 'Landslides', 'Lockdowns', 'Nuclear Weapons',
		'Outbreaks', 'Police Shootings', 'Power Outages', 'Protests', 'Civil Unrest',
		'Rail Incidents', 'Road Incidents', 'Robberies', 'Shootings', 'Stabbings',
		'Strike Actions', 'Suspicious Packages', 'Terrorism', 'Traffic', 'Transportation Incidents',
		'Tornadoes', 'Tropical Cyclones', 'Tsunamis', 'Volcanoes', 'Wildland Fires',
		'Water Quality', 'Winter Storms', 'Severe Weather', 'Security', 'Safety',
		'Flight Disruptions', 'Gas Leaks', 'Pro-Palestinian Protest'
	)
);

ALTER TABLE alerts
ADD CONSTRAINT alerts_mainland_valid
CHECK (
	mainland IS NULL OR mainland IN (
		'Africa', 'Antarctica', 'Asia', 'Europe', 'North America', 'Australia (Oceania)', 'South America'
	)
);

-- Indexes for geographic queries
CREATE INDEX IF NOT EXISTS idx_alerts_mainland ON alerts(mainland) WHERE mainland IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alerts_intelligence_topics ON alerts(intelligence_topics) WHERE intelligence_topics IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alerts_has_geo ON alerts(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Comments
COMMENT ON COLUMN alerts.description IS 'Full event description for WordPress ACF display (separate from summary)';
COMMENT ON COLUMN alerts.recommendations IS 'Traveler recommendations and safety advice for WordPress ACF';
COMMENT ON COLUMN alerts.mainland IS 'Continent/major region (Africa, Asia, Europe, etc.) for WordPress ACF';
COMMENT ON COLUMN alerts.intelligence_topics IS 'Intelligence category matching WordPress ACF enum (Terrorism, Armed Conflict, etc.)';
COMMENT ON COLUMN alerts.latitude IS 'Latitude coordinate as string to match WordPress ACF format';
COMMENT ON COLUMN alerts.longitude IS 'Longitude coordinate as string to match WordPress ACF format';
COMMENT ON COLUMN alerts.radius IS 'Alert radius in kilometers for point-based alerts';
COMMENT ON COLUMN alerts.geojson IS 'GeoJSON string for area-based alerts (polygon/multipolygon)';
