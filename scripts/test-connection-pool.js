#!/usr/bin/env node
import dotenv from 'dotenv';
import { getPool, withPooledConnection, getPoolStats, closePool } from '../lib/db-pool.js';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testConnectionPool() {
  console.log('Testing Bay View Database Connection Pool...\n');
  
  try {
    // Test 1: Basic pool connection
    console.log('Test 1: Basic pool connection');
    await withPooledConnection(async (client) => {
      const result = await client.query('SELECT NOW() as current_time, current_database() as database');
      console.log('✅ Connected to database:', result.rows[0].database);
      console.log('✅ Server time:', result.rows[0].current_time);
    });
    
    // Test 2: Pool statistics
    console.log('\nTest 2: Pool statistics');
    const stats1 = getPoolStats();
    console.log('Pool stats after first query:', stats1);
    
    // Test 3: Multiple concurrent connections
    console.log('\nTest 3: Multiple concurrent connections');
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        withPooledConnection(async (client) => {
          const result = await client.query('SELECT pg_sleep(0.5), $1::int as conn_num', [i + 1]);
          return `Connection ${i + 1} completed`;
        })
      );
    }
    
    const results = await Promise.all(promises);
    results.forEach(result => console.log('✅', result));
    
    const stats2 = getPoolStats();
    console.log('Pool stats during concurrent queries:', stats2);
    
    // Test 4: Check connection limits
    console.log('\nTest 4: Connection limit information');
    await withPooledConnection(async (client) => {
      // Check max connections setting
      const maxConnResult = await client.query(`
        SELECT setting::int as max_connections 
        FROM pg_settings 
        WHERE name = 'max_connections'
      `);
      console.log('Database max_connections:', maxConnResult.rows[0].max_connections);
      
      // Check current connections
      const currentConnResult = await client.query(`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections,
          count(*) FILTER (WHERE application_name = 'bay-view-unified-system') as our_connections
        FROM pg_stat_activity
        WHERE datname = current_database()
      `);
      console.log('Current connections:', currentConnResult.rows[0]);
    });
    
    // Test 5: Transaction with pool
    console.log('\nTest 5: Transaction with pooled connection');
    await withPooledConnection(async (client) => {
      await client.query('BEGIN');
      
      // Check if we're in a transaction
      const txResult = await client.query('SELECT current_setting(\'transaction_isolation\') as isolation_level');
      console.log('✅ Transaction started with isolation:', txResult.rows[0].isolation_level);
      
      await client.query('ROLLBACK');
      console.log('✅ Transaction rolled back');
    });
    
    // Final pool stats
    console.log('\nFinal pool statistics:');
    const finalStats = getPoolStats();
    console.log(finalStats);
    
    console.log('\n✅ All connection pool tests passed!');
    console.log('\n📊 Connection Pool Benefits:');
    console.log('- Reuses connections instead of creating new ones');
    console.log('- Limits concurrent connections to prevent hitting DigitalOcean limits');
    console.log('- Automatic connection retry and error handling');
    console.log('- Better performance through connection reuse');
    
  } catch (error) {
    console.error('\n❌ Connection pool test failed:');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    // Clean up
    await closePool();
    console.log('\n✅ Pool closed gracefully');
  }
}

// Run the test
testConnectionPool();