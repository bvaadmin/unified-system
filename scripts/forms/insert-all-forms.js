const { Client } = require('pg');
const fs = require('fs').promises;
const path = require('path');

async function insertAllForms() {
  // Database connection string from environment or command line
  const connectionString = process.env.DATABASE_URL || process.argv[2];
  
  if (!connectionString) {
    console.error('DATABASE_URL environment variable or connection string argument is required');
    console.log('Usage: node insert-all-forms.js "postgresql://user:pass@host:port/db"');
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
    const sqlFile = path.join(__dirname, '..', 'sql', 'insert_all_forms.sql');
    const sql = await fs.readFile(sqlFile, 'utf8');

    // Execute SQL
    console.log('Inserting all 47 remaining forms...');
    await client.query(sql);
    
    console.log('All forms inserted successfully!');
    
    // Show summary by category
    const summary = await client.query(`
      SELECT 
        fc.name as category,
        fc.display_order,
        COUNT(f.id) as form_count
      FROM bayview.form_categories fc
      LEFT JOIN bayview.forms f ON fc.id = f.category_id
      GROUP BY fc.id, fc.name, fc.display_order
      ORDER BY fc.display_order
    `);
    
    console.log('\n📊 Forms by Category:');
    console.log('─'.repeat(50));
    let totalForms = 0;
    summary.rows.forEach(row => {
      console.log(`${row.category}: ${row.form_count} forms`);
      totalForms += parseInt(row.form_count);
    });
    console.log('─'.repeat(50));
    console.log(`Total Forms: ${totalForms}`);
    
    // Show forms with fields
    const formsWithFields = await client.query(`
      SELECT 
        f.name,
        f.form_code,
        COUNT(ff.id) as field_count
      FROM bayview.forms f
      LEFT JOIN bayview.form_fields ff ON f.id = ff.form_id
      GROUP BY f.id, f.name, f.form_code
      HAVING COUNT(ff.id) > 0
      ORDER BY COUNT(ff.id) DESC
      LIMIT 10
    `);
    
    if (formsWithFields.rows.length > 0) {
      console.log('\n📝 Forms with Fields:');
      console.log('─'.repeat(50));
      formsWithFields.rows.forEach(row => {
        console.log(`${row.name} (${row.form_code}): ${row.field_count} fields`);
      });
    }
    
    // Show form dependencies
    const dependencies = await client.query(`
      SELECT 
        f1.name as form_name,
        f2.name as depends_on,
        fd.dependency_type
      FROM bayview.form_dependencies fd
      JOIN bayview.forms f1 ON fd.form_id = f1.id
      JOIN bayview.forms f2 ON fd.depends_on_form_id = f2.id
    `);
    
    if (dependencies.rows.length > 0) {
      console.log('\n🔗 Form Dependencies:');
      console.log('─'.repeat(50));
      dependencies.rows.forEach(row => {
        console.log(`${row.form_name} → requires → ${row.depends_on}`);
      });
    }

  } catch (error) {
    console.error('Error inserting forms:', error.message);
    if (error.detail) {
      console.error('Detail:', error.detail);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run if called directly
if (require.main === module) {
  insertAllForms();
}

module.exports = { insertAllForms };