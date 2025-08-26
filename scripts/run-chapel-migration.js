/**
 * Run Chapel Form Fields Migration
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';
const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function runMigration() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to database\n');

        // Read migration file
        const migrationPath = path.join(__dirname, 'migrations', '010_add_chapel_form_fields.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        console.log('Running Migration 010: Add Chapel Form Fields');
        console.log('='.repeat(50));

        // Execute migration
        await client.query(migrationSQL);

        console.log('\n✅ Migration completed successfully!');

        // Verify new columns exist
        console.log('\n📋 Verifying new columns...\n');

        // Check service_applications columns
        const appColumnsResult = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'crouse_chapel' 
            AND table_name = 'service_applications'
            AND column_name IN ('special_requests', 'contact_relationship', 'form_data')
            ORDER BY column_name
        `);

        console.log('New service_applications columns:');
        appColumnsResult.rows.forEach(row => {
            console.log(`  ✓ ${row.column_name} (${row.data_type})`);
        });

        // Check wedding_details columns
        const weddingColumnsResult = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'crouse_chapel' 
            AND table_name = 'wedding_details'
            AND column_name IN ('audio_fee', 'base_fee')
            ORDER BY column_name
        `);

        console.log('\nNew wedding_details columns:');
        weddingColumnsResult.rows.forEach(row => {
            console.log(`  ✓ ${row.column_name} (${row.data_type})`);
        });

        // Check service_music columns
        const musicColumnsResult = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'crouse_chapel' 
            AND table_name = 'service_music'
            AND column_name IN ('has_music', 'needs_piano', 'needs_organ', 'perform_location')
            ORDER BY column_name
        `);

        console.log('\nNew service_music columns:');
        musicColumnsResult.rows.forEach(row => {
            console.log(`  ✓ ${row.column_name} (${row.data_type})`);
        });

        // Test the new function
        console.log('\n📊 Testing fee calculation function...\n');
        
        const memberFeeResult = await client.query(`
            SELECT crouse_chapel.calculate_wedding_fee(true) as member_fee
        `);
        console.log(`  Member wedding fee: $${memberFeeResult.rows[0].member_fee}`);

        const nonMemberFeeResult = await client.query(`
            SELECT crouse_chapel.calculate_wedding_fee(false) as non_member_fee
        `);
        console.log(`  Non-member wedding fee: $${nonMemberFeeResult.rows[0].non_member_fee}`);

        // Check if migration was tracked
        const migrationCheck = await client.query(`
            SELECT version, description, applied_at 
            FROM migration.migrations 
            WHERE version = '010'
        `);

        if (migrationCheck.rows.length > 0) {
            console.log(`\n✅ Migration tracking confirmed:`);
            console.log(`  Version: ${migrationCheck.rows[0].version}`);
            console.log(`  Applied: ${migrationCheck.rows[0].applied_at}`);
        }

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        if (error.detail) {
            console.error('Details:', error.detail);
        }
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigration();