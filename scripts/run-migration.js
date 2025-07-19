#!/usr/bin/env node

import { Client } from 'pg';
import fs from 'fs/promises';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function runMigration(migrationFile) {
    console.log(`Running migration: ${migrationFile}`);
    
    const connectionString = process.env.DATABASE_URL.replace(/\\n/g, '').trim();
    const client = new Client({
        connectionString: connectionString.replace('?sslmode=require', ''),
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to database');

        // Read migration file
        const migrationSQL = await fs.readFile(migrationFile, 'utf8');
        
        // Execute migration
        const startTime = Date.now();
        await client.query(migrationSQL);
        const executionTime = Date.now() - startTime;
        
        console.log(`✅ Migration completed successfully in ${executionTime}ms`);
        
        // Show migration status
        const result = await client.query(`
            SELECT version, description, applied_at, status
            FROM migration.schema_versions
            ORDER BY version DESC
            LIMIT 5
        `);
        
        console.log('\nRecent migrations:');
        console.table(result.rows);
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

// Get migration file from command line
const migrationFile = process.argv[2];

if (!migrationFile) {
    console.error('Usage: node run-migration.js <migration-file>');
    process.exit(1);
}

runMigration(migrationFile);