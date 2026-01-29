-- ========================================================================
-- MAGNUS Travel Alert Database Export - Complete Alert Example
-- Use this to pull a full alert record with all fields for 3rd party review
-- ========================================================================

-- HELPER: Get a valid alert UUID to use with Option 2
-- SELECT id FROM alerts LIMIT 1;

-- OPTION 1: Get the most recent published alert
SELECT 
  id,
  title,
  summary,
  description,
  location,
  country,
  region,
  mainland,
  event_type,
  severity,
  status,
  source_url,
  article_url,
  sources,
  event_start_date,
  event_end_date,
  latitude,
  longitude,
  radius,
  geo_json,
  geojson,
  recommendations,
  intelligence_topics,
  ai_generated,
  ai_model,
  ai_confidence,
  confidence_score,
  generation_metadata,
  source_id,
  trend_id,
  wordpress_post_id,
  wordpress_url,
  exported_at,
  export_error,
  created_at,
  updated_at
FROM alerts
WHERE status = 'approved'
ORDER BY created_at DESC
LIMIT 1;

-- ========================================================================

-- OPTION 2: Get a specific alert by ID
-- Replace 'YOUR_ALERT_UUID_HERE' with an actual alert UUID from your database
-- Example UUID format: 'a1b2c3d4-e5f6-47g8-h9i0-j1k2l3m4n5o6'
-- To find a valid UUID: Run "SELECT id FROM alerts LIMIT 1;" first
SELECT 
  id,
  title,
  summary,
  description,
  location,
  country,
  region,
  mainland,
  event_type,
  severity,
  status,
  source_url,
  article_url,
  sources,
  event_start_date,
  event_end_date,
  latitude,
  longitude,
  radius,
  geo_json,
  geojson,
  recommendations,
  intelligence_topics,
  ai_generated,
  ai_model,
  ai_confidence,
  confidence_score,
  generation_metadata,
  source_id,
  trend_id,
  wordpress_post_id,
  wordpress_url,
  exported_at,
  export_error,
  created_at,
  updated_at
FROM alerts
WHERE id = 'YOUR_ALERT_UUID_HERE';

-- ========================================================================

-- OPTION 3: Get alerts by country (for geographic examples)
-- Replace 'Kenya' with desired country
SELECT 
  id,
  title,
  summary,
  description,
  location,
  country,
  region,
  mainland,
  event_type,
  severity,
  status,
  source_url,
  article_url,
  sources,
  event_start_date,
  event_end_date,
  latitude,
  longitude,
  radius,
  geo_json,
  recommendations,
  intelligence_topics,
  ai_generated,
  ai_model,
  ai_confidence,
  confidence_score,
  generation_metadata,
  created_at,
  updated_at
FROM alerts
WHERE country = 'Kenya'
AND status = 'approved'
ORDER BY created_at DESC
LIMIT 5;

-- ========================================================================

-- OPTION 4: Get alerts by severity (for demonstrating different threat levels)
SELECT 
  id,
  title,
  summary,
  description,
  location,
  country,
  event_type,
  severity,
  status,
  source_url,
  article_url,
  recommendations,
  ai_generated,
  confidence_score,
  created_at
FROM alerts
WHERE status = 'approved'
ORDER BY severity DESC, created_at DESC
LIMIT 1 OFFSET 0;  -- Change OFFSET to get different severity examples

-- ========================================================================

-- OPTION 5: Export as JSON for 3rd party consumption
-- This formats the alert as a single JSON object
SELECT 
  json_build_object(
    'id', id,
    'title', title,
    'summary', summary,
    'description', description,
    'location', location,
    'country', country,
    'region', region,
    'mainland', mainland,
    'event_type', event_type,
    'severity', severity,
    'status', status,
    'source_url', source_url,
    'article_url', article_url,
    'sources', sources,
    'event_start_date', event_start_date,
    'event_end_date', event_end_date,
    'latitude', latitude,
    'longitude', longitude,
    'radius', radius,
    'geo_json', geo_json,
    'recommendations', recommendations,
    'intelligence_topics', intelligence_topics,
    'ai_generated', ai_generated,
    'ai_model', ai_model,
    'ai_confidence', ai_confidence,
    'confidence_score', confidence_score,
    'generation_metadata', generation_metadata,
    'created_at', created_at,
    'updated_at', updated_at
  ) as alert_data
FROM alerts
WHERE status = 'approved'
ORDER BY created_at DESC
LIMIT 1;

-- ========================================================================
-- FIELD DEFINITIONS
-- ========================================================================
/*

Core Content:
  - id: UUID primary key
  - title: Alert title (e.g., "Armed Clashes in Northern Region")
  - summary: 2-3 sentence summary of the incident
  - description: Detailed description of the situation
  - location: City or specific location affected
  - country: Country code or name
  - region: Region/state/province
  - mainland: Continent (Africa, Asia, Europe, North America, South America, Oceania, Antarctica)

Classification:
  - event_type: Type of event (conflict, natural_disaster, pandemic, etc.)
  - severity: critical | warning | caution | informative

Status & Tracking:
  - status: draft | approved | dismissed | posted
  - ai_generated: Boolean - was this created by AI or manually?
  - ai_model: Model used for generation (gpt-4o-mini, etc.)
  - ai_confidence: Confidence score from AI (0.0-1.0)
  - confidence_score: Factal-style confidence (0.0-1.0)
  - source_id: UUID reference to source

Geographic Data:
  - latitude: Decimal latitude
  - longitude: Decimal longitude
  - radius: Alert radius in kilometers
  - geo_json: GeoJSON feature (Polygon or Point)
  - geojson: Alternate GeoJSON field

Temporal:
  - event_start_date: When the event started
  - event_end_date: When the event ended (or null if ongoing)
  - created_at: When alert was created in system
  - updated_at: Last modification time

Source Info:
  - source_url: URL of the news source/article
  - article_url: Direct URL to the article
  - sources: JSON array of source URLs

Content:
  - recommendations: Recommended actions for travelers
  - intelligence_topics: Tags/categories (e.g., ["security", "infrastructure"])
  - generation_metadata: JSON object with generation details

WordPress Export:
  - wordpress_post_id: ID of published WordPress post (if exported)
  - wordpress_url: URL of WordPress post
  - exported_at: Timestamp of export
  - export_error: Error message if export failed

Trending:
  - trend_id: UUID reference to related trend (if any)

*/

-- ========================================================================
-- USAGE EXAMPLES
-- ========================================================================

-- To see the GeoJSON formatted nicely:
-- SELECT id, title, geo_json FROM alerts WHERE geo_json IS NOT NULL LIMIT 1;

-- To see all recommendations for an alert:
-- SELECT id, title, recommendations FROM alerts WHERE recommendations IS NOT NULL LIMIT 1;

-- To check confidence scoring distribution:
-- SELECT 
--   CASE 
--     WHEN confidence_score >= 0.75 THEN 'High'
--     WHEN confidence_score >= 0.5 THEN 'Medium'
--     ELSE 'Low'
--   END as confidence_level,
--   COUNT(*) as alert_count,
--   AVG(confidence_score) as avg_score
-- FROM alerts
-- GROUP BY confidence_level;
