import pg from 'pg';
const { Client } = pg;

async function checkChapelFees() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database\n');

    // Check current chapel-related fees
    const result = await client.query(`
      SELECT key, value, description, category
      FROM config.settings
      WHERE category = 'FINANCE' 
        AND (key LIKE '%chapel%' 
          OR key LIKE '%wedding%' 
          OR key LIKE '%memorial%'
          OR key LIKE '%funeral%'
          OR key LIKE '%service%')
      ORDER BY key;
    `);

    console.log('Current Chapel-Related Fees:');
    console.log('=' .repeat(80));
    
    if (result.rows.length === 0) {
      console.log('No chapel-related fees found in configuration.');
      
      // Check if there are any FINANCE settings at all
      const financeCheck = await client.query(`
        SELECT COUNT(*) as count FROM config.settings WHERE category = 'FINANCE';
      `);
      console.log(`\nTotal FINANCE settings: ${financeCheck.rows[0].count}`);
      
      // Check legacy fee structure
      console.log('\nChecking legacy wedding fees in chapel tables...');
      const legacyCheck = await client.query(`
        SELECT DISTINCT wedding_fee 
        FROM crouse_chapel.wedding_details 
        WHERE wedding_fee IS NOT NULL
        ORDER BY wedding_fee;
      `);
      
      if (legacyCheck.rows.length > 0) {
        console.log('Legacy wedding fees found:');
        legacyCheck.rows.forEach(row => {
          console.log(`  $${row.wedding_fee}`);
        });
      }
    } else {
      result.rows.forEach(row => {
        console.log(`Key: ${row.key}`);
        console.log(`Value: ${row.value}`);
        console.log(`Description: ${row.description || 'No description'}`);
        console.log(`Category: ${row.category}`);
        console.log('-'.repeat(40));
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkChapelFees();