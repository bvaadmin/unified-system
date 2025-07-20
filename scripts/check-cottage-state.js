import { createPgClient } from '../lib/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkCottageState() {
  const client = createPgClient();
  
  try {
    await client.connect();
    console.log('🔍 Checking current cottage leaseholder state...\n');
    
    // Check current property data
    const result = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM property.locations WHERE property_type = 'cottage') as cottage_count,
        (SELECT COUNT(*) FROM property.leaseholds WHERE status = 'active') as active_leases,
        (SELECT COUNT(*) FROM core.persons WHERE person_type = 'member') as member_persons,
        (SELECT COUNT(*) FROM core.members WHERE membership_type = 'voting') as voting_members
    `);
    
    console.log('📊 Current database state:');
    console.log(`  🏠 Cottages: ${result.rows[0].cottage_count}`);
    console.log(`  📄 Active leases: ${result.rows[0].active_leases}`);
    console.log(`  👥 Member persons: ${result.rows[0].member_persons}`);
    console.log(`  🗳️  Voting members: ${result.rows[0].voting_members}`);
    
    // Check for any existing cottages
    if (result.rows[0].cottage_count > 0) {
      const sampleCottages = await client.query(`
        SELECT block_number, lot_number, street_address, street_name 
        FROM property.locations 
        WHERE property_type = 'cottage' 
        LIMIT 5
      `);
      
      console.log('\n📍 Sample existing cottages:');
      sampleCottages.rows.forEach(cottage => {
        const address = cottage.street_address ? 
          `${cottage.street_address} ${cottage.street_name || ''}`.trim() : 
          'No address';
        console.log(`  - Block ${cottage.block_number}, Lot ${cottage.lot_number}: ${address}`);
      });
    }
    
    // Check backup tables
    const backupCheck = await client.query(`
      SELECT 
        table_name,
        (xpath('/row/cnt/text()', query_to_xml('SELECT COUNT(*) as cnt FROM ' || table_schema || '.' || table_name, false, true, '')))[1]::text::int as row_count
      FROM information_schema.tables 
      WHERE table_name LIKE '%backup%' 
        AND table_schema IN ('property', 'core')
      ORDER BY table_name
    `).catch(() => ({ rows: [] }));
    
    if (backupCheck.rows.length > 0) {
      console.log('\n💾 Existing backup tables:');
      backupCheck.rows.forEach(backup => {
        console.log(`  - ${backup.table_name}: ${backup.row_count} rows`);
      });
    } else {
      console.log('\n⚠️  No backup tables found');
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

checkCottageState();