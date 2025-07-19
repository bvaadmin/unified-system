# Migration Implementation Guide

## Overview
This guide provides step-by-step instructions for safely implementing the comprehensive Bay View database system while protecting existing data.

## Pre-Migration Checklist

### Prerequisites
- [ ] Full database backup completed
- [ ] All stakeholders notified
- [ ] Development environment tested
- [ ] Rollback procedures reviewed
- [ ] Export utility tested
- [ ] Migration testing framework installed

### Environment Setup
```bash
# Install dependencies
npm install pg csv-parse csv-stringify chalk cli-table3

# Set environment variables
export DATABASE_URL="postgresql://..."
export BACKUP_DIR="/path/to/backups"

# Create backup
node scripts/database/export-import-utility.js export $BACKUP_DIR/pre-migration-$(date +%Y%m%d)
```

## Phase 1: Foundation Setup (Week 1-2)

### Step 1.1: Create Migration Schema
```bash
# Run migration foundation script
psql $DATABASE_URL << EOF
-- Create migration schema
CREATE SCHEMA IF NOT EXISTS migration;

-- Create version tracking
CREATE TABLE migration.schema_versions (
    id SERIAL PRIMARY KEY,
    version VARCHAR(20) NOT NULL,
    description TEXT,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    rollback_script TEXT,
    status VARCHAR(20) DEFAULT 'applied'
);

-- Create new schemas (doesn't affect existing)
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS property;
CREATE SCHEMA IF NOT EXISTS education;
CREATE SCHEMA IF NOT EXISTS events;
CREATE SCHEMA IF NOT EXISTS recreation;
CREATE SCHEMA IF NOT EXISTS finance;

-- Record this migration
INSERT INTO migration.schema_versions (version, description, rollback_script)
VALUES ('001', 'Create foundation schemas', 
'DROP SCHEMA IF EXISTS finance CASCADE;
DROP SCHEMA IF EXISTS recreation CASCADE;
DROP SCHEMA IF EXISTS events CASCADE;
DROP SCHEMA IF EXISTS education CASCADE;
DROP SCHEMA IF EXISTS property CASCADE;
DROP SCHEMA IF EXISTS core CASCADE;');
EOF
```

### Step 1.2: Deploy Database Abstraction Layer
```bash
# Copy DAL files
cp scripts/database/adapters/*.js lib/database/adapters/

# Test the adapters
node -e "
import { LegacyAdapter } from './lib/database/adapters/legacy-adapter.js';
import { Client } from 'pg';

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const adapter = new LegacyAdapter(client);
const memorial = await adapter.getMemorial(1);
console.log('Legacy adapter working:', memorial ? 'YES' : 'NO');

await client.end();
"
```

### Step 1.3: Run Initial Tests
```bash
# Run migration testing framework
node scripts/database/migration-testing-framework.js --output=test-results-phase1.json

# Check results
cat test-results-phase1.json | jq '.summary'
```

## Phase 2: Parallel Implementation (Week 3-6)

### Step 2.1: Create Core Tables
```sql
-- Create persons table alongside existing data
BEGIN;

CREATE TABLE core.persons (
    id SERIAL PRIMARY KEY,
    
    -- Link to legacy data
    legacy_memorial_id INTEGER REFERENCES bayview.memorials(id),
    legacy_chapel_app_id INTEGER REFERENCES crouse_chapel.service_applications(id),
    
    -- Core fields
    person_type VARCHAR(50) NOT NULL CHECK (person_type IN (
        'member', 'guest', 'staff', 'artist', 'instructor', 'vendor', 'deceased'
    )),
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    maiden_name VARCHAR(100),
    date_of_birth DATE,
    
    -- Contact
    primary_email VARCHAR(200),
    primary_phone VARCHAR(20),
    
    -- Tracking
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    migration_source VARCHAR(50),
    migration_date TIMESTAMP WITH TIME ZONE,
    
    -- Indexes
    CONSTRAINT unique_legacy_memorial UNIQUE (legacy_memorial_id),
    CONSTRAINT unique_legacy_chapel UNIQUE (legacy_chapel_app_id)
);

CREATE INDEX idx_persons_type ON core.persons(person_type);
CREATE INDEX idx_persons_name ON core.persons(last_name, first_name);
CREATE INDEX idx_persons_email ON core.persons(primary_email);

-- Record migration
INSERT INTO migration.schema_versions (version, description, rollback_script)
VALUES ('002', 'Create core.persons table', 'DROP TABLE IF EXISTS core.persons CASCADE;');

COMMIT;
```

