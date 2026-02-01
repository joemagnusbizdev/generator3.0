-- Fix trends table schema
-- This migration creates the trends table with the correct schema

DROP TABLE IF EXISTS trends CASCADE;

CREATE TABLE trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country TEXT NOT NULL,
  category TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  highest_severity TEXT,
  alert_ids UUID[] DEFAULT '{}',
  last_seen_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT DEFAULT 'open'
);

CREATE UNIQUE INDEX idx_trends_country_category
  ON trends (country, category)
  WHERE status = 'open';

CREATE INDEX idx_trends_last_seen
  ON trends (last_seen_at DESC);

CREATE INDEX idx_trends_country
  ON trends (country);

ALTER TABLE trends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on trends" ON trends
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read on trends" ON trends
  FOR SELECT TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_trends_updated_at ON trends;
CREATE TRIGGER update_trends_updated_at
  BEFORE UPDATE ON trends
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
