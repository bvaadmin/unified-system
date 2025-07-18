const { Client } = require('pg');

async function listAllForms() {
  const connectionString = process.env.DATABASE_URL || process.argv[2];
  
  if (!connectionString) {
    console.error('DATABASE_URL environment variable or connection string argument is required');
    process.exit(1);
  }

  const cleanUrl = connectionString.replace('?sslmode=require', '');
  
  const client = new Client({
    connectionString: cleanUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    console.log('BAY VIEW ASSOCIATION - COMPLETE FORMS DIRECTORY');
    console.log('=' .repeat(80));
    console.log(`Generated: ${new Date().toLocaleString()}`);
    console.log('=' .repeat(80));
    
    // Get all forms organized by category
    const forms = await client.query(`
      SELECT 
        fc.name as category_name,
        fc.display_order as cat_order,
        f.name as form_name,
        f.form_code,
        f.description,
        f.requires_approval,
        f.display_order as form_order,
        COUNT(DISTINCT ff.id) as field_count,
        COUNT(DISTINCT fd.id) as dependency_count
      FROM bayview.form_categories fc
      JOIN bayview.forms f ON fc.id = f.category_id
      LEFT JOIN bayview.form_fields ff ON f.id = ff.form_id
      LEFT JOIN bayview.form_dependencies fd ON f.id = fd.form_id
      GROUP BY fc.id, fc.name, fc.display_order, f.id, f.name, f.form_code, f.description, f.requires_approval, f.display_order
      ORDER BY fc.display_order, f.display_order
    `);
    
    let currentCategory = '';
    let categoryFormCount = 0;
    let totalForms = 0;
    
    forms.rows.forEach(form => {
      if (currentCategory !== form.category_name) {
        if (currentCategory !== '') {
          console.log(`\nSubtotal: ${categoryFormCount} forms`);
          console.log('-'.repeat(80));
        }
        currentCategory = form.category_name;
        categoryFormCount = 0;
        console.log(`\n${currentCategory.toUpperCase()}`);
        console.log('='.repeat(currentCategory.length));
      }
      
      categoryFormCount++;
      totalForms++;
      
      console.log(`\n${categoryFormCount}. ${form.form_name}`);
      console.log(`   Code: ${form.form_code}`);
      if (form.description) {
        console.log(`   Description: ${form.description}`);
      }
      console.log(`   Status: ${form.requires_approval ? '✓ Requires Approval' : '◯ Auto-Submit'}`);
      console.log(`   Fields: ${form.field_count || 'Not configured'}`);
      if (form.dependency_count > 0) {
        console.log(`   Dependencies: ${form.dependency_count} required form(s)`);
      }
    });
    
    console.log(`\nSubtotal: ${categoryFormCount} forms`);
    console.log('='.repeat(80));
    console.log(`\nTOTAL FORMS IN SYSTEM: ${totalForms}`);
    console.log('='.repeat(80));
    
    // Summary statistics
    const stats = await client.query(`
      SELECT 
        COUNT(DISTINCT f.id) as total_forms,
        COUNT(DISTINCT ff.id) as total_fields,
        COUNT(DISTINCT CASE WHEN f.requires_approval THEN f.id END) as approval_forms,
        COUNT(DISTINCT fd.id) as total_dependencies
      FROM bayview.forms f
      LEFT JOIN bayview.form_fields ff ON f.id = ff.form_id
      LEFT JOIN bayview.form_dependencies fd ON f.id = fd.form_id
    `);
    
    console.log('\nSYSTEM STATISTICS:');
    console.log(`• Total Forms: ${stats.rows[0].total_forms}`);
    console.log(`• Total Fields Configured: ${stats.rows[0].total_fields}`);
    console.log(`• Forms Requiring Approval: ${stats.rows[0].approval_forms}`);
    console.log(`• Form Dependencies: ${stats.rows[0].total_dependencies}`);
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  listAllForms();
}

module.exports = { listAllForms };