### Step 2.2: Create Compatibility Views
```sql
BEGIN;

-- View for backward compatibility
CREATE OR REPLACE VIEW migration.memorial_persons AS
SELECT 
    m.id as memorial_id,
    p.id as person_id,
    COALESCE(p.first_name, m.first_name) as first_name,
    COALESCE(p.last_name, m.last_name) as last_name,
    COALESCE(p.middle_name, m.middle_name) as middle_name,
    m.birth_date,
    m.death_date,
    m.created_at as memorial_created,
    p.created_at as person_created,
    CASE 
        WHEN p.id IS NULL THEN 'legacy_only'
        ELSE 'migrated'
    END as migration_status
FROM bayview.memorials m
LEFT JOIN core.persons p ON p.legacy_memorial_id = m.id;

-- Grant permissions
GRANT SELECT ON migration.memorial_persons TO PUBLIC;

INSERT INTO migration.schema_versions (version, description, rollback_script)
VALUES ('003', 'Create compatibility views', 'DROP VIEW IF EXISTS migration.memorial_persons;');

COMMIT;
```

### Step 2.3: Implement Dual-Write Pattern
```javascript
// api/lib/dual-write-manager.js
export class DualWriteManager {
    constructor(legacyAdapter, modernAdapter) {
        this.legacy = legacyAdapter;
        this.modern = modernAdapter;
        this.mode = process.env.DUAL_WRITE_MODE || 'legacy-only';
    }
    
    async createMemorial(data) {
        const results = {};
        
        // Always write to legacy first
        if (this.mode !== 'modern-only') {
            results.legacy = await this.legacy.createMemorial(data);
        }
        
        // Write to modern if enabled
        if (this.mode === 'dual' || this.mode === 'modern-only') {
            const personData = {
                person_type: 'deceased',
                first_name: data.first_name,
                last_name: data.last_name,
                middle_name: data.middle_name,
                date_of_birth: data.birth_date,
                legacy_memorial_id: results.legacy?.id,
                migration_source: 'dual_write_v1'
            };
            
            results.modern = await this.modern.createPerson(personData);
        }
        
        return results;
    }
}
```

### Step 2.4: Test Dual-Write
```bash
# Enable dual-write mode
export DUAL_WRITE_MODE=dual

# Test with a real submission
curl -X POST https://bvaadmin.vercel.app/api/memorial/submit-garden \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Test",
    "last_name": "User",
    "birth_date": "1950-01-01",
    "death_date": "2024-01-01"
  }'

# Verify both records created
psql $DATABASE_URL -c "
SELECT 
    m.id as memorial_id,
    p.id as person_id,
    m.first_name,
    p.first_name as person_first_name
FROM bayview.memorials m
LEFT JOIN core.persons p ON p.legacy_memorial_id = m.id
WHERE m.first_name = 'Test'
"
```

## Phase 3: Historical Data Migration (Week 7-8)

### Step 3.1: Migrate Existing Memorials
```javascript
// scripts/migrate-memorials.js
import { DatabaseMigrator } from './database/migrator.js';

const migrator = new DatabaseMigrator({
    batchSize: 100,
    dryRun: false
});

// First do a dry run
console.log('Starting dry run...');
migrator.dryRun = true;
const dryResults = await migrator.migrateMemorialsToPeople();
console.log('Dry run results:', dryResults);

// If OK, do real migration
if (dryResults.errors.length === 0) {
    console.log('Starting real migration...');
    migrator.dryRun = false;
    const results = await migrator.migrateMemorialsToPeople();
    console.log('Migration complete:', results);
} else {
    console.error('Dry run failed, aborting');
}
```

### Step 3.2: Validate Migration
```bash
# Run validation tests
node scripts/database/migration-testing-framework.js --output=test-results-phase3.json

# Check specific validations
psql $DATABASE_URL << EOF
-- Check all memorials have corresponding persons
SELECT 
    COUNT(*) as total_memorials,
    COUNT(p.id) as migrated_count,
    COUNT(*) - COUNT(p.id) as missing_count
FROM bayview.memorials m
LEFT JOIN core.persons p ON p.legacy_memorial_id = m.id;

-- Check data integrity
SELECT 
    m.id,
    m.first_name || ' ' || m.last_name as memorial_name,
    p.first_name || ' ' || p.last_name as person_name,
    CASE 
        WHEN m.first_name = p.first_name AND m.last_name = p.last_name 
        THEN 'MATCH' 
        ELSE 'MISMATCH' 
    END as status
FROM bayview.memorials m
JOIN core.persons p ON p.legacy_memorial_id = m.id
WHERE m.first_name != p.first_name OR m.last_name != p.last_name;
EOF
```

## Phase 4: Testing & Validation (Week 9-10)

### Step 4.1: Performance Testing
```bash
# Run performance benchmarks
psql $DATABASE_URL << EOF
-- Test query performance
\timing on

-- Legacy query
EXPLAIN ANALYZE
SELECT * FROM bayview.memorials WHERE last_name = 'Smith';

-- Modern query
EXPLAIN ANALYZE  
SELECT * FROM core.persons WHERE last_name = 'Smith' AND person_type = 'deceased';

-- Join query
EXPLAIN ANALYZE
SELECT 
    p.*,
    m.death_date,
    m.message
FROM core.persons p
JOIN bayview.memorials m ON p.legacy_memorial_id = m.id
WHERE p.last_name = 'Smith';
EOF
```

