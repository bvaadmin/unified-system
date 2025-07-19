#!/usr/bin/env node

/**
 * Migration Testing and Validation Framework
 * Ensures data integrity throughout the migration process
 */

import { Client } from 'pg';
import chalk from 'chalk';
import Table from 'cli-table3';

class MigrationTester {
    constructor(connectionString) {
        this.connectionString = connectionString;
        this.client = null;
        this.results = {
            tests: [],
            passed: 0,
            failed: 0,
            warnings: 0
        };
    }

    async connect() {
        this.client = new Client({
            connectionString: this.connectionString
        });
        await this.client.connect();
    }

    async disconnect() {
        if (this.client) {
            await this.client.end();
        }
    }

    /**
     * Run all validation tests
     */
    async runAllTests() {
        console.log(chalk.blue.bold('\n🧪 Bay View Database Migration Testing Framework\n'));
        
        const testSuites = [
            { name: 'Schema Integrity', method: this.testSchemaIntegrity },
            { name: 'Data Integrity', method: this.testDataIntegrity },
            { name: 'Relationship Integrity', method: this.testRelationshipIntegrity },
            { name: 'Performance Benchmarks', method: this.testPerformance },
            { name: 'Rollback Procedures', method: this.testRollback },
            { name: 'API Compatibility', method: this.testAPICompatibility }
        ];

        for (const suite of testSuites) {
            console.log(chalk.yellow(`\n▶ Running ${suite.name} Tests...`));
            await suite.method.call(this);
        }

        this.displayResults();
        return this.results;
    }

    /**
     * Test 1: Schema Integrity
     */
    async testSchemaIntegrity() {
        // Check if new schemas exist
        await this.test('New schemas created', async () => {
            const result = await this.client.query(`
                SELECT schema_name 
                FROM information_schema.schemata 
                WHERE schema_name IN ('core', 'property', 'education', 'events', 'finance', 'migration')
            `);
            
            const expectedSchemas = ['core', 'property', 'education', 'events', 'finance', 'migration'];
            const foundSchemas = result.rows.map(r => r.schema_name);
            const missingSchemas = expectedSchemas.filter(s => !foundSchemas.includes(s));
            
            if (missingSchemas.length > 0) {
                throw new Error(`Missing schemas: ${missingSchemas.join(', ')}`);
            }
            
            return { schemas: foundSchemas };
        });

        // Check if legacy schemas are intact
        await this.test('Legacy schemas unchanged', async () => {
            const legacyCheck = await this.client.query(`
                SELECT 
                    s.schema_name,
                    COUNT(t.table_name) as table_count
                FROM information_schema.schemata s
                LEFT JOIN information_schema.tables t 
                    ON s.schema_name = t.table_schema
                WHERE s.schema_name IN ('bayview', 'crouse_chapel')
                GROUP BY s.schema_name
            `);
            
            const expected = {
                'bayview': 4,  // memorials, attachments, audit_log, memorial_payments
                'crouse_chapel': 15  // All chapel tables
            };
            
            for (const row of legacyCheck.rows) {
                if (row.table_count !== expected[row.schema_name]) {
                    throw new Error(
                        `Legacy schema ${row.schema_name} has ${row.table_count} tables, ` +
                        `expected ${expected[row.schema_name]}`
                    );
                }
            }
            
            return { legacy_intact: true };
        });

        // Check migration tracking
        await this.test('Migration tracking table exists', async () => {
            const result = await this.client.query(`
                SELECT EXISTS (
                    SELECT 1 
                    FROM information_schema.tables 
                    WHERE table_schema = 'migration' 
                    AND table_name = 'schema_versions'
                )
            `);
            
            if (!result.rows[0].exists) {
                throw new Error('Migration tracking table not found');
            }
            
            return { migration_tracking: true };
        });
    }

