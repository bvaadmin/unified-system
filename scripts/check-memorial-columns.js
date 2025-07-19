import dotenv from 'dotenv';
import { Client } from 'pg';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function checkMemorialColumns() {
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
        console.log('Connected to database');

        // Get column information for memorials table
        const result = await pgClient.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'bayview' AND table_name = 'memorials'
            ORDER BY ordinal_position;
        `);

        console.log('\nColumns in bayview.memorials:');
        result.rows.forEach(row => {
            console.log(`  ${row.column_name}: ${row.data_type}`);
        });

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pgClient.end();
    }
}

checkMemorialColumns();