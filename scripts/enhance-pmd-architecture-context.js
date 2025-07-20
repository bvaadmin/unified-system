#!/usr/bin/env node

/**
 * Enhanced PMD Architecture Context
 * Adds dual-write architecture awareness and safety patterns to tasks
 */

import pg from 'pg';
import dotenv from 'dotenv';

const { Client } = pg;
dotenv.config();

async function enhancePMDArchitectureContext() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('🏗️ Enhancing PMD with architecture context...');

    // 1. Add architecture patterns table
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_mgmt.architecture_patterns (
        id SERIAL PRIMARY KEY,
        pattern_name VARCHAR(100) NOT NULL,
        pattern_type VARCHAR(50) NOT NULL, -- 'Safety', 'Performance', 'Integration'
        description TEXT NOT NULL,
        when_required TEXT NOT NULL,
        implementation_guide TEXT NOT NULL,
        violation_consequences TEXT NOT NULL,
        components_affected TEXT[] NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Add task-pattern relationships
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_mgmt.task_architecture_requirements (
        id SERIAL PRIMARY KEY,
        task_id INTEGER REFERENCES project_mgmt.tasks(id),
        pattern_id INTEGER REFERENCES project_mgmt.architecture_patterns(id),
        compliance_level VARCHAR(20) DEFAULT 'Required', -- 'Required', 'Recommended', 'Optional'
        validation_method TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Insert Bay View architecture patterns
    const patterns = [
      {
        name: 'Dual-Write Safety Pattern',
        type: 'Safety',
        description: 'All database modifications must write to both PostgreSQL (primary) and Notion (workflow) to ensure zero data loss during 150-year-old system migration',
        when_required: 'Any task involving database writes (INSERT, UPDATE, DELETE) in chapel, memorial, finance, or member systems',
        implementation: `
REQUIRED PATTERN:
\`\`\`javascript
// 1. Write to PostgreSQL first (source of truth)
const pgResult = await client.query('INSERT INTO table...', params);

// 2. Transform data for Notion
const notionData = transformForNotion(pgResult.rows[0]);

// 3. Write to Notion (workflow management)
await createNotionPage(NOTION_DB_ID, notionData);

// 4. Log dual-write success
console.log('✅ Dual-write completed for record:', pgResult.rows[0].id);
\`\`\`

NEVER write to only one system - this risks 150 years of Bay View history.`,
        consequences: 'CRITICAL: Data loss, broken workflow tracking, legacy system corruption, potential loss of historical records dating to 1875',
        components: ['Chapel API', 'Memorial API', 'Finance System', 'Member Database', 'Legacy Systems']
      },
      {
        name: 'Bay View Terminology Preservation',
        type: 'Integration',
        description: 'Preserve authentic Bay View terminology reflecting 150-year Chautauqua heritage: leaseholder (not owner), Block/Lot (not address), member (not customer)',
        when_required: 'All user-facing interfaces, database schemas, API responses, and documentation',
        implementation: `
CORRECT TERMINOLOGY:
- "Leaseholder" NOT "Owner" (properties are perpetual leases, not ownership)
- "Block 12 Lot 7" NOT "Address" (authentic Bay View property identification)
- "Member" NOT "Customer" (Bay View Association membership community)
- "Program Director" NOT "Manager" (committee-based governance structure)
- "Summer Season" NOT "Fiscal Year" (May-September operational cycle)`,
        consequences: 'Cultural authenticity loss, member confusion, breaks 150-year terminology traditions',
        components: ['All User Interfaces', 'API Responses', 'Database Schemas', 'Documentation']
      },
      {
        name: 'Migration Safety Validation',
        type: 'Safety',
        description: 'All migration operations must include rollback procedures, data validation, and backup verification before execution',
        when_required: 'Tasks involving data migration, schema changes, or legacy system modifications',
        implementation: `
MIGRATION SAFETY CHECKLIST:
1. Create full backup with verification
2. Test migration on copy of production data
3. Implement automatic rollback triggers
4. Validate data integrity post-migration
5. Maintain read-only legacy access during transition
6. Document rollback procedures

\`\`\`javascript
// Required pattern for all migrations
await validateBackupIntegrity();
await testMigrationOnCopy();
const rollbackPlan = await createRollbackProcedure();
await executeMigrationWithSafeguards(rollbackPlan);
await validateDataIntegrity();
\`\`\``,
        consequences: 'Data corruption, system downtime, loss of 150 years of historical records, member service disruption',
        components: ['Core Database', 'Legacy Systems', 'Migration Scripts', 'Backup Systems']
      }
    ];

    // Insert patterns
    for (const pattern of patterns) {
      await client.query(`
        INSERT INTO project_mgmt.architecture_patterns 
        (pattern_name, pattern_type, description, when_required, implementation_guide, violation_consequences, components_affected)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT DO NOTHING
      `, [
        pattern.name,
        pattern.type,
        pattern.description,
        pattern.when_required,
        pattern.implementation,
        pattern.consequences,
        pattern.components
      ]);
    }

    // 4. Create architecture-aware view for agents
    await client.query(`
      CREATE OR REPLACE VIEW project_mgmt.v_agent_architecture_context AS
      SELECT 
        t.id as task_id,
        t.name as task_name,
        t.components,
        t.task_type,
        ARRAY_AGG(DISTINCT p.pattern_name) as required_patterns,
        STRING_AGG(DISTINCT p.implementation_guide, '\n\n---\n\n') as implementation_guide,
        STRING_AGG(DISTINCT p.violation_consequences, '; ') as consequences
      FROM project_mgmt.tasks t
      LEFT JOIN project_mgmt.task_architecture_requirements tar ON t.id = tar.task_id
      LEFT JOIN project_mgmt.architecture_patterns p ON tar.pattern_id = p.id
      WHERE t.status IN ('To Do', 'In Progress', 'Backlog')
      GROUP BY t.id, t.name, t.components, t.task_type;
    `);

    console.log('✅ Architecture patterns added to PMD');

  } catch (error) {
    console.error('❌ Error enhancing PMD architecture context:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  enhancePMDArchitectureContext().catch(console.error);
}

export { enhancePMDArchitectureContext };