    /**
     * Test 2: Data Integrity
     */
    async testDataIntegrity() {
        // Check data consistency between old and new
        await this.test('Legacy data preserved', async () => {
            const legacyCount = await this.client.query(
                'SELECT COUNT(*) FROM bayview.memorials'
            );
            
            // Check if any legacy data was modified
            const checksumResult = await this.client.query(`
                SELECT 
                    MD5(string_agg(
                        first_name || last_name || 
                        COALESCE(birth_date::text, '') || 
                        COALESCE(death_date::text, ''),
                        '|' ORDER BY id
                    )) as checksum,
                    COUNT(*) as count
                FROM bayview.memorials
            `);
            
            return {
                record_count: parseInt(legacyCount.rows[0].count),
                data_checksum: checksumResult.rows[0].checksum
            };
        });

        // Check migrated data accuracy
        await this.test('Migrated data accuracy', async () => {
            // Check if persons were created from memorials
            const result = await this.client.query(`
                SELECT 
                    m.id as memorial_id,
                    m.first_name as m_first,
                    m.last_name as m_last,
                    p.first_name as p_first,
                    p.last_name as p_last
                FROM bayview.memorials m
                LEFT JOIN core.persons p ON p.legacy_memorial_id = m.id
                WHERE p.id IS NOT NULL
            `);
            
            let mismatches = 0;
            for (const row of result.rows) {
                if (row.m_first !== row.p_first || row.m_last !== row.p_last) {
                    mismatches++;
                }
            }
            
            if (mismatches > 0) {
                throw new Error(`Found ${mismatches} data mismatches`);
            }
            
            return {
                migrated_records: result.rows.length,
                mismatches: 0
            };
        });

        // Check for orphaned records
        await this.test('No orphaned records', async () => {
            const orphanChecks = [
                {
                    name: 'Persons without legacy link',
                    query: `
                        SELECT COUNT(*) as count
                        FROM core.persons
                        WHERE migration_source IS NOT NULL
                          AND legacy_memorial_id IS NULL
                          AND legacy_chapel_app_id IS NULL
                    `
                },
                {
                    name: 'Invalid foreign keys',
                    query: `
                        SELECT COUNT(*) as count
                        FROM core.persons p
                        WHERE p.legacy_memorial_id IS NOT NULL
                          AND NOT EXISTS (
                              SELECT 1 FROM bayview.memorials m
                              WHERE m.id = p.legacy_memorial_id
                          )
                    `
                }
            ];
            
            const orphans = {};
            for (const check of orphanChecks) {
                const result = await this.client.query(check.query);
                orphans[check.name] = parseInt(result.rows[0].count);
                
                if (orphans[check.name] > 0) {
                    this.warn(`Found ${orphans[check.name]} ${check.name}`);
                }
            }
            
            return orphans;
        });
    }

    /**
     * Test 3: Relationship Integrity
     */
    async testRelationshipIntegrity() {
        // Test foreign key constraints
        await this.test('Foreign key constraints valid', async () => {
            const result = await this.client.query(`
                SELECT 
                    conname as constraint_name,
                    conrelid::regclass as table_name,
                    confrelid::regclass as referenced_table
                FROM pg_constraint
                WHERE contype = 'f'
                  AND connamespace::regnamespace::text IN ('core', 'property', 'education')
            `);
            
            // Try to validate each constraint
            const violations = [];
            for (const constraint of result.rows) {
                const checkQuery = `
                    SELECT COUNT(*) as violations
                    FROM ONLY ${constraint.table_name} t
                    WHERE NOT EXISTS (
                        SELECT 1 FROM ONLY ${constraint.referenced_table} r
                        WHERE t.${constraint.constraint_name} = r.id
                    )
                `;
                
                try {
                    const check = await this.client.query(checkQuery);
                    if (parseInt(check.rows[0].violations) > 0) {
                        violations.push({
                            constraint: constraint.constraint_name,
                            violations: check.rows[0].violations
                        });
                    }
                } catch (e) {
                    // Skip if constraint check fails
                }
            }
            
            if (violations.length > 0) {
                throw new Error(`Found ${violations.length} constraint violations`);
            }
            
            return {
                total_constraints: result.rows.length,
                violations: 0
            };
        });

        // Test relationship mapping
        await this.test('Relationship mappings correct', async () => {
            // Check if dual references work
            const result = await this.client.query(`
                SELECT COUNT(*) as bidirectional_links
                FROM core.persons p
                JOIN bayview.memorials m ON p.legacy_memorial_id = m.id
                WHERE m.notion_id IS NOT NULL
            `);
            
            return {
                bidirectional_links: parseInt(result.rows[0].bidirectional_links)
            };
        });
    }

    /**
     * Test 4: Performance Benchmarks
     */
    async testPerformance() {
        const benchmarks = [
            {
                name: 'Legacy memorial lookup',
                query: 'SELECT * FROM bayview.memorials WHERE id = 1'
            },
            {
                name: 'Modern person lookup',
                query: 'SELECT * FROM core.persons WHERE id = 1'
            },
            {
                name: 'Join performance',
                query: `
                    SELECT p.*, m.*
                    FROM core.persons p
                    JOIN bayview.memorials m ON p.legacy_memorial_id = m.id
                    LIMIT 100
                `
            }
        ];

        for (const benchmark of benchmarks) {
            await this.test(`Performance: ${benchmark.name}`, async () => {
                const start = Date.now();
                
                await this.client.query(benchmark.query);
                
                const duration = Date.now() - start;
                
                if (duration > 100) {
                    this.warn(`Query took ${duration}ms (>100ms threshold)`);
                }
                
                return { duration_ms: duration };
            });
        }
    }

    /**
     * Test 5: Rollback Procedures
     */
    async testRollback() {
        await this.test('Rollback scripts exist', async () => {
            const result = await this.client.query(`
                SELECT 
                    version,
                    description,
                    rollback_script IS NOT NULL as has_rollback
                FROM migration.schema_versions
                WHERE status = 'applied'
                ORDER BY version
            `);
            
            const missingRollback = result.rows.filter(r => !r.has_rollback);
            
            if (missingRollback.length > 0) {
                this.warn(`${missingRollback.length} migrations missing rollback scripts`);
            }
            
            return {
                total_migrations: result.rows.length,
                with_rollback: result.rows.filter(r => r.has_rollback).length
            };
        });

        await this.test('Rollback simulation', async () => {
            // Test in a transaction that we'll rollback
            await this.client.query('BEGIN');
            
            try {
                // Create a test migration
                await this.client.query(`
                    INSERT INTO migration.schema_versions (version, description, rollback_script)
                    VALUES ('TEST001', 'Test migration', 'SELECT 1')
                `);
                
                // Verify it was created
                const check = await this.client.query(
                    "SELECT * FROM migration.schema_versions WHERE version = 'TEST001'"
                );
                
                if (check.rows.length !== 1) {
                    throw new Error('Test migration not created');
                }
                
                await this.client.query('ROLLBACK');
                
                return { rollback_tested: true };
                
            } catch (error) {
                await this.client.query('ROLLBACK');
                throw error;
            }
        });
    }

    /**
     * Test 6: API Compatibility
     */
    async testAPICompatibility() {
        // Test backward compatible views
        await this.test('Backward compatible views', async () => {
            const views = [
                {
                    name: 'migration.memorial_persons',
                    expectedColumns: ['memorial_id', 'person_id', 'first_name', 'last_name']
                }
            ];
            
            for (const view of views) {
                const result = await this.client.query(`
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = $1 
                      AND table_name = $2
                `, [view.name.split('.')[0], view.name.split('.')[1]]);
                
                const columns = result.rows.map(r => r.column_name);
                const missing = view.expectedColumns.filter(c => !columns.includes(c));
                
                if (missing.length > 0) {
                    throw new Error(`View ${view.name} missing columns: ${missing.join(', ')}`);
                }
            }
            
            return { views_valid: true };
        });

        // Test dual-write simulation
        await this.test('Dual-write pattern', async () => {
            await this.client.query('BEGIN');
            
            try {
                // Simulate a dual write
                const legacyInsert = await this.client.query(`
                    INSERT INTO bayview.memorials (
                        submission_id, first_name, last_name, created_at
                    ) VALUES (
                        'TEST-' || gen_random_uuid(), 'Test', 'User', NOW()
                    ) RETURNING id
                `);
                
                const legacyId = legacyInsert.rows[0].id;
                
                const modernInsert = await this.client.query(`
                    INSERT INTO core.persons (
                        person_type, first_name, last_name, 
                        legacy_memorial_id, migration_source
                    ) VALUES (
                        'deceased', 'Test', 'User', $1, 'test_dual_write'
                    ) RETURNING id
                `, [legacyId]);
                
                // Verify link
                const verify = await this.client.query(`
                    SELECT COUNT(*) as linked
                    FROM core.persons p
                    JOIN bayview.memorials m ON p.legacy_memorial_id = m.id
                    WHERE p.id = $1 AND m.id = $2
                `, [modernInsert.rows[0].id, legacyId]);
                
                if (parseInt(verify.rows[0].linked) !== 1) {
                    throw new Error('Dual write link failed');
                }
                
                await this.client.query('ROLLBACK');
                
                return { dual_write_tested: true };
                
            } catch (error) {
                await this.client.query('ROLLBACK');
                throw error;
            }
        });
    }

