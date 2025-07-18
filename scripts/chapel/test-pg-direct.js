const { Client } = require('pg');

async function testDirectConnection() {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('DATABASE_URL environment variable is required');
    console.log('Set it with: export DATABASE_URL="postgresql://user:password@host:port/database"');
    process.exit(1);
  }

  // Test different connection configurations
  const configs = [
    {
      name: 'With SSL Require',
      config: {
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      }
    },
    {
      name: 'Without SSL Mode',
      config: {
        connectionString: DATABASE_URL.replace('?sslmode=require', ''),
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