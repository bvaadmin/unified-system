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
    WHERE conrelid = 'core.persons'::regclass
    AND conname LIKE '%person_type%'
  `);
  
  console.log('🔍 Person type constraint:');
  console.table(constraintResult.rows);
  
  // Check existing person types
  const typesResult = await client.query(`
    SELECT DISTINCT person_type, COUNT(*) as count
    FROM core.persons
    GROUP BY person_type
    ORDER BY count DESC
  `);
  
  console.log('\n📋 Existing person types:');
  console.table(typesResult.rows);
  
  await client.end();
} catch (error) {
  console.error('❌ Error:', error.message);
}