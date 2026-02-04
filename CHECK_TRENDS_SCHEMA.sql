-- Check the trends table schema and data
-- Run in Supabase SQL Editor

-- Step 1: Check column types
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'trends'
ORDER BY ordinal_position;

-- Step 2: Check first trend's data
SELECT 
  id,
  country,
  category,
  count,
  alert_ids,
  jsonb_typeof(alert_ids) as alert_ids_json_type,
  array_length(alert_ids, 1) as alert_ids_array_length
FROM trends 
LIMIT 1;

-- Step 3: If alert_ids is showing as a string, check what it contains
SELECT 
  id,
  country,
  category,
  count,
  alert_ids::text as alert_ids_as_text,
  length(alert_ids::text) as text_length
FROM trends 
LIMIT 1;
