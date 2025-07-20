import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL?.replace('?sslmode=require', '');
const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

try {
  await client.connect();
  
  // Check constraint definition
  const constraintResult = await client.query(`
    SELECT 
      conname as constraint_name,
      pg_get_constraintdef(oid) as constraint_definition
    FROM pg_constraint
    WHERE conrelid = 'property.leaseholds'::regclass
    AND conname LIKE '%lease_type%'
  `);
  
  console.log('🔍 Lease type constraint:');
  console.table(constraintResult.rows);
  
  // Check existing lease types
  const typesResult = await client.query(`
    SELECT DISTINCT lease_type, COUNT(*) as count
    FROM property.leaseholds
    GROUP BY lease_type
    ORDER BY count DESC
  `);
  
  console.log('\n📋 Existing lease types:');
  console.table(typesResult.rows);
  
  await client.end();
} catch (error) {
  console.error('❌ Error:', error.message);
}