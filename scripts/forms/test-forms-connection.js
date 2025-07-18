const { Client } = require('pg');

async function testFormsConnection() {
  const DATABASE_URL = process.env.DATABASE_URL || process.argv[2];
  
  if (!DATABASE_URL) {
    console.error('DATABASE_URL environment variable or connection string argument is required');
    console.log('Usage: node test-forms-connection.js "postgresql://user:pass@host:port/db"');
    process.exit(1);
  }

  console.log('Testing connection to Bay View Forms Database...\n');

  // Remove ?sslmode=require from URL if present for proper SSL handling
  const cleanUrl = DATABASE_URL.replace('?sslmode=require', '');
  
  const client = new Client({
    connectionString: cleanUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Connection successful');
    
    // Test basic query
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    console.log(`✅ Database is online at: ${result.rows[0].current_time}`);
    console.log(`✅ PostgreSQL version: ${result.rows[0].pg_version.split(',')[0]}`);
    
    // Check if schema exists
    const schemaCheck = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name = 'bayview'
    `);
    
    if (schemaCheck.rows.length > 0) {
      console.log('✅ Bayview schema exists');
      
      // Check tables
      const tableCheck = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'bayview' 
        ORDER BY table_name
      `);
      
      if (tableCheck.rows.length > 0) {
        console.log(`\n📊 Tables in bayview schema:`);
        tableCheck.rows.forEach(row => {
          console.log(`   - ${row.table_name}`);
        });
      } else {
        console.log('\n⚠️  No tables found in bayview schema. Run init-forms-database.js to create them.');
      }
    } else {
      console.log('\n⚠️  Bayview schema does not exist. Run init-forms-database.js to create it.');
    }
    
    await client.end();
    console.log('\n✅ Connection test completed successfully');
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    if (error.message.includes('creating')) {
      console.log('\n⚠️  Database is still being created. Please wait a few minutes and try again.');
    }
    try {
      await client.end();
    } catch (e) {
      // Ignore end errors
    }
    process.exit(1);
  }
}

testFormsConnection();