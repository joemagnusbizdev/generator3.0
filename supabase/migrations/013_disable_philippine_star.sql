-- Disable The Philippine Star as it causes scour to stall at source 14
UPDATE sources SET enabled = false WHERE name = 'The Philippine Star';
