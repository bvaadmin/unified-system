import { withTransaction } from '../lib/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function backupPropertyTables() {
  console.log('💾 Creating backup of property tables...\n');
  
  try {
    await withTransaction(async (client) => {
      const timestamp = new Date().toISOString().replace(/[-:.]/g, '_').substring(0, 19);
      
      // Backup property.locations
      const locationsBackup = `property.locations_backup_${timestamp}`;
      await client.query(`
        CREATE TABLE ${locationsBackup} AS 
        SELECT * FROM property.locations
      `);
      const locCount = await client.query(`SELECT COUNT(*) FROM ${locationsBackup}`);
      console.log(`✅ Backed up property.locations → ${locationsBackup} (${locCount.rows[0].count} rows)`);
      
      // Backup property.leaseholds
      const leaseholdsBackup = `property.leaseholds_backup_${timestamp}`;
      await client.query(`
        CREATE TABLE ${leaseholdsBackup} AS 
        SELECT * FROM property.leaseholds
      `);
      const leaseCount = await client.query(`SELECT COUNT(*) FROM ${leaseholdsBackup}`);
      console.log(`✅ Backed up property.leaseholds → ${leaseholdsBackup} (${leaseCount.rows[0].count} rows)`);
      
      // Backup core.persons
      const personsBackup = `core.persons_backup_${timestamp}`;
      await client.query(`
        CREATE TABLE ${personsBackup} AS 
        SELECT * FROM core.persons
      `);
      const personCount = await client.query(`SELECT COUNT(*) FROM ${personsBackup}`);
      console.log(`✅ Backed up core.persons → ${personsBackup} (${personCount.rows[0].count} rows)`);
      
      // Backup core.members
      const membersBackup = `core.members_backup_${timestamp}`;
      await client.query(`
        CREATE TABLE ${membersBackup} AS 
        SELECT * FROM core.members
      `);
      const memberCount = await client.query(`SELECT COUNT(*) FROM ${membersBackup}`);
      console.log(`✅ Backed up core.members → ${membersBackup} (${memberCount.rows[0].count} rows)`);
      
      // Create backup metadata
      await client.query(`
        CREATE TABLE IF NOT EXISTS core.backup_metadata (
          id SERIAL PRIMARY KEY,
          backup_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          backup_name VARCHAR(100),
          table_name VARCHAR(100),
          row_count INTEGER,
          purpose TEXT
        )
      `);
      
      // Record backup metadata
      const backups = [
        { backup: locationsBackup, original: 'property.locations', count: locCount.rows[0].count },
        { backup: leaseholdsBackup, original: 'property.leaseholds', count: leaseCount.rows[0].count },
        { backup: personsBackup, original: 'core.persons', count: personCount.rows[0].count },
        { backup: membersBackup, original: 'core.members', count: memberCount.rows[0].count }
      ];
      
      for (const backup of backups) {
        await client.query(`
          INSERT INTO core.backup_metadata (backup_name, table_name, row_count, purpose)
          VALUES ($1, $2, $3, $4)
        `, [backup.backup, backup.original, backup.count, 'Pre-cottage import backup']);
      }
      
      console.log('\n📊 Backup Summary:');
      console.log(`  Timestamp: ${timestamp}`);
      console.log(`  Tables backed up: 4`);
      console.log(`  Total rows preserved: ${
        parseInt(locCount.rows[0].count) + 
        parseInt(leaseCount.rows[0].count) + 
        parseInt(personCount.rows[0].count) + 
        parseInt(memberCount.rows[0].count)
      }`);
      
      return timestamp;
    });
    
    console.log('\n✅ Backup completed successfully!');
    console.log('💡 To restore, use: CREATE TABLE <original> AS SELECT * FROM <backup_table>');
    
  } catch (err) {
    console.error('❌ Backup failed:', err.message);
    throw err;
  }
}

backupPropertyTables();