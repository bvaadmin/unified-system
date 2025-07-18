const { Client } = require('pg');

async function checkCurrentSchema() {
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
    await client.connect();
    console.log('Connected successfully!');

    // Check service_equipment table structure
    const columnsResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'crouse_chapel' 
      AND table_name = 'service_equipment'
      ORDER BY ordinal_position
    `);
    
    console.log('\nservice_equipment table columns:');
    columnsResult.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    });

    // Check what tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'crouse_chapel'
      ORDER BY table_name
    `);
    
    console.log('\nTables in crouse_chapel schema:');
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

  } catch (error) {
    console.error(`Error: ${error.message}`);
  } finally {
    await client.end();
  }
}

// Run if called directly
if (require.main === module) {
  checkCurrentSchema();
}

module.exports = { checkCurrentSchema };