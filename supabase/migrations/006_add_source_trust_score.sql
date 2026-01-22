-- Add trust_score column to sources table (optional, for future use)
-- This enables per-source trust tuning beyond just type-based scoring

ALTER TABLE sources 
ADD COLUMN IF NOT EXISTS trust_score NUMERIC DEFAULT 0.5 CHECK (trust_score >= 0.0 AND trust_score <= 1.0);

-- Create index for trust-based sorting
CREATE INDEX IF NOT EXISTS idx_sources_trust_score ON sources(trust_score DESC) WHERE enabled = true;

COMMENT ON COLUMN sources.trust_score IS 'Custom trust score override (0.0-1.0). If set, overrides calculateConfidence() type-based trust. Allows fine-tuning per source.';
