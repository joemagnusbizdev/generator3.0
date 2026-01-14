-- ===========================================
-- MAGNUS Intelligence Alert Generator
-- Complete Database Schema
-- Run this in Supabase SQL Editor
-- ===========================================

-- -------------------------------------------
-- 1. APP_KV Table (Key-Value Store)
-- Used for: quotas, job state, cron tracking
-- -------------------------------------------
CREATE TABLE IF NOT EXISTS app_kv (
  key TEXT PRIMARY KEY,
  value JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_kv_updated ON app_kv(updated_at DESC);

COMMENT ON TABLE app_kv IS 'Key-value store for application state, quotas, and job tracking';

-- -------------------------------------------
-- 2. SOURCES Table
-- Used for: news sources to scour
-- -------------------------------------------
CREATE TABLE IF NOT EXISTS sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT DEFAULT 'rss',
  category TEXT DEFAULT 'general',
  country TEXT,
  region TEXT,
  language TEXT DEFAULT 'en',
  enabled BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 5,
  last_scoured_at TIMESTAMPTZ,
  last_error TEXT,
  error_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sources_enabled ON sources(enabled);
CREATE INDEX IF NOT EXISTS idx_sources_type ON sources(type);
CREATE INDEX IF NOT EXISTS idx_sources_country ON sources(country);
CREATE INDEX IF NOT EXISTS idx_sources_created ON sources(created_at DESC);

COMMENT ON TABLE sources IS 'News and intelligence sources for scouring';

-- -------------------------------------------
-- 3. ALERTS Table
-- Used for: generated alerts from AI/manual
-- -------------------------------------------
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core content
  title TEXT NOT NULL,
  summary TEXT DEFAULT '',
  location TEXT,
  country TEXT,
  region TEXT,
  
  -- Classification
  event_type TEXT,
  severity TEXT DEFAULT 'informative' CHECK (severity IN ('critical', 'warning', 'caution', 'informative')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'dismissed', 'posted')),
  
  -- Source tracking
  source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
  source_url TEXT,
  article_url TEXT,
  sources JSONB DEFAULT '[]',
  
  -- Dates
  event_start_date DATE,
  event_end_date DATE,
  
  -- AI/Generation metadata
  ai_generated BOOLEAN DEFAULT FALSE,
  ai_model TEXT,
  ai_confidence REAL,
  generation_metadata JSONB DEFAULT '{}',
  
  -- WordPress export
  wordpress_post_id TEXT,
  wordpress_url TEXT,
  exported_at TIMESTAMPTZ,
  export_error TEXT,
  export_error_at TIMESTAMPTZ,
  
  -- Trend linking
  trend_id UUID,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_country ON alerts(country);
CREATE INDEX IF NOT EXISTS idx_alerts_event_type ON alerts(event_type);
CREATE INDEX IF NOT EXISTS idx_alerts_source_id ON alerts(source_id);
CREATE INDEX IF NOT EXISTS idx_alerts_trend_id ON alerts(trend_id);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_wordpress ON alerts(wordpress_post_id) WHERE wordpress_post_id IS NOT NULL;

COMMENT ON TABLE alerts IS 'Intelligence alerts generated from sources or manually created';

-- -------------------------------------------
-- 4. TRENDS Table
-- Used for: aggregating related alerts
-- -------------------------------------------
CREATE TABLE IF NOT EXISTS trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core content
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  predictive_analysis TEXT DEFAULT '',
  
  -- Status
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'monitoring', 'closed')),
  
  -- Geographic
  country TEXT,
  countries TEXT[] DEFAULT '{}',
  region TEXT,
  
  -- Classification
  event_type TEXT,
  severity TEXT DEFAULT 'informative' CHECK (severity IN ('critical', 'warning', 'caution', 'informative')),
  
  -- Linked alerts
  alert_ids UUID[] DEFAULT '{}',
  incident_count INTEGER DEFAULT 0,
  
  -- Time tracking
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  
  -- Metadata
  auto_generated BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key for trend_id in alerts (now that trends table exists)
ALTER TABLE alerts 
  ADD CONSTRAINT fk_alerts_trend 
  FOREIGN KEY (trend_id) REFERENCES trends(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trends_status ON trends(status);
CREATE INDEX IF NOT EXISTS idx_trends_country ON trends(country);
CREATE INDEX IF NOT EXISTS idx_trends_event_type ON trends(event_type);
CREATE INDEX IF NOT EXISTS idx_trends_severity ON trends(severity);
CREATE INDEX IF NOT EXISTS idx_trends_updated ON trends(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_trends_first_seen ON trends(first_seen DESC);

COMMENT ON TABLE trends IS 'Aggregated trend patterns from related alerts';
COMMENT ON COLUMN trends.countries IS 'Array of all countries involved in multi-country trends';
COMMENT ON COLUMN trends.alert_ids IS 'Array of alert UUIDs contributing to this trend';

-- -------------------------------------------
-- 5. Row Level Security (RLS)
-- -------------------------------------------

-- Enable RLS on all tables
ALTER TABLE app_kv ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE trends ENABLE ROW LEVEL SECURITY;

-- Service role has full access (for Edge Functions)
CREATE POLICY "Service role full access on app_kv" ON app_kv
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on sources" ON sources
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on alerts" ON alerts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on trends" ON trends
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users can read (for direct Supabase client access if needed)
CREATE POLICY "Authenticated read on sources" ON sources
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read on alerts" ON alerts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read on trends" ON trends
  FOR SELECT TO authenticated USING (true);

-- -------------------------------------------
-- 6. Helper Functions (optional)
-- -------------------------------------------

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for auto-updating updated_at
DROP TRIGGER IF EXISTS update_sources_updated_at ON sources;
CREATE TRIGGER update_sources_updated_at
  BEFORE UPDATE ON sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_alerts_updated_at ON alerts;
CREATE TRIGGER update_alerts_updated_at
  BEFORE UPDATE ON alerts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_trends_updated_at ON trends;
CREATE TRIGGER update_trends_updated_at
  BEFORE UPDATE ON trends
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -------------------------------------------
-- Done! Schema is ready.
-- -------------------------------------------
