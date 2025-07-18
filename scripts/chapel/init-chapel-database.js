const { Client } = require('pg');
const fs = require('fs').promises;
const path = require('path');

async function initializeChapelDatabase() {
  // Get database URL from environment
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const client = new Client({
    connectionString: DATABASE_URL.replace('?sslmode=require', ''),
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!');

    // Read SQL file
    const sqlFile = path.join(__dirname, 'init-chapel-schema.sql');
    const sql = await fs.readFile(sqlFile, 'utf8');

    // Execute SQL
    console.log('Creating crouse_chapel schema and tables...');
    await client.query(sql);
    
    console.log('Chapel database schema initialized successfully!');
    
    // Verify the setup
    const schemaResult = await client.query(`
      SELECT COUNT(*) as table_count 
      FROM information_schema.tables 
      WHERE table_schema = 'crouse_chapel'
    `);
    console.log(`\nCreated ${schemaResult.rows[0].table_count} tables in crouse_chapel schema`);

    // List created tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'crouse_chapel'
      ORDER BY table_name
    `);
    
    console.log('\nTables created:');
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

    // Check if function was created
    const functionResult = await client.query(`
      SELECT COUNT(*) as count
      FROM information_schema.routines
      WHERE routine_schema = 'crouse_chapel'
      AND routine_name = 'is_chapel_available'
    `);
    
    if (functionResult.rows[0].count > 0) {
      console.log('\n✓ is_chapel_available() function created successfully');
    }

  } catch (error) {
    console.error('Error initializing chapel database:', error);
    if (error.message) {
      console.error('Error details:', error.message);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run if called directly
if (require.main === module) {
  initializeChapelDatabase();
}

module.exports = { initializeChapelDatabase };