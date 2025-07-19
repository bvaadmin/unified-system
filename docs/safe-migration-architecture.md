# Safe Migration Architecture for Bay View Association

## Overview
This document outlines a careful, reversible approach to implementing the comprehensive database system while protecting existing data and maintaining full operational continuity.

## Core Principles

1. **Zero Data Loss**: Existing data is never modified or deleted
2. **Always Reversible**: Every change can be rolled back
3. **Gradual Migration**: Implement in small, testable phases
4. **Dual Operation**: Old and new systems run in parallel
5. **Clear Documentation**: Every change is documented and scripted

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │  Existing APIs  │  │ Migration APIs  │  │  New APIs   │ │
│  └────────┬────────┘  └────────┬────────┘  └──────┬──────┘ │
│           │                    │                    │        │
│  ┌────────▼────────────────────▼────────────────────▼──────┐│
│  │              Database Abstraction Layer (DAL)            ││
│  │  ┌──────────┐  ┌──────────────┐  ┌─────────────────┐   ││
│  │  │ Legacy   │  │  Bridge      │  │  Modern         │   ││
│  │  │ Adapter  │  │  Adapter     │  │  Adapter        │   ││
│  │  └────┬─────┘  └──────┬───────┘  └────────┬────────┘   ││
│  └───────┼────────────────┼───────────────────┼────────────┘│
└──────────┼────────────────┼───────────────────┼─────────────┘
           │                │                   │
┌──────────▼────────┐ ┌─────▼──────┐ ┌─────────▼─────────────┐
│  Legacy Schemas   │ │   Bridge   │ │    New Schemas        │
│  ┌─────────────┐  │ │   Views    │ │  ┌────────────────┐  │
│  │ bayview     │  │ │ ┌────────┐ │ │  │ core           │  │
│  │ crouse_     │  │ │ │ legacy_│ │ │  │ property       │  │
│  │ chapel      │  │ │ │ to_new │ │ │  │ education      │  │
│  └─────────────┘  │ │ └────────┘ │ │  │ events         │  │
│   (Protected)     │ └────────────┘ │  │ finance        │  │
└───────────────────┘                │  └────────────────┘  │
                                     │   (New System)        │
                                     └───────────────────────┘
```

## Phase 1: Foundation (Weeks 1-2)

### 1.1 Create New Schema Structure
```sql
-- Create new schemas without touching existing ones
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS property;
CREATE SCHEMA IF NOT EXISTS education;
CREATE SCHEMA IF NOT EXISTS events;
CREATE SCHEMA IF NOT EXISTS recreation;
CREATE SCHEMA IF NOT EXISTS finance;
CREATE SCHEMA IF NOT EXISTS migration;

-- Version tracking table
CREATE TABLE migration.schema_versions (
    id SERIAL PRIMARY KEY,
    version VARCHAR(20) NOT NULL,
    description TEXT,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    rollback_script TEXT,
    status VARCHAR(20) DEFAULT 'applied' CHECK (status IN ('applied', 'rolled_back'))
);
```

### 1.2 Database Abstraction Layer
```javascript
// lib/database/adapters/base-adapter.js
class BaseAdapter {
    constructor(pgClient) {
        this.pgClient = pgClient;
    }
    
    async transaction(callback) {
        await this.pgClient.query('BEGIN');
        try {
            const result = await callback(this.pgClient);
            await this.pgClient.query('COMMIT');
            return result;
        } catch (error) {
            await this.pgClient.query('ROLLBACK');
            throw error;
        }
    }
}

// lib/database/adapters/legacy-adapter.js
class LegacyAdapter extends BaseAdapter {
    async getMemorial(id) {
        const result = await this.pgClient.query(
            'SELECT * FROM bayview.memorials WHERE id = $1',
            [id]
        );
        return result.rows[0];
    }
}

// lib/database/adapters/modern-adapter.js
class ModernAdapter extends BaseAdapter {
    async getPerson(id) {
        const result = await this.pgClient.query(
            'SELECT * FROM core.persons WHERE id = $1',
            [id]
        );
        return result.rows[0];
    }
}

// lib/database/adapters/bridge-adapter.js
class BridgeAdapter extends BaseAdapter {
    constructor(pgClient, legacyAdapter, modernAdapter) {
        super(pgClient);
        this.legacy = legacyAdapter;
        this.modern = modernAdapter;
    }
    
