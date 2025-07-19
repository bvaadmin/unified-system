import dotenv from 'dotenv';
import { Client } from 'pg';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function checkChapelConstraints() {
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

        // Try to get the actual constraint definition using a different method
        const checkResult = await pgClient.query(`
            SELECT 
                tc.constraint_name,
                cc.check_clause
            FROM information_schema.table_constraints tc
            JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
            WHERE tc.table_schema = 'crouse_chapel' 
              AND tc.table_name = 'service_applications'
              AND tc.constraint_type = 'CHECK';
        `);

        console.log('Check constraints on service_applications:');
        checkResult.rows.forEach(row => {
            console.log(`  ${row.constraint_name}: ${row.check_clause}`);
        });

        // Also check existing successful applications to see what values work
        const existingResult = await pgClient.query(`
            SELECT DISTINCT application_type 
            FROM crouse_chapel.service_applications 
            ORDER BY application_type;
        `);

        console.log('\nExisting application types in database:');
        existingResult.rows.forEach(row => {
            console.log(`  - ${row.application_type}`);
        });

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pgClient.end();
    }
}

checkChapelConstraints();