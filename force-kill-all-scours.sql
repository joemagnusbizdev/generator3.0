-- Force kill all running scour jobs
-- Run this in Supabase SQL Editor to clear all locks

DELETE FROM app_kv 
WHERE key LIKE 'scour_job:%';

SELECT 'All scour jobs cleared' as result;
