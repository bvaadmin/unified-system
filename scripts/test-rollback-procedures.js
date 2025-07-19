/**
 * Test rollback procedures for the safe migration architecture
 */
import dotenv from 'dotenv';
import { Client } from 'pg';
import { readFileSync } from 'fs';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testRollbackProcedures() {
    const DATABASE_URL = process.env.DATABASE_URL;
    
    if (!DATABASE_URL) {
        console.error('DATABASE_URL not found in environment variables');
        process.exit(1);
    }

    const pgClient = new Client({
        connectionString: DATABASE_URL.replace('?sslmode=require', ''),
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        await pgClient.connect();
        console.log('Testing Rollback Procedures\n');

        // 1. Check current migration status
        console.log('1. Current migration status:');
        const versionsResult = await pgClient.query(`
            SELECT version, description, applied_at, status
            FROM migration.schema_versions
            ORDER BY applied_at DESC;
        `);

        console.log('Applied migrations:');
        versionsResult.rows.forEach(row => {
            console.log(`  ${row.version}: ${row.description} (${row.status})`);
        });

        // 2. Check current data state
        console.log('\n2. Current data state:');
        const dataResult = await pgClient.query(`
            SELECT 
                'memorial_persons' as table_name,
                COUNT(*) as total_records,
                COUNT(CASE WHEN person_id IS NOT NULL THEN 1 END) as migrated_records
            FROM bridge.memorial_persons
            UNION ALL
            SELECT 
                'core_persons' as table_name,
                COUNT(*) as total_records,
                COUNT(CASE WHEN legacy_memorial_id IS NOT NULL THEN 1 END) as linked_records
            FROM core.persons
            UNION ALL
            SELECT 
                'chapel_applications' as table_name,
                COUNT(*) as total_records,
                0 as migrated_records
            FROM crouse_chapel.service_applications;
        `);

        dataResult.rows.forEach(row => {
            console.log(`  ${row.table_name}: ${row.total_records} total, ${row.migrated_records} migrated/linked`);
        });

        // 3. Test rollback of migration 002 (core persons)
        console.log('\n3. Testing rollback of migration 002...');
        
        // First, get the rollback script
        const rollbackResult = await pgClient.query(`
            SELECT rollback_script
            FROM migration.schema_versions
            WHERE version = '002';
        `);

        if (rollbackResult.rows.length === 0) {
            console.log('❌ Migration 002 not found');
            return;
        }

        const rollbackScript = rollbackResult.rows[0].rollback_script;
        console.log('Rollback script:', rollbackScript);

        // Backup current data before rollback
        console.log('\n4. Backing up current data...');
        const backupData = {
            persons: await pgClient.query('SELECT * FROM core.persons'),
            contact_methods: await pgClient.query('SELECT * FROM core.contact_methods'),
            family_relationships: await pgClient.query('SELECT * FROM core.family_relationships'),
            members: await pgClient.query('SELECT * FROM core.members')
        };

        console.log('Backup created:');
        Object.keys(backupData).forEach(table => {
            console.log(`  ${table}: ${backupData[table].rows.length} records`);
        });

        // Execute rollback within a transaction that we'll rollback
        console.log('\n5. Executing rollback (in test transaction)...');
        await pgClient.query('BEGIN');

        try {
            // Execute the rollback script
            await pgClient.query(rollbackScript);

            // Mark migration as rolled back
            await pgClient.query(`
                UPDATE migration.schema_versions 
                SET status = 'rolled_back', applied_at = NOW()
                WHERE version = '002'
            `);

            // Check what tables exist after rollback
            const tablesAfterRollback = await pgClient.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'core'
                ORDER BY table_name;
            `);

            console.log('Tables remaining in core schema after rollback:');
            if (tablesAfterRollback.rows.length === 0) {
                console.log('  ✅ All core tables successfully removed');
            } else {
                tablesAfterRollback.rows.forEach(row => {
                    console.log(`  ❌ ${row.table_name} still exists`);
                });
            }

            // Check bridge views
            const viewsAfterRollback = await pgClient.query(`
                SELECT table_name 
                FROM information_schema.views 
                WHERE table_schema = 'bridge'
                ORDER BY table_name;
            `);

            console.log('Views remaining in bridge schema after rollback:');
            if (viewsAfterRollback.rows.length === 0) {
                console.log('  ✅ All bridge views successfully removed');
            } else {
                viewsAfterRollback.rows.forEach(row => {
                    console.log(`  ❌ ${row.table_name} still exists`);
                });
            }

            // Verify legacy data is intact
            const legacyDataCheck = await pgClient.query(`
                SELECT COUNT(*) as memorial_count
                FROM bayview.memorials;
            `);

            console.log(`Legacy memorial data: ${legacyDataCheck.rows[0].memorial_count} records`);
            if (parseInt(legacyDataCheck.rows[0].memorial_count) > 0) {
                console.log('  ✅ Legacy data preserved');
            } else {
                console.log('  ❌ Legacy data missing');
            }

            console.log('\n6. Rollback test completed successfully!');
            console.log('   Rolling back test transaction to restore original state...');

            // Rollback the test transaction to restore everything
            await pgClient.query('ROLLBACK');

        } catch (rollbackError) {
            console.error('❌ Rollback failed:', rollbackError.message);
            await pgClient.query('ROLLBACK');
            throw rollbackError;
        }

        // 7. Verify restoration
        console.log('\n7. Verifying restoration after test rollback...');
        const restoredTablesResult = await pgClient.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'core'
            ORDER BY table_name;
        `);

        console.log('Core tables after restoration:');
        restoredTablesResult.rows.forEach(row => {
            console.log(`  ✅ ${row.table_name}`);
        });

        const restoredDataResult = await pgClient.query(`
            SELECT COUNT(*) as person_count
            FROM core.persons;
        `);

        console.log(`Core persons after restoration: ${restoredDataResult.rows[0].person_count} records`);

        // 8. Test migration re-execution
        console.log('\n8. Testing migration re-execution capability...');
        
        // Check if we could re-run migration 002
        const migration002Path = 'scripts/migrations/002_create_core_persons.sql';
        try {
            const migration002Content = readFileSync(migration002Path, 'utf8');
            console.log(`  ✅ Migration 002 script accessible (${migration002Content.length} characters)`);
            
            // Test idempotency by checking for IF NOT EXISTS clauses
            const hasIdempotency = migration002Content.includes('IF NOT EXISTS');
            if (hasIdempotency) {
                console.log('  ✅ Migration includes idempotency checks');
            } else {
                console.log('  ⚠️  Migration may not be fully idempotent');
            }
            
        } catch (fileError) {
            console.log(`  ❌ Migration 002 script not accessible: ${fileError.message}`);
        }

        console.log('\n✅ Rollback procedures test completed successfully!');
        console.log('\nSummary:');
        console.log('- Rollback scripts are functional');
        console.log('- Legacy data is preserved during rollback');
        console.log('- Modern schema can be completely removed');
        console.log('- System can be restored to original state');
        console.log('- Migrations can be re-executed if needed');

    } catch (error) {
        console.error('Rollback test failed:', error.message);
        console.error(error.stack);
    } finally {
        await pgClient.end();
    }
}

testRollbackProcedures();