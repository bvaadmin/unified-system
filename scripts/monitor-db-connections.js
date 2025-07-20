#!/usr/bin/env node
import dotenv from 'dotenv';
import { withPooledConnection, getPoolStats, closePool } from '../lib/db-pool.js';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function monitorConnections() {
  console.log('🔍 Bay View Database Connection Monitor\n');
  
  try {
    await withPooledConnection(async (client) => {
      // 1. Database connection info
      const dbInfo = await client.query(`
        SELECT 
          current_database() as database,
          current_user as user,
          version() as version,
          pg_postmaster_start_time() as server_start_time
      `);
      
      console.log('📊 Database Information:');
      console.log('Database:', dbInfo.rows[0].database);
      console.log('User:', dbInfo.rows[0].user);
      console.log('Server Start:', new Date(dbInfo.rows[0].server_start_time).toLocaleString());
      console.log('PostgreSQL Version:', dbInfo.rows[0].version.split(',')[0]);
      
      // 2. Connection limits
      const limits = await client.query(`
        SELECT 
          setting::int as max_connections
        FROM pg_settings 
        WHERE name = 'max_connections'
      `);
      
      console.log('\n🔗 Connection Limits:');
      console.log('Max Connections:', limits.rows[0].max_connections);
      
      // 3. Current connections breakdown
      const connections = await client.query(`
        SELECT 
          state,
          application_name,
          client_addr,
          backend_start,
          query_start,
          COUNT(*) as count
        FROM pg_stat_activity
        WHERE datname = current_database()
        GROUP BY state, application_name, client_addr, backend_start, query_start
        ORDER BY count DESC, state
      `);
      
      console.log('\n📈 Current Connections by State:');
      const stateSummary = {};
      connections.rows.forEach(row => {
        stateSummary[row.state || 'unknown'] = (stateSummary[row.state || 'unknown'] || 0) + parseInt(row.count);
      });
      
      Object.entries(stateSummary).forEach(([state, count]) => {
        console.log(`${state}: ${count}`);
      });
      
      // 4. Connection details
      console.log('\n🔍 Connection Details:');
      console.log('App Name'.padEnd(30), 'State'.padEnd(10), 'Count'.padEnd(6), 'Client IP');
      console.log('-'.repeat(70));
      
      connections.rows.slice(0, 10).forEach(row => {
        console.log(
          (row.application_name || 'unnamed').padEnd(30),
          (row.state || 'unknown').padEnd(10),
          row.count.toString().padEnd(6),
          row.client_addr || 'local'
        );
      });
      
      // 5. Bay View specific connections
      const bayViewConnections = await client.query(`
        SELECT 
          pid,
          state,
          backend_start,
          query_start,
          state_change,
          wait_event_type,
          wait_event,
          SUBSTRING(query, 1, 50) as query_preview
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND application_name = 'bay-view-unified-system'
        ORDER BY backend_start DESC
      `);
      
      if (bayViewConnections.rows.length > 0) {
        console.log('\n🏛️ Bay View System Connections:');
        console.log('PID'.padEnd(8), 'State'.padEnd(10), 'Duration'.padEnd(12), 'Query Preview');
        console.log('-'.repeat(70));
        
        bayViewConnections.rows.forEach(row => {
          const duration = row.query_start 
            ? ((new Date() - new Date(row.query_start)) / 1000).toFixed(1) + 's'
            : 'N/A';
          
          console.log(
            row.pid.toString().padEnd(8),
            (row.state || 'unknown').padEnd(10),
            duration.padEnd(12),
            row.query_preview || 'No active query'
          );
        });
      }
      
      // 6. Connection pool stats
      console.log('\n🏊 Connection Pool Statistics:');
      const poolStats = getPoolStats();
      console.log('Total Connections:', poolStats.totalCount);
      console.log('Idle Connections:', poolStats.idleCount);
      console.log('Waiting Requests:', poolStats.waitingCount);
      
      // 7. Connection usage percentage
      const totalActive = stateSummary['active'] || 0;
      const totalIdle = stateSummary['idle'] || 0;
      const totalUsed = totalActive + totalIdle;
      const maxConn = limits.rows[0].max_connections;
      const usagePercent = ((totalUsed / maxConn) * 100).toFixed(1);
      
      console.log('\n📊 Connection Usage:');
      console.log(`${totalUsed} / ${maxConn} connections (${usagePercent}%)`);
      
      // Visual representation
      const barLength = 50;
      const filledLength = Math.round((totalUsed / maxConn) * barLength);
      const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
      console.log(`[${bar}] ${usagePercent}%`);
      
      // Warning thresholds
      if (usagePercent > 80) {
        console.log('\n⚠️  WARNING: Connection usage is above 80%!');
      } else if (usagePercent > 60) {
        console.log('\n⚡ NOTICE: Connection usage is above 60%');
      } else {
        console.log('\n✅ Connection usage is healthy');
      }
    });
    
  } catch (error) {
    console.error('\n❌ Monitoring failed:', error.message);
    process.exit(1);
  } finally {
    await closePool();
  }
}

// Check if continuous monitoring is requested
const continuous = process.argv.includes('--watch') || process.argv.includes('-w');

if (continuous) {
  console.log('Starting continuous monitoring (updates every 5 seconds)...\n');
  
  const monitor = async () => {
    console.clear();
    await monitorConnections();
  };
  
  monitor();
  setInterval(monitor, 5000);
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\nStopping monitor...');
    await closePool();
    process.exit(0);
  });
} else {
  monitorConnections();
}