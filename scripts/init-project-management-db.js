#!/usr/bin/env node

/**
 * Initialize Project Management Database
 * Creates the standalone PM system on DigitalOcean
 */

const { Client } = require('pg');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function initProjectManagementDB() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to DigitalOcean database');

    // Check if PM schema already exists
    const schemaCheck = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name = 'project_mgmt'
    `);

    if (schemaCheck.rows.length > 0) {
      console.log('\n⚠️  Project management schema already exists!');
      console.log('To recreate, first run: DROP SCHEMA project_mgmt CASCADE;');
      
      // Show current stats
      const stats = await client.query(`
        SELECT 
          (SELECT COUNT(*) FROM project_mgmt.projects) as projects,
          (SELECT COUNT(*) FROM project_mgmt.tasks) as tasks,
          (SELECT COUNT(*) FROM project_mgmt.resources) as resources
      `);
      
      console.log('\nCurrent database contains:');
      console.log(`- Projects: ${stats.rows[0].projects}`);
      console.log(`- Tasks: ${stats.rows[0].tasks}`);
      console.log(`- Resources: ${stats.rows[0].resources}`);
      
      return;
    }

    // Read and execute migration
    console.log('\nCreating project management system...');
    const migrationPath = path.join(__dirname, 'migrations', '010_create_project_management_system.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');
    
    // Execute the migration
    await client.query(migrationSQL);
    console.log('✅ Project management schema created');

    // Verify creation
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'project_mgmt'
      ORDER BY table_name
    `);

    console.log('\nCreated tables:');
    tables.rows.forEach(row => {
      console.log(`- ${row.table_name}`);
    });

    // Show resource count
    const resources = await client.query('SELECT COUNT(*) as count FROM project_mgmt.resources');
    console.log(`\n✅ Created ${resources.rows[0].count} team resources`);

    console.log('\n🎉 Project management database initialized successfully!');
    console.log('\nNext steps:');
    console.log('1. Run: npm run create-pm-data');
    console.log('2. Access API endpoints:');
    console.log('   - GET /api/pm/get-dashboard');
    console.log('   - GET /api/pm/get-projects');
    console.log('   - GET /api/pm/get-tasks');
    console.log('   - POST /api/pm/create-project');
    console.log('   - PUT /api/pm/update-task');

  } catch (error) {
    console.error('❌ Error initializing PM database:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run if called directly
if (require.main === module) {
  initProjectManagementDB()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { initProjectManagementDB };