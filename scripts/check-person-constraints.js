import { createPgClient } from '../lib/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkPersonConstraints() {
  const client = createPgClient();
  
  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT 
        tc.constraint_name, 
        tc.constraint_type,
        string_agg(kcu.column_name, ', ') as columns
      FROM information_schema.table_constraints tc
      LEFT JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'core' 
        AND tc.table_name = 'persons'
      GROUP BY tc.constraint_name, tc.constraint_type
    `);
    
    console.log('Constraints on core.persons:');
    result.rows.forEach(row => {
      console.log(`  ${row.constraint_name} (${row.constraint_type}): ${row.columns || 'N/A'}`);
    });
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

checkPersonConstraints();