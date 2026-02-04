-- Alternative approach: Add trend_id field to alerts table
-- This makes querying much simpler and more reliable

-- Step 1: Add trend_id column to alerts if it doesn't exist
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS trend_id UUID REFERENCES trends(id) ON DELETE SET NULL;

-- Step 2: Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_alerts_trend_id ON alerts(trend_id);

-- Step 3: Verify the column exists
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'alerts' AND column_name = 'trend_id';

-- Now alerts can be queried simply by: GET /alerts?trend_id=eq.{trendId}
-- This is much more reliable than storing and querying UUIDs arrays
