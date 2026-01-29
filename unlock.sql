-- Clear stuck scour job lock
DELETE FROM app_kv 
WHERE key = 'scour_job:9c984c5b-cc01-4fbc-a5b2-4721ecce768e';

SELECT 'Scour lock cleared successfully' as result;
