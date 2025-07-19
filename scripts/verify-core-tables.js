import dotenv from 'dotenv';
import { Client } from 'pg';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function verifyCoreTables() {
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
        console.log('Connected to database\n');

        // Check tables in core schema
        const tablesResult = await pgClient.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'core'
            ORDER BY table_name;
        `);

        console.log('Tables in core schema:');
        tablesResult.rows.forEach(row => {
            console.log(`  - ${row.table_name}`);
        });

        // Check views in bridge schema
        const viewsResult = await pgClient.query(`
            SELECT table_name 
            FROM information_schema.views 
            WHERE table_schema = 'bridge'
            ORDER BY table_name;
        `);

        console.log('\nViews in bridge schema:');
        viewsResult.rows.forEach(row => {
            console.log(`  - ${row.table_name}`);
        });

        // Test the bridge view
        const testResult = await pgClient.query(`
            SELECT COUNT(*) as total,
                   COUNT(CASE WHEN person_id IS NOT NULL THEN 1 END) as migrated,
                   COUNT(CASE WHEN person_id IS NULL THEN 1 END) as not_migrated
            FROM bridge.memorial_persons;
        `);

        console.log('\nMemorial persons status:');
        console.log(`  Total memorials: ${testResult.rows[0].total}`);
        console.log(`  Migrated to core.persons: ${testResult.rows[0].migrated}`);
        console.log(`  Not yet migrated: ${testResult.rows[0].not_migrated}`);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pgClient.end();
    }
}

verifyCoreTables();