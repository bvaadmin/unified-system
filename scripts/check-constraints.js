import { createPgClient } from '../lib/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkConstraints() {
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
      WHERE tc.table_schema = 'property' 
        AND tc.table_name = 'locations'
      GROUP BY tc.constraint_name, tc.constraint_type
    `);
    
    console.log('Constraints on property.locations:');
    result.rows.forEach(row => {
      console.log(`  ${row.constraint_name} (${row.constraint_type}): ${row.columns || 'N/A'}`);
    });
    
    // Add the missing unique constraint
    console.log('\n🔧 Adding unique constraint on block_number, lot_number...');
    
    await client.query(`
      ALTER TABLE property.locations 
      ADD CONSTRAINT uk_property_locations_block_lot 
      UNIQUE (block_number, lot_number)
    `);
    
    console.log('✅ Unique constraint added successfully!');
    
  } catch (err) {
    if (err.code === '42P07') {
      console.log('✅ Unique constraint already exists');
    } else {
      console.error('Error:', err.message);
    }
  } finally {
    await client.end();
  }
}

checkConstraints();