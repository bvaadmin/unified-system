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
  
  // Overall import statistics
  const stats = await client.query(`
    SELECT 
      COUNT(DISTINCT l.id) as total_leaseholds,
      COUNT(DISTINCT l.property_id) as unique_properties,
      COUNT(DISTINCT l.person_id) as unique_persons,
      COUNT(DISTINCT CASE WHEN l.voting_rights THEN l.id END) as voting_leaseholders,
      COUNT(DISTINCT m.id) as active_members
    FROM property.leaseholds l
    LEFT JOIN core.members m ON l.person_id = m.person_id
    WHERE l.created_at >= CURRENT_DATE
  `);
  
  console.log('📊 Import Statistics (Today):');
  console.table(stats.rows[0]);
  
  // Total cottage count
  const cottageCount = await client.query(`
    SELECT COUNT(*) as total_cottages 
    FROM property.locations 
    WHERE property_type = 'cottage'
  `);
  
  console.log(`\n🏘️  Total cottages in database: ${cottageCount.rows[0].total_cottages}`);
  
  // Sample imported records
  const sample = await client.query(`
    SELECT 
      loc.block_number, 
      loc.lot_number,
      p.first_name || ' ' || p.last_name as leaseholder_name,
      l.voting_rights,
      l.lease_type,
      CASE WHEN m.id IS NOT NULL THEN 'Yes' ELSE 'No' END as is_member,
      m.member_number
    FROM property.leaseholds l
    JOIN property.locations loc ON l.property_id = loc.id
    JOIN core.persons p ON l.person_id = p.person_id
    LEFT JOIN core.members m ON l.person_id = m.person_id
    WHERE l.created_at >= CURRENT_DATE
    ORDER BY loc.block_number, loc.lot_number
    LIMIT 20
  `);
  
  console.log('\n📋 Sample Imported Records:');
  console.table(sample.rows);
  
  // Check for any duplicates
  const duplicates = await client.query(`
    SELECT block_number, lot_number, COUNT(*) as count
    FROM property.locations
    WHERE property_type = 'cottage'
    GROUP BY block_number, lot_number
    HAVING COUNT(*) > 1
  `);
  
  if (duplicates.rows.length > 0) {
    console.log('\n⚠️  Duplicate Properties Found:');
    console.table(duplicates.rows);
  } else {
    console.log('\n✅ No duplicate properties found');
  }
  
  // Member statistics
  const memberStats = await client.query(`
    SELECT 
      membership_type,
      status,
      COUNT(*) as count,
      COUNT(CASE WHEN voting_eligible THEN 1 END) as voting_members
    FROM core.members
    WHERE created_at >= CURRENT_DATE
    GROUP BY membership_type, status
    ORDER BY count DESC
  `);
  
  console.log('\n👥 New Members by Type:');
  console.table(memberStats.rows);
  
  await client.end();
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}