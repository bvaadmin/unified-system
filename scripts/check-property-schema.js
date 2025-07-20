import { createPgClient } from '../lib/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkPropertySchema() {
  const client = createPgClient();
  
  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'property' 
        AND table_name = 'locations' 
      ORDER BY ordinal_position
    `);
    
    console.log('Columns in property.locations:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

checkPropertySchema();