### Step 4.2: API Compatibility Testing
```javascript
// test/api-compatibility.test.js
import { expect } from 'chai';
import { LegacyAPI } from '../api/legacy';
import { ModernAPI } from '../api/modern';

describe('API Compatibility', () => {
    it('should return same data from both APIs', async () => {
        const memorialId = 1;
        
        const legacyData = await LegacyAPI.getMemorial(memorialId);
        const modernData = await ModernAPI.getPersonByMemorialId(memorialId);
        
        expect(modernData.first_name).to.equal(legacyData.first_name);
        expect(modernData.last_name).to.equal(legacyData.last_name);
    });
});
```

### Step 4.3: Rollback Testing
```bash
# Test rollback procedure
psql $DATABASE_URL << EOF
-- Start transaction
BEGIN;

-- Simulate problem
DROP TABLE core.persons CASCADE;

-- Check impact
SELECT COUNT(*) FROM migration.memorial_persons;  -- Should fail

-- Rollback
ROLLBACK;

-- Verify system intact
SELECT COUNT(*) FROM core.persons;  -- Should work
EOF
```

## Phase 5: Cutover Planning (Week 11-12)

### Step 5.1: Create Cutover Checklist
```markdown
## Cutover Checklist

### Pre-Cutover (T-24 hours)
- [ ] Final backup completed
- [ ] All tests passing
- [ ] Stakeholders notified
- [ ] Maintenance window scheduled
- [ ] Rollback plan reviewed

### Cutover (T-0)
- [ ] Enable maintenance mode
- [ ] Final data sync
- [ ] Switch to dual-write mode
- [ ] Verify dual writes working
- [ ] Run smoke tests

### Post-Cutover (T+1 hour)
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Verify data integrity
- [ ] User acceptance testing
- [ ] Disable maintenance mode

### Stabilization (T+24 hours)
- [ ] Review logs for issues
- [ ] Address any problems
- [ ] Plan next phase
- [ ] Document lessons learned
```

### Step 5.2: Monitoring Setup
```javascript
// monitoring/migration-monitor.js
export class MigrationMonitor {
    async checkHealth() {
        const metrics = {
            timestamp: new Date(),
            dualWriteMode: process.env.DUAL_WRITE_MODE,
            checks: {}
        };
        
        // Check record counts
        metrics.checks.recordCounts = await this.checkRecordCounts();
        
        // Check sync status
        metrics.checks.syncStatus = await this.checkSyncStatus();
        
        // Check performance
        metrics.checks.performance = await this.checkPerformance();
        
        return metrics;
    }
    
    async checkRecordCounts() {
        const legacy = await db.query('SELECT COUNT(*) FROM bayview.memorials');
        const modern = await db.query('SELECT COUNT(*) FROM core.persons WHERE migration_source IS NOT NULL');
        
        return {
            legacy: legacy.rows[0].count,
            modern: modern.rows[0].count,
            synced: legacy.rows[0].count === modern.rows[0].count
        };
    }
}
```

## Emergency Procedures

### If Migration Fails
```bash
# 1. Stop all operations
export DUAL_WRITE_MODE=legacy-only

# 2. Assess damage
psql $DATABASE_URL -c "
SELECT 
    version,
    description,
    applied_at,
    status
FROM migration.schema_versions
ORDER BY version DESC
LIMIT 5;
"

# 3. Rollback if needed
node scripts/database/rollback.js --to-version=001

# 4. Restore from backup if rollback fails
node scripts/database/export-import-utility.js import $BACKUP_DIR/pre-migration-20240718
```

### Communication Templates
```markdown
## Issue Notification
Subject: Bay View Database Migration - Issue Detected

We've detected an issue during the database migration at [TIME].
Current status: [Investigating/Resolving/Resolved]
Impact: [None/Minimal/Significant]
Action required: [None/Please retry/Please wait]

We'll update you within [30 minutes].

## Success Notification  
Subject: Bay View Database Migration - Phase [X] Complete

Phase [X] of the database migration completed successfully.
- Records migrated: [COUNT]
- Performance impact: None
- Next phase: [DATE]

No action required. System operating normally.
```

## Post-Migration Tasks

### Documentation Updates
- [ ] Update API documentation
- [ ] Update developer guides
- [ ] Create user guides
- [ ] Document lessons learned

### Cleanup Tasks
- [ ] Remove temporary tables
- [ ] Archive old backups
- [ ] Optimize indexes
- [ ] Update monitoring

### Next Phase Planning
- [ ] Review phase results
- [ ] Plan next components
- [ ] Update timeline
- [ ] Schedule reviews

This implementation guide ensures a safe, reversible migration process with clear checkpoints and rollback procedures at every step.