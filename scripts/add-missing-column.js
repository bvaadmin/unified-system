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

async function addMissingColumn() {
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

    // Add missing column
    console.log('Adding altar_guild_notified column...');
    await client.query(`
      ALTER TABLE crouse_chapel.service_applications 
      ADD COLUMN IF NOT EXISTS altar_guild_notified BOOLEAN DEFAULT FALSE
    `);
    
    console.log('✅ Column added successfully!');

    // Verify
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'crouse_chapel' 
      AND table_name = 'service_applications' 
      AND column_name = 'altar_guild_notified'
    `);

    if (result.rows.length > 0) {
      console.log('✅ Verified: altar_guild_notified column exists');
    } else {
      console.log('❌ Warning: Column was not created');
    }

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
  addMissingColumn();
}

module.exports = { addMissingColumn };