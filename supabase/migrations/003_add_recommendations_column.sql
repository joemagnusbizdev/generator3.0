-- Add recommendations and mitigation columns to alerts table
-- Run this in Supabase SQL Editor

ALTER TABLE alerts 
ADD COLUMN IF NOT EXISTS recommendations TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS mitigation TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_alerts_with_recommendations ON alerts(id) WHERE recommendations != '';

COMMENT ON COLUMN alerts.recommendations IS 'Traveler recommendations and advice';
COMMENT ON COLUMN alerts.mitigation IS 'Safety precautions and protective measures';
