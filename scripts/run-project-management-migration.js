#!/usr/bin/env node

import { withDatabase } from '../lib/db.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  try {
    // Read the migration file
    const migrationPath = join(__dirname, 'migrations', '010_create_project_management_system.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    console.log('Running project management migration...');
    
    await withDatabase(async (client) => {
      // Run the migration
      await client.query(migrationSQL);
      
      console.log('✅ Project management system created successfully!');
      
      // Verify the schema was created
      const schemaCheck = await client.query(`
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name = 'project_mgmt';
      `);
      
      if (schemaCheck.rows.length > 0) {
        console.log('✅ Schema project_mgmt verified');
        
        // Get table count
        const tableCount = await client.query(`
          SELECT COUNT(*) as count
          FROM information_schema.tables 
          WHERE table_schema = 'project_mgmt';
        `);
        
        console.log(`✅ Created ${tableCount.rows[0].count} tables in project_mgmt schema`);
      }
    });

  } catch (error) {
    console.error('❌ Error running migration:', error.message);
    process.exit(1);
  }
}

runMigration();