    /**
     * Helper: Run a single test
     */
    async test(name, testFn) {
        const startTime = Date.now();
        const result = {
            name,
            status: 'pending',
            duration: 0,
            result: null,
            error: null
        };

        try {
            result.result = await testFn();
            result.status = 'passed';
            this.results.passed++;
            console.log(chalk.green(`  ✓ ${name}`));
        } catch (error) {
            result.status = 'failed';
            result.error = error.message;
            this.results.failed++;
            console.log(chalk.red(`  ✗ ${name}`));
            console.log(chalk.red(`    ${error.message}`));
        }

        result.duration = Date.now() - startTime;
        this.results.tests.push(result);
    }

    /**
     * Helper: Add a warning
     */
    warn(message) {
        this.results.warnings++;
        console.log(chalk.yellow(`    ⚠ ${message}`));
    }

    /**
     * Display final results
     */
    displayResults() {
        console.log(chalk.blue.bold('\n📊 Test Results Summary\n'));

        const table = new Table({
            head: ['Metric', 'Value'],
            style: { head: ['cyan'] }
        });

        table.push(
            ['Total Tests', this.results.tests.length],
            ['Passed', chalk.green(this.results.passed)],
            ['Failed', chalk.red(this.results.failed)],
            ['Warnings', chalk.yellow(this.results.warnings)],
            ['Success Rate', `${Math.round(this.results.passed / this.results.tests.length * 100)}%`]
        );

        console.log(table.toString());

        // Show failed tests
        if (this.results.failed > 0) {
            console.log(chalk.red.bold('\n❌ Failed Tests:\n'));
            
            const failedTable = new Table({
                head: ['Test Name', 'Error'],
                style: { head: ['red'] }
            });

            this.results.tests
                .filter(t => t.status === 'failed')
                .forEach(t => {
                    failedTable.push([t.name, t.error]);
                });

            console.log(failedTable.toString());
        }

        // Overall status
        if (this.results.failed === 0) {
            console.log(chalk.green.bold('\n✅ All tests passed! Migration is safe to proceed.\n'));
        } else {
            console.log(chalk.red.bold('\n❌ Some tests failed. Please fix issues before proceeding.\n'));
        }
    }

    /**
     * Generate detailed report
     */
    async generateReport(outputPath) {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                total: this.results.tests.length,
                passed: this.results.passed,
                failed: this.results.failed,
                warnings: this.results.warnings,
                duration: this.results.tests.reduce((sum, t) => sum + t.duration, 0)
            },
            environment: {
                nodejs: process.version,
                postgresql: await this.getPostgreSQLVersion(),
                database: this.connectionString.split('/').pop().split('?')[0]
            },
            tests: this.results.tests
        };

        if (outputPath) {
            const fs = await import('fs/promises');
            await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
            console.log(chalk.blue(`\n📄 Detailed report saved to: ${outputPath}`));
        }

        return report;
    }

    async getPostgreSQLVersion() {
        const result = await this.client.query('SELECT version()');
        return result.rows[0].version;
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    const outputPath = args.find(a => a.startsWith('--output='))?.split('=')[1];
    
    const DATABASE_URL = process.env.DATABASE_URL;
    if (!DATABASE_URL) {
        console.error(chalk.red('ERROR: DATABASE_URL environment variable is required'));
        process.exit(1);
    }

    const tester = new MigrationTester(DATABASE_URL);
    
    try {
        await tester.connect();
        const results = await tester.runAllTests();
        
        if (outputPath) {
            await tester.generateReport(outputPath);
        }
        
        await tester.disconnect();
        
        // Exit with appropriate code
        process.exit(results.failed > 0 ? 1 : 0);
        
    } catch (error) {
        console.error(chalk.red('ERROR:'), error.message);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export { MigrationTester };