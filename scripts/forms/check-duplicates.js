const { Client } = require('pg');

async function checkDuplicates() {
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
    
    // Check for duplicate form codes
    const duplicates = await client.query(`
      SELECT 
        form_code,
        COUNT(*) as count,
        array_agg(name) as form_names
      FROM bayview.forms
      GROUP BY form_code
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
    `);
    
    if (duplicates.rows.length > 0) {
      console.log('Found duplicate forms:');
      duplicates.rows.forEach(dup => {
        console.log(`\nForm Code: ${dup.form_code}`);
        console.log(`Count: ${dup.count}`);
        console.log(`Names: ${dup.form_names.join(', ')}`);
      });
      
      // Clean up duplicates - keep only the first one
      console.log('\nCleaning up duplicates...');
      
      for (const dup of duplicates.rows) {
        // Get all IDs for this form_code
        const forms = await client.query(`
          SELECT id, created_at 
          FROM bayview.forms 
          WHERE form_code = $1 
          ORDER BY created_at
        `, [dup.form_code]);
        
        // Keep the first, delete the rest
        const idsToDelete = forms.rows.slice(1).map(f => f.id);
        
        if (idsToDelete.length > 0) {
          await client.query(`
            DELETE FROM bayview.forms 
            WHERE id = ANY($1::uuid[])
          `, [idsToDelete]);
          
          console.log(`Deleted ${idsToDelete.length} duplicate(s) of ${dup.form_code}`);
        }
      }
    } else {
      console.log('No duplicate forms found.');
    }
    
    // Show final count
    const finalCount = await client.query(`
      SELECT COUNT(*) as total FROM bayview.forms
    `);
    
    console.log(`\nFinal form count: ${finalCount.rows[0].total}`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  checkDuplicates();
}

module.exports = { checkDuplicates };