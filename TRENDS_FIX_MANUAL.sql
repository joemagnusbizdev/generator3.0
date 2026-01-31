-- Manual SQL to fix trends table in Supabase
-- Run this in: https://supabase.com/dashboard → SQL Editor → New Query

-- Step 1: Drop the old trends table if it exists
DROP TABLE IF EXISTS trends CASCADE;

-- Step 2: Create the trends table with correct schema
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

-- Step 3: Create indexes
CREATE UNIQUE INDEX idx_trends_country_category 
  ON trends (country, category) 
  WHERE status = 'open';

CREATE INDEX idx_trends_last_seen 
  ON trends (last_seen_at DESC);

CREATE INDEX idx_trends_country 
  ON trends (country);

-- Step 4: Enable RLS
ALTER TABLE trends ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies
CREATE POLICY "Service role full access on trends" ON trends
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read on trends" ON trends
  FOR SELECT TO authenticated USING (true);

-- Step 6: Add foreign key from alerts
ALTER TABLE alerts 
  ADD CONSTRAINT IF NOT EXISTS fk_alerts_trend 
  FOREIGN KEY (trend_id) REFERENCES trends(id) ON DELETE SET NULL;

-- Step 7: Create trigger for updated_at
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
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Done! The trends table is now ready to use
-- You can now rebuild trends by calling the API:
-- POST https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function/trends/rebuild
