const { Client } = require('pg');
const fs = require('fs').promises;
const path = require('path');

async function initializeDatabase() {
  // Database connection string
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!');

    // Read SQL file
    const sqlFile = path.join(__dirname, 'init-database.sql');
    const sql = await fs.readFile(sqlFile, 'utf8');

    // Execute SQL
    console.log('Initializing database schema...');
    await client.query(sql);
    
    console.log('Database initialized successfully!');
    
    // Verify the setup
    const result = await client.query('SELECT COUNT(*) FROM bayview.memorials');
    console.log(`Total memorials in database: ${result.rows[0].count}`);

  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase();
}

module.exports = { initializeDatabase };