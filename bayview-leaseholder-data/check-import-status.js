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
  
  // Check cottages
  const cottages = await client.query(`
    SELECT COUNT(*) as count FROM property.locations 
    WHERE property_type = 'cottage'
  `);
  console.log(`🏘️  Cottages: ${cottages.rows[0].count}`);
  
  // Check leaseholds
  const leaseholds = await client.query(`
    SELECT COUNT(*) as count FROM property.leaseholds
  `);
  console.log(`📋 Leaseholds: ${leaseholds.rows[0].count}`);
  
  // Check persons
  const persons = await client.query(`
    SELECT COUNT(*) as count FROM core.persons
  `);
  console.log(`👥 Persons: ${persons.rows[0].count}`);
  
  // Check members
  const members = await client.query(`
    SELECT COUNT(*) as count FROM core.members
  `);
  console.log(`🎫 Members: ${members.rows[0].count}`);
  
  // Sample cottage data
  const sample = await client.query(`
    SELECT 
      l.block_number,
      l.lot_number,
      l.street_address
    FROM property.locations l
    WHERE property_type = 'cottage'
    ORDER BY l.block_number, l.lot_number
    LIMIT 10
  `);
  
  console.log('\n📍 Sample Cottages:');
  console.table(sample.rows);
  
  await client.end();
} catch (error) {
  console.error('❌ Error:', error.message);
}