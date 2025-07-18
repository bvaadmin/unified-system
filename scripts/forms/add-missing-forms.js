const { Client } = require('pg');

async function addMissingForms() {
  const connectionString = process.env.DATABASE_URL || process.argv[2];
  
  if (!connectionString) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }

  const cleanUrl = connectionString.replace('?sslmode=require', '');
  const client = new Client({
    connectionString: cleanUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // Check current count
    const currentCount = await client.query(`
      SELECT 
        fc.name as category,
        COUNT(f.id) as count
      FROM bayview.form_categories fc
      LEFT JOIN bayview.forms f ON fc.id = f.category_id
      GROUP BY fc.id, fc.name, fc.display_order
      ORDER BY fc.display_order
    `);
    
    console.log('Current form distribution:');
    let total = 0;
    currentCount.rows.forEach(row => {
      console.log(`${row.category}: ${row.count}`);
      total += parseInt(row.count);
    });
    console.log(`Total: ${total} (should be 48)`);
    
    // Add the 2 missing forms that weren't in the original categories
    console.log('\nAdding 2 additional forms...');
    
    // Get category IDs
    const facilitiesResult = await client.query(`
      SELECT id FROM bayview.form_categories WHERE name = 'Facilities & Recreation'
    `);
    const facilitiesId = facilitiesResult.rows[0].id;
    
    const membershipResult = await client.query(`
      SELECT id FROM bayview.form_categories WHERE name = 'Membership & Administration'
    `);
    const membershipId = membershipResult.rows[0].id;
    
    // Insert the 2 missing forms
    await client.query(`
      INSERT INTO bayview.forms (category_id, name, form_code, description, requires_approval, display_order) 
      VALUES 
      ($1, 'John M. Hall Auditorium Rental', 'HALL-RENTAL', 'Rental agreement for John M. Hall Auditorium events', true, 7),
      ($2, 'Annual Membership Renewal', 'MEMBER-RENEWAL', 'Annual membership renewal and dues payment form', false, 7)
      ON CONFLICT (form_code) DO NOTHING
    `, [facilitiesId, membershipId]);
    
    // Verify final count
    const finalCount = await client.query(`
      SELECT COUNT(*) as total FROM bayview.forms
    `);
    
    console.log(`\n✅ Final form count: ${finalCount.rows[0].total}`);
    
    // Show updated distribution
    const updatedCount = await client.query(`
      SELECT 
        fc.name as category,
        COUNT(f.id) as count
      FROM bayview.form_categories fc
      LEFT JOIN bayview.forms f ON fc.id = f.category_id
      GROUP BY fc.id, fc.name, fc.display_order
      ORDER BY fc.display_order
    `);
    
    console.log('\nUpdated form distribution:');
    total = 0;
    updatedCount.rows.forEach(row => {
      console.log(`${row.category}: ${row.count}`);
      total += parseInt(row.count);
    });
    console.log(`Total: ${total}`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  addMissingForms();
}

module.exports = { addMissingForms };