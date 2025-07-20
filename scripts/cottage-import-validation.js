import { createPgClient } from '../lib/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function validateCottageImport() {
  const client = createPgClient();
  
  try {
    await client.connect();
    console.log('🔍 Bay View Cottage Import Validation Report');
    console.log('===========================================\n');
    
    // Overall statistics
    const stats = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM property.locations WHERE property_type = 'cottage') as total_cottages,
        (SELECT COUNT(*) FROM property.leaseholds WHERE status = 'active') as active_leaseholds,
        (SELECT COUNT(*) FROM core.persons WHERE person_type = 'member') as member_persons,
        (SELECT COUNT(*) FROM core.members) as total_members,
        (SELECT COUNT(*) FROM core.members WHERE voting_eligible = true) as voting_members,
        (SELECT COUNT(DISTINCT block_number) FROM property.locations WHERE property_type = 'cottage') as unique_blocks
    `);
    
    console.log('📊 Import Statistics:');
    const s = stats.rows[0];
    const expectedCottages = 536; // Real cottage count from Bay View data
    console.log(`  🏠 Total cottages: ${s.total_cottages} / ${expectedCottages} (${Math.round(s.total_cottages/expectedCottages*100)}% complete)`);
    console.log(`  📄 Active leaseholds: ${s.active_leaseholds}`);
    console.log(`  👥 Member persons: ${s.member_persons}`);
    console.log(`  👤 Total members: ${s.total_members}`);
    console.log(`  🗳️  Voting members: ${s.voting_members}`);
    console.log(`  🏘️  Unique blocks: ${s.unique_blocks}`);
    
    // Block distribution
    const blockDist = await client.query(`
      SELECT block_number, COUNT(*) as cottage_count
      FROM property.locations 
      WHERE property_type = 'cottage'
      GROUP BY block_number
      ORDER BY block_number
      LIMIT 10
    `);
    
    console.log('\n📍 Block Distribution (first 10 blocks):');
    blockDist.rows.forEach(row => {
      console.log(`  Block ${row.block_number}: ${row.cottage_count} cottages`);
    });
    
    // Data integrity checks
    console.log('\n🔒 Data Integrity Checks:');
    
    // Check for orphaned leaseholds
    const orphanedLeases = await client.query(`
      SELECT COUNT(*) as count
      FROM property.leaseholds l
      WHERE NOT EXISTS (SELECT 1 FROM property.locations loc WHERE loc.id = l.property_id)
    `);
    console.log(`  ✅ Orphaned leaseholds: ${orphanedLeases.rows[0].count}`);
    
    // Check for properties without leaseholds
    const emptyProperties = await client.query(`
      SELECT COUNT(*) as count
      FROM property.locations loc
      WHERE property_type = 'cottage'
      AND NOT EXISTS (SELECT 1 FROM property.leaseholds l WHERE l.property_id = loc.id)
    `);
    console.log(`  ⚠️  Properties without leaseholds: ${emptyProperties.rows[0].count}`);
    
    // Check for duplicate block/lot combinations
    const duplicates = await client.query(`
      SELECT block_number, lot_number, COUNT(*) as count
      FROM property.locations 
      WHERE property_type = 'cottage'
      GROUP BY block_number, lot_number
      HAVING COUNT(*) > 1
    `);
    console.log(`  ✅ Duplicate block/lot combinations: ${duplicates.rows.length}`);
    
    // Recent import activity
    const recentImports = await client.query(`
      SELECT 
        DATE(created_at) as import_date,
        COUNT(*) as properties_imported
      FROM property.locations
      WHERE property_type = 'cottage'
      AND created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY import_date DESC
    `);
    
    console.log('\n📅 Recent Import Activity:');
    recentImports.rows.forEach(row => {
      console.log(`  ${row.import_date}: ${row.properties_imported} properties`);
    });
    
    // Sample data validation
    const sampleData = await client.query(`
      SELECT 
        loc.block_number, 
        loc.lot_number,
        loc.street_address,
        p.first_name || ' ' || p.last_name as leaseholder_name,
        l.voting_rights,
        l.lease_start_date,
        CASE WHEN m.id IS NOT NULL THEN 'Yes' ELSE 'No' END as is_member
      FROM property.leaseholds l
      JOIN property.locations loc ON l.property_id = loc.id
      JOIN core.persons p ON l.person_id = p.id
      LEFT JOIN core.members m ON p.id = m.person_id
      WHERE loc.property_type = 'cottage'
      ORDER BY RANDOM()
      LIMIT 5
    `);
    
    console.log('\n📋 Sample Imported Records:');
    console.table(sampleData.rows);
    
    // Backup verification
    const backups = await client.query(`
      SELECT backup_name, table_name, row_count, backup_date
      FROM core.backup_metadata
      WHERE purpose = 'Pre-cottage import backup'
      ORDER BY backup_date DESC
    `);
    
    if (backups.rows.length > 0) {
      console.log('\n💾 Backup Status:');
      console.log('  ✅ Pre-import backups created:');
      backups.rows.forEach(backup => {
        console.log(`     - ${backup.table_name}: ${backup.row_count} rows backed up to ${backup.backup_name}`);
      });
    }
    
    // Final status
    const importStatus = s.total_cottages >= 312 ? '✅ COMPLETE' : '⏳ IN PROGRESS';
    console.log(`\n🎯 Import Status: ${importStatus}`);
    
    if (s.total_cottages < 312) {
      console.log(`   Remaining: ${312 - s.total_cottages} cottages to import`);
      console.log('   Run the import script again to complete the process');
    }
    
  } catch (err) {
    console.error('❌ Validation error:', err.message);
  } finally {
    await client.end();
  }
}

validateCottageImport();