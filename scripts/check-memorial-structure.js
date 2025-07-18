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

async function checkMemorialStructure() {
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
    console.log('Connected successfully\n');

    // Check if memorials table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'bayview' AND table_name = 'memorials'
      ) as exists
    `);

    if (!tableExists.rows[0].exists) {
      console.log('bayview.memorials table does not exist!');
      return;
    }

    // Get column information
    const columns = await client.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'bayview' AND table_name = 'memorials'
      ORDER BY ordinal_position
    `);

    console.log('Columns in bayview.memorials table:');
    console.log('=====================================');
    columns.rows.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const maxLen = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
      const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
      console.log(`${col.column_name}: ${col.data_type}${maxLen} ${nullable}${defaultVal}`);
    });

    // Check specifically for submission_id
    const hasSubmissionId = columns.rows.some(col => col.column_name === 'submission_id');
    console.log(`\nHas submission_id column: ${hasSubmissionId}`);

  } catch (error) {
    console.error('ERROR:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run if called directly
if (require.main === module) {
  checkMemorialStructure();
}

module.exports = { checkMemorialStructure };