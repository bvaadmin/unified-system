import { createPgClient } from '../lib/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkImportProgress() {
  const client = createPgClient();
  
  try {
    await client.connect();
    
    // Check today's imports
    const todayResult = await client.query(`
      SELECT 
        'property.locations' as table_name,
        COUNT(*) as records_today
      FROM property.locations 
      WHERE created_at >= CURRENT_DATE
      UNION ALL
      SELECT 
        'property.leaseholds' as table_name,
        COUNT(*) as records_today
      FROM property.leaseholds 
      WHERE created_at >= CURRENT_DATE
      UNION ALL
      SELECT 
        'core.persons' as table_name,
        COUNT(*) as records_today
      FROM core.persons 
      WHERE created_at >= CURRENT_DATE
      UNION ALL
      SELECT 
        'core.members' as table_name,
        COUNT(*) as records_today
      FROM core.members 
      WHERE created_at >= CURRENT_DATE
    `);
    
    console.log('📊 Records created today:');
    todayResult.rows.forEach(row => {
      console.log(`  ${row.table_name}: ${row.records_today}`);
    });
    
    // Check for active transactions
    const activeTransactions = await client.query(`
      SELECT pid, state, query_start, 
             age(clock_timestamp(), query_start) as duration,
             query
      FROM pg_stat_activity
      WHERE state != 'idle' 
        AND query NOT LIKE '%pg_stat_activity%'
        AND datname = current_database()
      ORDER BY query_start
    `);
    
    if (activeTransactions.rows.length > 0) {
      console.log('\n⚠️  Active transactions:');
      activeTransactions.rows.forEach(tx => {
        console.log(`  PID ${tx.pid}: ${tx.state} for ${tx.duration}`);
        console.log(`    Query: ${tx.query.substring(0, 100)}...`);
      });
    } else {
      console.log('\n✅ No active transactions');
    }
    
    // Check for locks
    const locks = await client.query(`
      SELECT 
        locktype, 
        relation::regclass, 
        mode, 
        granted
      FROM pg_locks
      WHERE relation IN (
        'property.locations'::regclass,
        'property.leaseholds'::regclass,
        'core.persons'::regclass,
        'core.members'::regclass
      )
    `);
    
    if (locks.rows.length > 0) {
      console.log('\n🔒 Table locks:');
      locks.rows.forEach(lock => {
        console.log(`  ${lock.relation}: ${lock.mode} (granted: ${lock.granted})`);
      });
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

checkImportProgress();