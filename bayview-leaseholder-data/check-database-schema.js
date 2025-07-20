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
  console.log('✅ Connected to database\n');
  
  // Check schemas
  const schemas = await client.query(`
    SELECT schema_name 
    FROM information_schema.schemata 
    WHERE schema_name NOT IN ('information_schema', 'pg_catalog')
    ORDER BY schema_name
  `);
  
  console.log('📋 Available schemas:');
  schemas.rows.forEach(r => console.log(`  - ${r.schema_name}`));
  
  // Check property schema tables
  const propertyTables = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'property'
    ORDER BY table_name
  `);
  
  console.log('\n🏘️  Tables in property schema:');
  if (propertyTables.rows.length === 0) {
    console.log('  ❌ No tables found in property schema');
  } else {
    propertyTables.rows.forEach(r => console.log(`  - ${r.table_name}`));
  }
  
  // Check core schema tables
  const coreTables = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'core'
    ORDER BY table_name
  `);
  
  console.log('\n👥 Tables in core schema:');
  if (coreTables.rows.length === 0) {
    console.log('  ❌ No tables found in core schema');
  } else {
    coreTables.rows.forEach(r => console.log(`  - ${r.table_name}`));
  }
  
  await client.end();
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}