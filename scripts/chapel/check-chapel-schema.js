const { Client } = require('pg');

async function checkChapelSchema() {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('ERROR: DATABASE_URL environment variable is required');
    process.exit(1);
  }

  console.log(`\n=== Checking Chapel Schema ===`);
  
  const client = new Client({
    connectionString: DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✓ Connected successfully');

    // Check for schemas
    const schemaResult = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name IN ('bayview', 'crouse_chapel', 'bayview_forms')
      ORDER BY schema_name
    `);
    
    console.log('\nSchemas found:');
    schemaResult.rows.forEach(row => {
      console.log(`  - ${row.schema_name}`);
    });

    // Check for crouse_chapel tables
    const chapelTablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'crouse_chapel'
      ORDER BY table_name
    `);
    
    if (chapelTablesResult.rows.length > 0) {
      console.log('\nTables in crouse_chapel schema:');
      chapelTablesResult.rows.forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
    } else {
      console.log('\n⚠️  No tables found in crouse_chapel schema');
    }

    // Check for bayview tables
    const bayviewTablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'bayview'
      ORDER BY table_name
    `);
    
    if (bayviewTablesResult.rows.length > 0) {
      console.log('\nTables in bayview schema:');
      bayviewTablesResult.rows.forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
    }

    // Check if crouse_chapel.service_applications exists
    const serviceAppResult = await client.query(`
      SELECT COUNT(*) as exists
      FROM information_schema.tables 
      WHERE table_schema = 'crouse_chapel' 
      AND table_name = 'service_applications'
    `);
    
    if (serviceAppResult.rows[0].exists === '0') {
      console.log('\n❌ crouse_chapel.service_applications table NOT found');
    } else {
      console.log('\n✓ crouse_chapel.service_applications table exists');
      
      // Get column info
      const columnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'crouse_chapel' 
        AND table_name = 'service_applications'
        ORDER BY ordinal_position
        LIMIT 10
      `);
      
      console.log('\nFirst 10 columns:');
      columnsResult.rows.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
      });
    }

    // Check for new tables added by migration
    const newTablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'crouse_chapel'
      AND table_name IN ('baptism_details', 'general_use_details')
      ORDER BY table_name
    `);
    
    if (newTablesResult.rows.length > 0) {
      console.log('\nNew tables from baptism/general use migration:');
      newTablesResult.rows.forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
    } else {
      console.log('\n⚠️  baptism_details and general_use_details tables not found');
      console.log('Run: npm run migrate-chapel-baptism');
    }

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  } finally {
    await client.end();
  }
}

// Run the check
if (require.main === module) {
  checkChapelSchema().catch(console.error);
}

module.exports = { checkChapelSchema };