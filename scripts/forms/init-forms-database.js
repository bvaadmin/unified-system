const { Client } = require('pg');
const fs = require('fs').promises;
const path = require('path');

async function initializeFormsDatabase() {
  // Database connection string from environment or command line
  const connectionString = process.env.DATABASE_URL || process.argv[2];
  
  if (!connectionString) {
    console.error('DATABASE_URL environment variable or connection string argument is required');
    console.log('Usage: node init-forms-database.js "postgresql://user:pass@host:port/db"');
    process.exit(1);
  }

  // Remove ?sslmode=require from URL if present for proper SSL handling
  const cleanUrl = connectionString.replace('?sslmode=require', '');
  
  const client = new Client({
    connectionString: cleanUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!');

    // Read SQL file
    const sqlFile = path.join(__dirname, '..', 'sql', 'bayview_forms_schema.sql');
    const sql = await fs.readFile(sqlFile, 'utf8');

    // Execute SQL
    console.log('Initializing forms database schema...');
    await client.query(sql);
    
    console.log('Database initialized successfully!');
    
    // Verify the setup
    const categoryResult = await client.query('SELECT COUNT(*) FROM bayview.form_categories');
    console.log(`Form categories created: ${categoryResult.rows[0].count}`);
    
    const typeResult = await client.query('SELECT COUNT(*) FROM bayview.field_types');
    console.log(`Field types created: ${typeResult.rows[0].count}`);
    
    const formResult = await client.query('SELECT COUNT(*) FROM bayview.forms');
    console.log(`Forms created: ${formResult.rows[0].count}`);
    
    // Show example form
    const exampleForm = await client.query(`
      SELECT f.name, f.form_code, COUNT(ff.id) as field_count
      FROM bayview.forms f
      LEFT JOIN bayview.form_fields ff ON f.id = ff.form_id
      WHERE f.form_code = 'YOUTH-RELEASE'
      GROUP BY f.id, f.name, f.form_code
    `);
    
    if (exampleForm.rows.length > 0) {
      console.log(`\nExample form created:`);
      console.log(`- ${exampleForm.rows[0].name} (${exampleForm.rows[0].form_code})`);
      console.log(`- Fields: ${exampleForm.rows[0].field_count}`);
    }

  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run if called directly
if (require.main === module) {
  initializeFormsDatabase();
}

module.exports = { initializeFormsDatabase };