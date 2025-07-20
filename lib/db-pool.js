import { Pool } from 'pg';

/**
 * Get pool configuration
 * @returns {Object} Pool configuration
 */
function getPoolConfig() {
  const DATABASE_URL = process.env.DATABASE_URL_CLEAN || process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL or DATABASE_URL_CLEAN environment variable is required');
  }
  
  // Remove any newlines and clean up the connection string
  const cleanUrl = DATABASE_URL.trim().replace(/[\n\r]/g, '').replace('?sslmode=require', '');
  
  return {
    // Connection string
    connectionString: cleanUrl,
    
    // SSL configuration
    ssl: cleanUrl.includes('ondigitalocean.com') ? { rejectUnauthorized: false } : false,
    
    // Pool size configuration
    // Why 10? DigitalOcean limit is 100 connections total:
    // - System reserved: ~10 (monitoring, backups, pg_cron)
    // - Available: ~90 connections
    // - Bay View runs ~10 instances (prod + staging + admin)
    // - 90 ÷ 10 = 9 per instance, we use 10 for safety
    // - This provides 3-5x headroom over typical load
    // - See docs/connection-pool-migration.md for full analysis
    max: 10, // Maximum number of clients in the pool (reduced from default 20)
    min: 2,  // Minimum number of clients in the pool
    
    // Connection timeout configuration
    connectionTimeoutMillis: 10000, // 10 seconds to establish connection
    idleTimeoutMillis: 30000, // 30 seconds before idle client is removed
    
    // Query timeout
    query_timeout: 30000, // 30 seconds max query time
    statement_timeout: 30000, // 30 seconds max statement time
    
    // Keep alive
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000
  };
}

// Create a single pool instance to be reused
let pool = null;

/**
 * Get or create the connection pool
 * @returns {Pool} PostgreSQL connection pool
 */
export function getPool() {
  if (!pool) {
    const poolConfig = getPoolConfig();
    pool = new Pool(poolConfig);
    
    // Pool error handling
    pool.on('error', (err, client) => {
      console.error('Unexpected error on idle client', err);
    });
    
    // Pool connect event
    pool.on('connect', (client) => {
      // Set application name for monitoring
      client.query("SET application_name = 'bay-view-unified-system'");
    });
    
    // Pool remove event (for debugging)
    pool.on('remove', () => {
      console.log('Client removed from pool');
    });
  }
  
  return pool;
}

/**
 * Execute a query using the connection pool
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<any>} Query result
 */
export async function query(text, params) {
  const pool = getPool();
  return pool.query(text, params);
}

/**
 * Get a client from the pool for transaction use
 * @returns {Promise<PoolClient>} Pool client
 */
export async function getClient() {
  const pool = getPool();
  return pool.connect();
}

/**
 * Execute a function with a pooled connection
 * @param {Function} queryFn - Function that receives the client
 * @returns {Promise<any>} Query result
 */
export async function withPooledConnection(queryFn) {
  const client = await getClient();
  
  try {
    return await queryFn(client);
  } finally {
    client.release();
  }
}

/**
 * Execute a transaction with a pooled connection
 * @param {Function} transactionFn - Function that receives the client
 * @returns {Promise<any>} Transaction result
 */
export async function withPooledTransaction(transactionFn) {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    const result = await transactionFn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get pool statistics for monitoring
 * @returns {Object} Pool statistics
 */
export function getPoolStats() {
  if (!pool) {
    return {
      totalCount: 0,
      idleCount: 0,
      waitingCount: 0
    };
  }
  
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  };
}

/**
 * Gracefully shutdown the pool
 * @returns {Promise<void>}
 */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// Graceful shutdown on process termination
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing database pool...');
  await closePool();
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing database pool...');
  await closePool();
});