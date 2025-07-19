import dotenv from 'dotenv';
import { Client } from 'pg';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function checkChapelStructure() {
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

        // Check if crouse_chapel schema exists
        const schemaResult = await pgClient.query(`
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name = 'crouse_chapel';
        `);

        if (schemaResult.rows.length === 0) {
            console.log('❌ crouse_chapel schema does not exist');
            return;
        }

        console.log('✅ crouse_chapel schema exists\n');

        // Get all tables in crouse_chapel schema
        const tablesResult = await pgClient.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'crouse_chapel'
            ORDER BY table_name;
        `);

        console.log('Tables in crouse_chapel schema:');
        for (const row of tablesResult.rows) {
            console.log(`  - ${row.table_name}`);
            
            // Get column info for each table
            const columnsResult = await pgClient.query(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns 
                WHERE table_schema = 'crouse_chapel' AND table_name = $1
                ORDER BY ordinal_position;
            `, [row.table_name]);

            if (columnsResult.rows.length > 0) {
                console.log(`    Columns:`);
                columnsResult.rows.forEach(col => {
                    console.log(`      ${col.column_name}: ${col.data_type}${col.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
                });
            }
            console.log();
        }

        // Check for any existing data
        const dataResult = await pgClient.query(`
            SELECT 
                'service_applications' as table_name,
                COUNT(*) as record_count
            FROM crouse_chapel.service_applications
            WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'crouse_chapel' AND table_name = 'service_applications')
        `);

        if (dataResult.rows.length > 0) {
            console.log('Data summary:');
            dataResult.rows.forEach(row => {
                console.log(`  ${row.table_name}: ${row.record_count} records`);
            });
        }

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pgClient.end();
    }
}

checkChapelStructure();