const { Client } = require('pg');
const path = require('path');

// Try to load .env.local file if it exists
try {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (require('fs').existsSync(envPath)) {
    const envContent = require('fs').readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          let value = valueParts.join('=').trim();
          // Remove quotes and escape sequences
          value = value.replace(/^["'](.*)["']$/, '$1');
          value = value.replace(/\\n/g, '');
          if (!process.env[key.trim()]) {
            process.env[key.trim()] = value;
          }
        }
      }
    });
    console.log('Loaded environment variables from .env.local');
  }
} catch (error) {
  // Ignore if file doesn't exist
}

async function initMemorialTable() {
  const DATABASE_URL = process.env.DATABASE_URL_CLEAN || process.env.DATABASE_URL;
  
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
    console.log('Connected successfully');

    // Create bayview schema if it doesn't exist
    await client.query('CREATE SCHEMA IF NOT EXISTS bayview');
    console.log('Schema bayview created/verified');

    // Create memorials table
    await client.query(`
      CREATE TABLE IF NOT EXISTS bayview.memorials (
        id SERIAL PRIMARY KEY,
        submission_id VARCHAR(50) UNIQUE,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        middle_name VARCHAR(100),
        maiden_name VARCHAR(100),
        birth_date DATE,
        death_date DATE,
        birth_place VARCHAR(255),
        home_address TEXT,
        bayview_address TEXT,
        mother_name VARCHAR(200),
        father_name VARCHAR(200),
        message TEXT,
        bayview_history TEXT,
        application_type VARCHAR(100),
        is_member BOOLEAN DEFAULT false,
        member_name VARCHAR(200),
        member_relationship VARCHAR(200),
        contact_name VARCHAR(200),
        contact_email VARCHAR(200),
        contact_phone VARCHAR(50),
        contact_address TEXT,
        service_date DATE,
        celebrant_requested VARCHAR(100),
        fee_amount DECIMAL(10, 2),
        payment_status VARCHAR(50) DEFAULT 'pending',
        notion_id VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Memorials table created/verified');

    // Create indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_memorials_last_name ON bayview.memorials(last_name)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_memorials_first_name ON bayview.memorials(first_name)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_memorials_submission_id ON bayview.memorials(submission_id)');
    console.log('Indexes created');

    // Create update trigger function if it doesn't exist
    await client.query(`
      CREATE OR REPLACE FUNCTION bayview.update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_memorials_updated_at ON bayview.memorials
    `);

    await client.query(`
      CREATE TRIGGER update_memorials_updated_at 
      BEFORE UPDATE ON bayview.memorials 
      FOR EACH ROW 
      EXECUTE PROCEDURE bayview.update_updated_at_column()
    `);
    console.log('Triggers created');

    // Verify
    const result = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'bayview' 
      AND table_name = 'memorials'
    `);

    console.log('Memorial table initialized successfully!');
    console.log('Table exists:', result.rows[0].count > 0);

  } catch (error) {
    console.error('ERROR:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('Database connection closed');
  }
}

// Run if called directly
if (require.main === module) {
  initMemorialTable();
}

module.exports = { initMemorialTable };