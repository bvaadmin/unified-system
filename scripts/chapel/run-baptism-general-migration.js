const { Client } = require('pg');
const fs = require('fs').promises;
const path = require('path');

async function runMigration() {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('ERROR: DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const client = new Client({
    connectionString: DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!');

    // Read SQL file
    const sqlFile = path.join(__dirname, 'add-baptism-general-use.sql');
    const sql = await fs.readFile(sqlFile, 'utf8');

    console.log('Running migration to add baptism and general use support...');
    await client.query(sql);
    
    console.log('Migration completed successfully!');
    
    // Verify the new tables
    const baptismCheck = await client.query(
      "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'crouse_chapel' AND table_name = 'baptism_details'"
    );
    const generalCheck = await client.query(
      "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'crouse_chapel' AND table_name = 'general_use_details'"
    );
    
    console.log(`Baptism details table exists: ${baptismCheck.rows[0].count === '1' ? 'Yes' : 'No'}`);
    console.log(`General use details table exists: ${generalCheck.rows[0].count === '1' ? 'Yes' : 'No'}`);

  } catch (error) {
    console.error('Error running migration:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run if called directly
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };