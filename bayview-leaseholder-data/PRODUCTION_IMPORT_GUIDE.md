# Bay View Cottage Leaseholder Import - Production Guide

## Overview
This guide documents the secure process for importing 312 cottage leaseholder records from the Bay View network file share into the production database.

## Data Source
- **Location**: `\\bayview-fs\BVAData\Clients\`
- **Files**: 
  - `leaseholders per cottage sorted by name.xlsx`
  - `leaseholders per cottage.xlsx`
- **Records**: 312 cottage properties with leaseholder information

## Security Requirements
1. **NO sensitive data in version control** - .gitignore configured
2. **Local processing only** - no cloud storage
3. **Delete after import** - remove local copies
4. **Audit trail** - all imports logged with timestamp

## Pre-Import Checklist
- [ ] Database backup completed
- [ ] Test import successful with anonymized data
- [ ] Production credentials configured
- [ ] Bay View network access confirmed
- [ ] Local directory prepared with .gitignore

## Import Process

### Step 1: Secure File Copy
```bash
# Create secure working directory
cd /Users/sam/dev/bvaadmin/unified-system/bayview-leaseholder-data

# Copy Excel file from network (use scp from ssh-bva-pc02)
# DO NOT commit this file to git
```

### Step 2: Verify Database Connection
```bash
# Test connection
node test-db-connection.js

# Check schema structure
node check-database-schema.js
```

### Step 3: Run Import Script
```bash
# For production import with real data
NODE_ENV=production node import-cottage-leaseholders-excel.js --production "path/to/excel-file.xlsx"

# Monitor progress - script will show:
# - Properties created
# - Persons created
# - Leaseholds established
# - Members linked
```

### Step 4: Verify Import
```sql
-- Check import totals
SELECT 
  COUNT(DISTINCT l.id) as total_leaseholds,
  COUNT(DISTINCT l.property_id) as unique_properties,
  COUNT(DISTINCT l.person_id) as unique_persons,
  COUNT(DISTINCT CASE WHEN l.voting_rights THEN l.id END) as voting_leaseholders,
  COUNT(DISTINCT m.id) as active_members
FROM property.leaseholds l
LEFT JOIN core.members m ON l.person_id = m.person_id
WHERE l.created_at >= CURRENT_DATE;

-- Verify all 312 properties
SELECT COUNT(*) FROM property.locations 
WHERE property_type = 'cottage';

-- Sample verification
SELECT 
  loc.block_number, loc.lot_number,
  p.first_name || ' ' || p.last_name as leaseholder_name,
  l.voting_rights, l.lease_start_date
FROM property.leaseholds l
JOIN property.locations loc ON l.property_id = loc.id
JOIN core.persons p ON l.person_id = p.person_id
ORDER BY loc.block_number, loc.lot_number
LIMIT 10;
```

### Step 5: Clean Up
```bash
# Remove local Excel file
rm -f *.xlsx

# Clear any temporary files
rm -rf temp/

# Verify no sensitive data remains
ls -la
```

## Database Schema Mapping

### Excel Columns → Database Tables
1. **Block & Lot** → `property.locations`
   - block_number, lot_number
   - property_type = 'cottage'
   - lease_status = 'active'

2. **Leaseholder Name** → `core.persons`
   - first_name, last_name
   - person_type = 'member'
   - primary_email, primary_phone

3. **Lease Relationship** → `property.leaseholds`
   - property_id, person_id
   - lease_type = 'perpetual_leasehold'
   - is_primary_leaseholder = true
   - voting_rights from data

4. **Active Members** → `core.members`
   - person_id reference
   - member_number = 'L[year]-[sequence]'
   - membership_type = 'leaseholder'
   - status = 'active'
   - cottage_privileges = true

## Error Handling
- Transaction-based import (all or nothing)
- Detailed error logging per record
- Duplicate detection (won't create duplicates)
- Constraint validation before insert

## Post-Import Tasks
1. Update project management system - mark task complete
2. Notify stakeholders of successful import
3. Document any data quality issues found
4. Schedule legacy system archival

## Rollback Procedure
If issues occur:
```sql
-- Identify today's imports
SELECT id, created_at FROM property.leaseholds 
WHERE created_at >= CURRENT_DATE;

-- If needed, restore from backup
-- Contact DBA for backup restoration
```

## Support Contacts
- Database Admin: Marcus Chen
- Project Lead: Sarah Mitchell
- Bay View IT: (contact for network access)

## Important Notes
- This import establishes the foundation for the property management system
- All 312 cottages must be accounted for
- Leaseholder records connect to all other Bay View systems
- Preserve authentic Bay View terminology (leaseholder, not owner)

---
Generated: 2025-07-19
Task ID: 24 (Bay View System Launch - Import active cottage leaseholders)