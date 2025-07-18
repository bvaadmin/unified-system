const { Client } = require('pg');

async function testDirectConnection() {
  // Get connection string from environment
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('ERROR: DATABASE_URL environment variable is required');
    process.exit(1);
  }
  
  // Test different connection configurations
  const configs = [
    {
      name: 'With SSL Require',
      config: {
        connectionString: connectionString.includes('?sslmode=require') ? connectionString : connectionString + '?sslmode=require',
        ssl: { rejectUnauthorized: false }
      }
    },
    {
      name: 'Without SSL Mode',
      config: {
        connectionString: connectionString.replace('?sslmode=require', ''),
        ssl: { rejectUnauthorized: false }
      }
    },
    {
      name: 'Using env DATABASE_URL',
      config: {
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
      }
    }
  ];

  for (const { name, config } of configs) {
    console.log(`\nTesting ${name}...`);
    const client = new Client(config);
    
    try {
      await client.connect();
      console.log(`✅ ${name} - Connection successful`);
      
      const result = await client.query('SELECT NOW()');
      console.log(`✅ ${name} - Query successful:`, result.rows[0]);
      
      await client.end();
      break; // Stop at first successful connection
      
    } catch (error) {
      console.log(`❌ ${name} - Failed:`, error.message);
      try {
        await client.end();
      } catch (e) {
        // Ignore end errors
      }
    }
  }
}

testDirectConnection();