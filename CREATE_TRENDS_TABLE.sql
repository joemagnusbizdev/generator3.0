-- Run this in Supabase SQL editor to create the trends table
-- Go to: https://supabase.com/dashboard → SQL Editor → New Query

-- Create trends table for aggregated dismissed alerts
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
  status TEXT DEFAULT 'open'
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

-- Enable RLS if needed (optional - adjust based on your security needs)
ALTER TABLE trends ENABLE ROW LEVEL SECURITY;
