-- Create app_kv table for storing scour job state
CREATE TABLE IF NOT EXISTS app_kv (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_app_kv_updated_at ON app_kv(updated_at);

-- Enable Row Level Security
ALTER TABLE app_kv ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role has full access to app_kv"
  ON app_kv
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to read
CREATE POLICY "Authenticated users can read app_kv"
  ON app_kv
  FOR SELECT
  TO authenticated
  USING (true);