    async getPersonFromMemorial(memorialId) {
        // First check modern system
        const modern = await this.modern.getPersonByMemorialId(memorialId);
        if (modern) return modern;
        
        // Fall back to legacy
        const legacy = await this.legacy.getMemorial(memorialId);
        return this.transformLegacyToModern(legacy);
    }
}
```

### 1.3 Integration Attachment Points
```javascript
// lib/database/integration-points.js
export class IntegrationPoints {
    constructor(dal) {
        this.dal = dal;
    }
    
    // Webhook system for external integrations
    async registerWebhook(event, url, options = {}) {
        return await this.dal.createWebhook({
            event_type: event,
            callback_url: url,
            retry_policy: options.retryPolicy || 'exponential',
            max_retries: options.maxRetries || 3,
            active: true
        });
    }
    
    // Event emission for internal integrations
    async emitEvent(eventType, payload) {
        // Store in event log
        await this.dal.createEvent({
            event_type: eventType,
            payload: JSON.stringify(payload),
            created_at: new Date()
        });
        
        // Trigger webhooks
        const webhooks = await this.dal.getActiveWebhooks(eventType);
        for (const webhook of webhooks) {
            await this.triggerWebhook(webhook, payload);
        }
    }
    
    // Data export for portability
    async exportData(entityType, format = 'json', filters = {}) {
        const data = await this.dal.getData(entityType, filters);
        
        switch (format) {
            case 'json':
                return JSON.stringify(data, null, 2);
            case 'csv':
                return this.convertToCSV(data);
            case 'sql':
                return this.generateSQLInserts(data);
            default:
                throw new Error(`Unsupported format: ${format}`);
        }
    }
}
```

## Phase 2: Parallel Implementation (Weeks 3-6)

### 2.1 Build New Tables Alongside Existing
```sql
-- New person table (doesn't interfere with existing data)
CREATE TABLE core.persons (
    id SERIAL PRIMARY KEY,
    -- Link to legacy data
    legacy_memorial_id INTEGER REFERENCES bayview.memorials(id),
    legacy_chapel_app_id INTEGER REFERENCES crouse_chapel.service_applications(id),
    
    -- Modern fields
    person_type VARCHAR(50) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure we can always trace back
    migration_source VARCHAR(50),
    migration_date TIMESTAMP WITH TIME ZONE
);

-- Create views for backward compatibility
CREATE OR REPLACE VIEW migration.memorial_persons AS
SELECT 
    m.id as memorial_id,
    p.id as person_id,
    COALESCE(p.first_name, m.first_name) as first_name,
    COALESCE(p.last_name, m.last_name) as last_name,
    m.created_at as memorial_created,
    p.created_at as person_created
FROM bayview.memorials m
LEFT JOIN core.persons p ON p.legacy_memorial_id = m.id;
```

### 2.2 Dual-Write Pattern
```javascript
// lib/database/dual-write.js
export class DualWriteManager {
    constructor(legacyAdapter, modernAdapter) {
        this.legacy = legacyAdapter;
        this.modern = modernAdapter;
        this.mode = 'dual'; // 'legacy-only', 'dual', 'modern-only'
    }
    
    async createMemorial(data) {
        const results = {
            legacy: null,
            modern: null,
            status: 'pending'
        };
        
        try {
            // Always write to legacy first (source of truth)
            if (this.mode === 'legacy-only' || this.mode === 'dual') {
                results.legacy = await this.legacy.createMemorial(data);
            }
            
            // Then write to modern if enabled
            if (this.mode === 'dual' || this.mode === 'modern-only') {
                const modernData = this.transformToModern(data);
                results.modern = await this.modern.createPerson(modernData);
                
                // Link them
                if (results.legacy && results.modern) {
                    await this.modern.linkToLegacy(
                        results.modern.id,
                        'memorial',
                        results.legacy.id
                    );
                }
            }
            
            results.status = 'success';
            return results;
            
        } catch (error) {
            // Log discrepancy for investigation
            await this.logDualWriteError(error, data, results);
            
            // In dual mode, legacy success is sufficient
            if (this.mode === 'dual' && results.legacy) {
                results.status = 'partial';
                return results;
            }
            
            throw error;
        }
    }
}
```

## Phase 3: Migration Tools (Weeks 7-8)

### 3.1 Reversible Migration Scripts
```sql
-- migrations/001_create_core_schema.up.sql
BEGIN;

CREATE SCHEMA IF NOT EXISTS core;

CREATE TABLE core.persons (
    id SERIAL PRIMARY KEY,
    -- ... fields ...
);

-- Record this migration
INSERT INTO migration.schema_versions (version, description, rollback_script)
VALUES ('001', 'Create core schema and persons table', 
'DROP TABLE IF EXISTS core.persons CASCADE; DROP SCHEMA IF EXISTS core CASCADE;');

COMMIT;

-- migrations/001_create_core_schema.down.sql
BEGIN;

-- Remove the migration record
UPDATE migration.schema_versions 
SET status = 'rolled_back' 
WHERE version = '001';

-- Execute the rollback
DROP TABLE IF EXISTS core.persons CASCADE;
DROP SCHEMA IF EXISTS core CASCADE;

COMMIT;
```

### 3.2 Data Migration Utilities
```javascript
// scripts/migration/migrate-data.js
import { MigrationManager } from '../../lib/database/migration-manager.js';

class DataMigrator {
    constructor(config) {
        this.config = config;
        this.batchSize = config.batchSize || 100;
        this.dryRun = config.dryRun || false;
    }
    
    async migrateMemorialsToPeople() {
        const progress = {
            total: 0,
            migrated: 0,
            errors: [],
            startTime: new Date()
        };
        
        // Count total records
        const countResult = await this.pgClient.query(
            'SELECT COUNT(*) FROM bayview.memorials'
        );
        progress.total = parseInt(countResult.rows[0].count);
        
        console.log(`Starting migration of ${progress.total} memorial records...`);
        
        // Process in batches
        let offset = 0;
        while (offset < progress.total) {
            const batch = await this.pgClient.query(
                'SELECT * FROM bayview.memorials ORDER BY id LIMIT $1 OFFSET $2',
                [this.batchSize, offset]
            );
            
            for (const memorial of batch.rows) {
                try {
                    if (!this.dryRun) {
                        await this.migrateMemorial(memorial);
                    }
                    progress.migrated++;
                } catch (error) {
                    progress.errors.push({
                        id: memorial.id,
                        error: error.message
                    });
                }
            }
            
            // Progress report
            console.log(`Progress: ${progress.migrated}/${progress.total} (${
                Math.round(progress.migrated / progress.total * 100)
            }%)`);
            
            offset += this.batchSize;
        }
        
        // Final report
        progress.endTime = new Date();
        progress.duration = progress.endTime - progress.startTime;
        
        await this.saveProgressReport(progress);
        return progress;
    }
    
    async migrateMemorial(memorial) {
        // Check if already migrated
        const existing = await this.pgClient.query(
            'SELECT id FROM core.persons WHERE legacy_memorial_id = $1',
            [memorial.id]
        );
        
        if (existing.rows.length > 0) {
            console.log(`Memorial ${memorial.id} already migrated`);
            return;
        }
        
        // Create person record
        const person = await this.pgClient.query(`
            INSERT INTO core.persons (
                person_type,
                first_name,
                last_name,
                legacy_memorial_id,
                migration_source,
                migration_date
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `, [
            'deceased',
            memorial.first_name,
            memorial.last_name,
            memorial.id,
            'memorial_migration_v1',
            new Date()
        ]);
        
        return person.rows[0];
    }
}
```

## Phase 4: Testing and Validation (Weeks 9-10)

### 4.1 Validation Framework
```javascript
// lib/validation/migration-validator.js
export class MigrationValidator {
    constructor(legacyAdapter, modernAdapter) {
        this.legacy = legacyAdapter;
        this.modern = modernAdapter;
    }
    
    async validateDataIntegrity() {
        const results = {
            status: 'pending',
            checks: [],
            errors: []
        };
        
        // Check 1: Record counts match
        const legacyCount = await this.legacy.getMemorialCount();
        const modernCount = await this.modern.getPersonCount({
            type: 'deceased',
            source: 'memorial_migration_v1'
        });
        
        results.checks.push({
            name: 'record_count',
            expected: legacyCount,
            actual: modernCount,
            passed: legacyCount === modernCount
        });
        
        // Check 2: Data integrity
        const sample = await this.legacy.getRandomMemorials(100);
        for (const memorial of sample) {
            const modern = await this.modern.getPersonByLegacyId(
                'memorial',
                memorial.id
            );
            
            if (!modern) {
                results.errors.push({
                    type: 'missing_record',
                    legacy_id: memorial.id
                });
                continue;
            }
            
            // Validate field mapping
            const fieldChecks = this.validateFieldMapping(memorial, modern);
            results.checks.push(...fieldChecks);
        }
        
        results.status = results.errors.length === 0 ? 'passed' : 'failed';
        return results;
    }
    
    validateFieldMapping(legacy, modern) {
        const checks = [];
        const mappings = [
            { legacy: 'first_name', modern: 'first_name' },
            { legacy: 'last_name', modern: 'last_name' },
            // ... more field mappings
        ];
        
        for (const mapping of mappings) {
            checks.push({
                name: `field_${mapping.legacy}`,
                legacy_value: legacy[mapping.legacy],
                modern_value: modern[mapping.modern],
                passed: legacy[mapping.legacy] === modern[mapping.modern]
            });
        }
        
        return checks;
    }
}
```

### 4.2 Rollback Procedures
```javascript
// lib/database/rollback-manager.js
export class RollbackManager {
    constructor(pgClient) {
        this.pgClient = pgClient;
    }
    
    async rollbackToVersion(targetVersion) {
        // Get all migrations after target version
        const migrations = await this.pgClient.query(`
            SELECT * FROM migration.schema_versions 
            WHERE version > $1 
              AND status = 'applied'
            ORDER BY version DESC
        `, [targetVersion]);
        
        for (const migration of migrations.rows) {
            console.log(`Rolling back migration ${migration.version}...`);
            
            try {
                await this.pgClient.query('BEGIN');
                
                // Execute rollback script
                if (migration.rollback_script) {
                    await this.pgClient.query(migration.rollback_script);
                }
                
                // Update migration status
                await this.pgClient.query(
                    'UPDATE migration.schema_versions SET status = $1 WHERE id = $2',
                    ['rolled_back', migration.id]
                );
                
                await this.pgClient.query('COMMIT');
                console.log(`Successfully rolled back ${migration.version}`);
                
            } catch (error) {
                await this.pgClient.query('ROLLBACK');
                throw new Error(`Rollback failed for ${migration.version}: ${error.message}`);
            }
        }
    }
    
    async createRestorePoint(name) {
        // Export current state
        const timestamp = new Date().toISOString();
        const backupName = `restore_point_${name}_${timestamp}`;
        
        // Create backup of all data
        const schemas = ['bayview', 'crouse_chapel', 'core'];
        const backup = {};
        
        for (const schema of schemas) {
            backup[schema] = await this.exportSchema(schema);
        }
        
        // Save backup
        await this.saveBackup(backupName, backup);
        
        return {
            name: backupName,
            timestamp: timestamp,
            schemas: schemas,
            size: JSON.stringify(backup).length
        };
    }
}
```

## Phase 5: Portability Layer (Ongoing)

### 5.1 Database-Agnostic API
```javascript
// lib/database/portable-api.js
export class PortableDataAPI {
    constructor(adapter) {
        this.adapter = adapter;
    }
    
    // Standard CRUD operations that work with any adapter
    async create(entityType, data) {
        return this.adapter.create(entityType, data);
    }
    
    async read(entityType, id) {
        return this.adapter.read(entityType, id);
    }
    
    async update(entityType, id, data) {
        return this.adapter.update(entityType, id, data);
    }
    
    async delete(entityType, id) {
        return this.adapter.delete(entityType, id);
    }
    
    // Complex queries abstracted
    async query(entityType, conditions) {
        return this.adapter.query(entityType, conditions);
    }
    
    // Relationships abstracted
    async getRelated(entityType, id, relationType) {
        return this.adapter.getRelated(entityType, id, relationType);
    }
}

// Adapters for different databases
class PostgreSQLAdapter {
    async create(entityType, data) {
        const table = this.getTableName(entityType);
        const fields = Object.keys(data);
        const values = Object.values(data);
        const placeholders = fields.map((_, i) => `$${i + 1}`);
        
        const query = `
            INSERT INTO ${table} (${fields.join(', ')})
            VALUES (${placeholders.join(', ')})
            RETURNING *
        `;
        
        const result = await this.pgClient.query(query, values);
        return result.rows[0];
    }
}

class MongoDBAdapter {
    async create(entityType, data) {
        const collection = this.db.collection(entityType);
        const result = await collection.insertOne(data);
        return { ...data, _id: result.insertedId };
    }
}

class NotionAdapter {
    async create(entityType, data) {
        const databaseId = this.getDatabaseId(entityType);
        const properties = this.transformToNotionProperties(data);
        
        const response = await this.notion.pages.create({
            parent: { database_id: databaseId },
            properties: properties
        });
        
        return this.transformFromNotion(response);
    }
}
```

### 5.2 Export/Import Utilities
```javascript
// lib/database/export-import.js
export class DataPortability {
    async exportFullSystem(format = 'sql') {
        const exportData = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            schemas: {},
            metadata: {}
        };
        
        // Export all schemas
        const schemas = [
            'bayview', 'crouse_chapel', 'core', 
            'property', 'education', 'events', 'finance'
        ];
        
        for (const schema of schemas) {
            exportData.schemas[schema] = await this.exportSchema(schema, format);
        }
        
        // Export metadata
        exportData.metadata = {
            total_records: await this.countAllRecords(),
            export_format: format,
            postgresql_version: await this.getPostgreSQLVersion()
        };
        
        return exportData;
    }
    
    async exportSchema(schemaName, format) {
        switch (format) {
            case 'sql':
                return this.exportSchemaSQL(schemaName);
            case 'json':
                return this.exportSchemaJSON(schemaName);
            case 'csv':
                return this.exportSchemaCSV(schemaName);
            default:
                throw new Error(`Unsupported format: ${format}`);
        }
    }
    
    async exportSchemaSQL(schemaName) {
        // Generate CREATE TABLE statements
        const tables = await this.getTablesInSchema(schemaName);
        const sqlStatements = [];
        
        // Schema creation
        sqlStatements.push(`CREATE SCHEMA IF NOT EXISTS ${schemaName};`);
        
        for (const table of tables) {
            // Table structure
            const createTable = await this.generateCreateTable(schemaName, table);
            sqlStatements.push(createTable);
            
            // Table data
            const insertStatements = await this.generateInserts(schemaName, table);
            sqlStatements.push(...insertStatements);
            
            // Indexes
            const indexes = await this.generateIndexes(schemaName, table);
            sqlStatements.push(...indexes);
        }
        
        return sqlStatements.join('\n\n');
    }
}
```

## Implementation Timeline

### Week 1-2: Foundation
- [ ] Create migration schema and version tracking
- [ ] Implement database abstraction layer
- [ ] Set up integration points
- [ ] Create first rollback test

### Week 3-6: Parallel Implementation
- [ ] Build core.persons table
- [ ] Implement dual-write pattern
- [ ] Create backward-compatible views
- [ ] Test with real memorial data

### Week 7-8: Migration Tools
- [ ] Build data migration scripts
- [ ] Create validation framework
- [ ] Implement rollback procedures
- [ ] Document all procedures

### Week 9-10: Testing & Validation
- [ ] Run full validation suite
- [ ] Performance testing
- [ ] Rollback testing
- [ ] User acceptance testing

### Week 11-12: Gradual Cutover
- [ ] Enable dual-write for new data
- [ ] Migrate historical data in batches
- [ ] Monitor for discrepancies
- [ ] Prepare cutover plan

## Safety Checklist

### Before Each Phase
- [ ] Full backup of production database
- [ ] Test rollback procedure
- [ ] Document current state
- [ ] Notify stakeholders

### During Implementation
- [ ] Monitor error rates
- [ ] Check data integrity daily
- [ ] Maintain audit logs
- [ ] Keep legacy system unchanged

### After Each Phase
- [ ] Validate all data
- [ ] Performance benchmarks
- [ ] Update documentation
- [ ] Stakeholder sign-off

## Emergency Procedures

### If Something Goes Wrong
1. **Stop all migrations immediately**
2. **Assess the impact**
3. **Execute rollback if needed**
4. **Restore from backup if rollback fails**
5. **Document what happened**
6. **Fix and retest before proceeding**

### Rollback Commands
```bash
# Quick rollback to previous version
npm run migrate:rollback

# Rollback to specific version
npm run migrate:rollback -- --to-version=001

# Emergency restore from backup
npm run db:restore -- --backup=restore_point_phase1_2024-07-18
```

## Success Criteria

### Phase 1 Success
- Migration framework operational
- Version tracking working
- Rollback tested successfully
- No impact on existing system

### Phase 2 Success
- Dual-write working without errors
- Data integrity maintained
- Performance unchanged
- Views providing compatibility

### Phase 3 Success
- Migration tools tested
- All data validated
- Rollback procedures proven
- Documentation complete

### Phase 4 Success
- All tests passing
- Performance acceptable
- Stakeholders satisfied
- Ready for production

### Phase 5 Success
- System fully portable
- Can export/import all data
- Database-agnostic API working
- Complete documentation

This approach ensures that your existing system remains protected while building the new architecture. Every step is reversible, documented, and tested before proceeding to the next phase.