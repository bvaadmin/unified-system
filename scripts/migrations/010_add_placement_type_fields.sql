-- Migration 010: Add placement type and additional person fields for future placements
-- This migration adds support for the new placement options:
-- - For myself
-- - For myself and one other person  
-- - For two other people (not me)

BEGIN;

-- Add placement_type column to track the type of future placement
ALTER TABLE bayview.memorials 
ADD COLUMN IF NOT EXISTS placement_type VARCHAR(50);

-- Add fields for the "other person" (when selecting "self_and_other" or "two_others")
ALTER TABLE bayview.memorials
ADD COLUMN IF NOT EXISTS other_first_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS other_middle_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS other_last_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS other_maiden_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS other_birth_date DATE,
ADD COLUMN IF NOT EXISTS other_death_date DATE,
ADD COLUMN IF NOT EXISTS other_birth_place VARCHAR(255),
ADD COLUMN IF NOT EXISTS other_home_address TEXT,
ADD COLUMN IF NOT EXISTS other_bayview_address TEXT,
ADD COLUMN IF NOT EXISTS other_bayview_history TEXT;

-- Add fields for the "second person" (when selecting "two_others")
ALTER TABLE bayview.memorials
ADD COLUMN IF NOT EXISTS second_first_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS second_middle_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS second_last_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS second_maiden_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS second_birth_date DATE,
ADD COLUMN IF NOT EXISTS second_death_date DATE,
ADD COLUMN IF NOT EXISTS second_birth_place VARCHAR(255),
ADD COLUMN IF NOT EXISTS second_home_address TEXT,
ADD COLUMN IF NOT EXISTS second_bayview_address TEXT,
ADD COLUMN IF NOT EXISTS second_bayview_history TEXT;

-- Add a constraint to ensure placement_type is valid when application_type is 'future'
ALTER TABLE bayview.memorials
ADD CONSTRAINT check_placement_type 
CHECK (
    (application_type != 'future' AND placement_type IS NULL) 
    OR 
    (application_type = 'future' AND placement_type IN ('self', 'self_and_other', 'two_others'))
    OR
    (application_type IS NULL)
);

-- Create indexes for the new fields
CREATE INDEX IF NOT EXISTS idx_memorials_placement_type ON bayview.memorials(placement_type);
CREATE INDEX IF NOT EXISTS idx_memorials_other_names ON bayview.memorials(other_first_name, other_last_name);
CREATE INDEX IF NOT EXISTS idx_memorials_second_names ON bayview.memorials(second_first_name, second_last_name);

-- Update the migration tracking
INSERT INTO migration.schema_versions (version, description, applied_at)
VALUES (10, 'Add placement type and additional person fields for future placements', NOW());

COMMIT;

-- Add comments for documentation
COMMENT ON COLUMN bayview.memorials.placement_type IS 'Type of future placement: self, self_and_other, or two_others';
COMMENT ON COLUMN bayview.memorials.other_first_name IS 'First name of the other person (for self_and_other or first person in two_others)';
COMMENT ON COLUMN bayview.memorials.second_first_name IS 'First name of the second person (only for two_others placement type)';