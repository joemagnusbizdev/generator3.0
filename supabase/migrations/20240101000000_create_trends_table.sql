-- Drop existing trends table if it exists with wrong schema
DROP TABLE IF EXISTS trends CASCADE;

-- Create trends table for aggregated dismissed alerts with correct schema
CREATE TABLE IF NOT EXISTS trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country TEXT NOT NULL,
  category TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  highest_severity TEXT,
  alert_ids UUID[] DEFAULT '{}',
  last_seen_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT DEFAULT 'open' -- 'open', 'closed', 'archived'
);

-- Create unique index to prevent duplicate trends
CREATE UNIQUE INDEX IF NOT EXISTS idx_trends_country_category 
  ON trends (country, category) 
  WHERE status = 'open';

-- Create index for ordering
CREATE INDEX IF NOT EXISTS idx_trends_last_seen 
  ON trends (last_seen_at DESC);

-- Create index for queries
CREATE INDEX IF NOT EXISTS idx_trends_country 
  ON trends (country);

-- Enable RLS
ALTER TABLE trends ENABLE ROW LEVEL SECURITY;

-- RLS Policies for trends table
DROP POLICY IF EXISTS "Service role full access on trends" ON trends;
CREATE POLICY "Service role full access on trends" ON trends
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated read on trends" ON trends;
CREATE POLICY "Authenticated read on trends" ON trends
  FOR SELECT TO authenticated USING (true);

-- Add the updated_at trigger (if not already created)
DROP TRIGGER IF EXISTS update_trends_updated_at ON trends;
CREATE TRIGGER update_trends_updated_at
  BEFORE UPDATE ON trends
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Restore foreign key in alerts table pointing to trends
ALTER TABLE IF EXISTS alerts 
  ADD CONSTRAINT IF NOT EXISTS fk_alerts_trend 
  FOREIGN KEY (trend_id) REFERENCES trends(id) ON DELETE SET NULL;
