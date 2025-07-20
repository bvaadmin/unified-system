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
  
  // Check property.locations structure
  const locationColumns = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'property' AND table_name = 'locations'
    ORDER BY ordinal_position
  `);
  
  console.log('🏘️  property.locations columns:');
  console.table(locationColumns.rows);
  
  // Check property.leaseholds structure
  const leaseholdColumns = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'property' AND table_name = 'leaseholds'
    ORDER BY ordinal_position
  `);
  
  console.log('\n📋 property.leaseholds columns:');
  console.table(leaseholdColumns.rows);
  
  // Check sample data
  const sampleLocations = await client.query(`
    SELECT * FROM property.locations LIMIT 3
  `);
  
  console.log('\n📍 Sample locations:');
  console.table(sampleLocations.rows);
  
  await client.end();
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}