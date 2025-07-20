#!/usr/bin/env node
import dotenv from 'dotenv';
import { withPooledConnection, getPoolStats, closePool } from '../lib/db-pool.js';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function simulateApiCall(requestId) {
  const start = Date.now();
  
  return withPooledConnection(async (client) => {
    // Simulate API query work
    const result = await client.query(
      'SELECT $1::int as request_id, NOW() as timestamp, pg_sleep(0.1)',
      [requestId]
    );
    
    const duration = Date.now() - start;
    return {
      requestId,
      duration,
      timestamp: result.rows[0].timestamp
    };
  });
}

async function runLoadTest() {
  console.log('🚀 Bay View Connection Pool Load Test\n');
  console.log('Simulating 20 concurrent API requests...\n');
  
  // Get initial stats
  const initialStats = getPoolStats();
  console.log('Initial pool stats:', initialStats);
  
  // Create 20 concurrent requests
  const concurrentRequests = 20;
  const promises = [];
  
  console.log('\nStarting requests...');
  for (let i = 1; i <= concurrentRequests; i++) {
    promises.push(simulateApiCall(i));
  }
  
  // Monitor pool during execution
  const monitorInterval = setInterval(() => {
    const stats = getPoolStats();
    console.log(`Pool: ${stats.totalCount} total, ${stats.idleCount} idle, ${stats.waitingCount} waiting`);
  }, 100);
  
  try {
    // Wait for all requests to complete
    const results = await Promise.all(promises);
    
    clearInterval(monitorInterval);
    
    // Show results
    console.log('\n✅ All requests completed!\n');
    console.log('Request Performance:');
    console.log('ID'.padEnd(4), 'Duration'.padEnd(10), 'Completed At');
    console.log('-'.repeat(50));
    
    results.sort((a, b) => a.requestId - b.requestId);
    results.forEach(result => {
      console.log(
        result.requestId.toString().padEnd(4),
        `${result.duration}ms`.padEnd(10),
        new Date(result.timestamp).toLocaleTimeString()
      );
    });
    
    // Performance summary
    const durations = results.map(r => r.duration);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);
    
    console.log('\n📊 Performance Summary:');
    console.log(`Average response time: ${avgDuration.toFixed(0)}ms`);
    console.log(`Fastest response: ${minDuration}ms`);
    console.log(`Slowest response: ${maxDuration}ms`);
    
    // Final pool stats
    console.log('\nFinal pool stats:', getPoolStats());
    
    // Compare with non-pooled estimate
    const nonPooledEstimate = concurrentRequests * 200; // Assume 200ms per connection setup
    const actualTotal = Date.now() - startTime;
    const timeSaved = nonPooledEstimate - actualTotal;
    
    console.log('\n💡 Connection Pool Benefits:');
    console.log(`Total execution time: ${actualTotal}ms`);
    console.log(`Estimated without pooling: ${nonPooledEstimate}ms`);
    console.log(`Time saved: ${timeSaved}ms (${((timeSaved/nonPooledEstimate)*100).toFixed(0)}% faster)`);
    console.log(`Max connections used: ${getPoolStats().totalCount} (limit is 100)`);
    
  } catch (error) {
    clearInterval(monitorInterval);
    console.error('\n❌ Load test failed:', error.message);
  } finally {
    await closePool();
    console.log('\n✅ Connection pool closed');
  }
}

const startTime = Date.now();
runLoadTest();