-- Add confidence_score column to alerts table
-- Factal-style confidence scoring for alert publishability
-- Score ranges from 0.0 (noise) to 1.0 (verified)
-- Categories: <0.4 (noise), 0.4-0.59 (early-signal), 0.6-0.69 (review), 0.7-0.85 (publish), >=0.85 (verified)

ALTER TABLE alerts 
ADD COLUMN IF NOT EXISTS confidence_score NUMERIC DEFAULT 0.5 CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0);

-- Index for confidence-based filtering in alerts workflow
CREATE INDEX IF NOT EXISTS idx_alerts_confidence_score ON alerts(confidence_score DESC) WHERE status = 'draft';

-- Index for sorting high-confidence alerts first
CREATE INDEX IF NOT EXISTS idx_alerts_confidence_high ON alerts(confidence_score DESC) WHERE confidence_score >= 0.7 AND status = 'draft';

COMMENT ON COLUMN alerts.confidence_score IS 'Factal-style confidence score (0.0-1.0) based on source trust, data quality, and timing. Used to determine publishability threshold.';
