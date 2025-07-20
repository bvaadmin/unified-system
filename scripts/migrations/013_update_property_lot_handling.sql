-- Migration 013: Update Property System for Non-Numeric Lot Identifiers
-- Handles lots like "11A", "11B", "19 1/6", "8 E 1/2", etc.
-- Created: 2025-07-20

-- Track this migration
INSERT INTO migration.schema_versions (version, description, applied_at)
VALUES (13, 'Update property system to handle non-numeric lot identifiers', CURRENT_TIMESTAMP);

-- =====================================================
-- UPDATE PROPERTY LOCATIONS TABLE
-- =====================================================

-- First, we need to change the lot_number column to handle alphanumeric values
-- We'll add new columns to maintain both the original cottage_id and parsed components

-- Add columns to store the full cottage ID and lot suffix
ALTER TABLE property.locations
ADD COLUMN cottage_id VARCHAR(20),
ADD COLUMN lot_suffix VARCHAR(10),
ADD COLUMN lot_fraction VARCHAR(10);

-- Drop the unique constraint temporarily
ALTER TABLE property.locations
DROP CONSTRAINT locations_block_number_lot_number_key;

-- Drop the check constraint on lot_number
ALTER TABLE property.locations
DROP CONSTRAINT valid_lot_number;

-- Now we can create a new unique constraint on cottage_id
ALTER TABLE property.locations
ADD CONSTRAINT unique_cottage_id UNIQUE (cottage_id);

-- Create an index for efficient lookups
CREATE INDEX idx_property_cottage_id ON property.locations(cottage_id);
CREATE INDEX idx_property_block_lot ON property.locations(block_number, lot_number);

-- Add a function to parse cottage IDs
CREATE OR REPLACE FUNCTION property.parse_cottage_id(p_cottage_id VARCHAR)
RETURNS TABLE (
    block_num INTEGER,
    lot_num INTEGER,
    lot_suffix VARCHAR,
    lot_fraction VARCHAR
) AS $$
DECLARE
    v_parts TEXT[];
    v_lot_part TEXT;
    v_numeric_part TEXT;
    v_suffix_part TEXT;
    v_fraction_part TEXT;
BEGIN
    -- Split by hyphen
    v_parts := string_to_array(p_cottage_id, '-');
    
    IF array_length(v_parts, 1) != 2 THEN
        RETURN;
    END IF;
    
    block_num := v_parts[1]::INTEGER;
    v_lot_part := v_parts[2];
    
    -- Check for fractions (e.g., "19 1/6", "8 E 1/2")
    IF v_lot_part LIKE '% %/%' THEN
        -- Extract the fraction part
        v_fraction_part := substring(v_lot_part from position(' ' in v_lot_part) + 1);
        v_lot_part := split_part(v_lot_part, ' ', 1);
    END IF;
    
    -- Extract numeric and alpha parts
    v_numeric_part := substring(v_lot_part from '^[0-9]+');
    v_suffix_part := substring(v_lot_part from '[^0-9]+$');
    
    IF v_numeric_part IS NOT NULL AND v_numeric_part != '' THEN
        lot_num := v_numeric_part::INTEGER;
    END IF;
    
    lot_suffix := NULLIF(v_suffix_part, '');
    lot_fraction := v_fraction_part;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Add a comment explaining the cottage ID format
COMMENT ON COLUMN property.locations.cottage_id IS 'Full cottage identifier in format "block-lot[suffix]" (e.g., "1-11A", "19-1 1/6")';
COMMENT ON COLUMN property.locations.lot_suffix IS 'Letter suffix for subdivided lots (e.g., A, B, C)';
COMMENT ON COLUMN property.locations.lot_fraction IS 'Fractional ownership identifier (e.g., "1/6", "E 1/2")';

-- Create a view for easy querying
CREATE OR REPLACE VIEW property.cottage_details AS
SELECT 
    l.*,
    COALESCE(cottage_id, block_number || '-' || lot_number) AS display_cottage_id,
    COUNT(lh.id) AS leaseholder_count,
    STRING_AGG(
        p.first_name || ' ' || p.last_name, 
        ', ' ORDER BY lh.is_primary_leaseholder DESC, p.last_name
    ) AS leaseholder_names
FROM property.locations l
LEFT JOIN property.leaseholds lh ON lh.property_id = l.id AND lh.status = 'active'
LEFT JOIN core.persons p ON p.id = lh.person_id
WHERE l.property_type = 'cottage'
GROUP BY l.id;

-- Grant appropriate permissions
GRANT SELECT ON property.cottage_details TO bayview_read;
GRANT SELECT, INSERT, UPDATE ON property.locations TO bayview_write;

-- Add helpful indexes
CREATE INDEX idx_cottage_suffix ON property.locations(lot_suffix) WHERE lot_suffix IS NOT NULL;
CREATE INDEX idx_cottage_fraction ON property.locations(lot_fraction) WHERE lot_fraction IS NOT NULL;

-- Update the check constraint to be more flexible
ALTER TABLE property.locations
ADD CONSTRAINT valid_cottage_id CHECK (
    cottage_id IS NULL OR cottage_id ~ '^[0-9]+-[0-9]+[A-Za-z]?(\s+[0-9]+/[0-9]+)?(\s+[NSEW]\s+[0-9]+/[0-9]+)?$'
);