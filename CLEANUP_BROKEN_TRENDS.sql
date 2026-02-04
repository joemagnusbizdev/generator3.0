-- Cleanup script for existing broken trends
-- Run this in Supabase SQL Editor to clear trends that have all alerts

-- Step 1: Delete all existing trends
DELETE FROM trends;

-- Step 2: Verify deletion
SELECT COUNT(*) as remaining_trends FROM trends;

-- Done! Now rebuild trends via API:
-- POST /trends/rebuild
-- This will create new trends with corrected alert grouping
