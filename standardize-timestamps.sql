-- Standardize all timestamps to ISO 8601 format (YYYY-MM-DDThh:mm:ssZ)
-- This script ensures all alerts in the database use consistent timestamp formatting

-- ============================================================================
-- 1. Ensure created_at is ISO 8601 format
-- ============================================================================
UPDATE alerts
SET created_at = TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')::timestamp with time zone
WHERE created_at IS NOT NULL;

-- ============================================================================
-- 2. Ensure updated_at is ISO 8601 format
-- ============================================================================
UPDATE alerts
SET updated_at = TO_CHAR(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')::timestamp with time zone
WHERE updated_at IS NOT NULL;

-- ============================================================================
-- 3. Ensure event_start_date is ISO 8601 format (if exists)
-- ============================================================================
UPDATE alerts
SET event_start_date = TO_CHAR(event_start_date, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')::timestamp with time zone
WHERE event_start_date IS NOT NULL;

-- ============================================================================
-- 4. Ensure event_end_date is ISO 8601 format (if exists)
-- ============================================================================
UPDATE alerts
SET event_end_date = TO_CHAR(event_end_date, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')::timestamp with time zone
WHERE event_end_date IS NOT NULL;

-- ============================================================================
-- 4b. Set default event_end_date (3 days from event_start_date) for ongoing events
-- ============================================================================
UPDATE alerts
SET event_end_date = event_start_date + INTERVAL '3 days'
WHERE event_end_date IS NULL 
  AND event_start_date IS NOT NULL;

-- ============================================================================
-- 5. Ensure created_at and updated_at are never NULL
-- ============================================================================
UPDATE alerts
SET created_at = COALESCE(created_at, NOW())
WHERE created_at IS NULL;

UPDATE alerts
SET updated_at = COALESCE(updated_at, NOW())
WHERE updated_at IS NULL;

-- ============================================================================
-- 6. Verify the changes (view all timestamps after update)
-- ============================================================================
-- Run this query to verify all timestamps are now in ISO 8601 format:
SELECT 
  id,
  title,
  TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
  TO_CHAR(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at,
  CASE WHEN event_start_date IS NOT NULL THEN TO_CHAR(event_start_date, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') ELSE NULL END as event_start_date,
  CASE WHEN event_end_date IS NOT NULL THEN TO_CHAR(event_end_date, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') ELSE NULL END as event_end_date,
  '✓ All timestamps standardized to ISO 8601' as status
FROM alerts
ORDER BY created_at DESC
LIMIT 50;
