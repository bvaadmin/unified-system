import { Client } from 'pg';
import { getPool, withPooledConnection, withPooledTransaction, getPoolStats } from './db-pool.js';

/**
 * Create a PostgreSQL client with proper SSL configuration
 * @returns {Client} Configured PostgreSQL client
 * @deprecated Use getPool() or withPooledConnection() instead for better connection management
 */
export function createPgClient() {
  const DATABASE_URL = process.env.DATABASE_URL_CLEAN || process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL or DATABASE_URL_CLEAN environment variable is required');
  }
  
  console.warn('createPgClient() is deprecated. Consider using connection pooling with getPool() or withPooledConnection()');
  
  return new Client({
    connectionString: DATABASE_URL.replace('?sslmode=require', ''),
    ssl: process.env.NODE_ENV === 'production' ? true : { rejectUnauthorized: false }
  });
}

// Export pool functions for gradual migration
export { getPool, withPooledConnection, withPooledTransaction, getPoolStats };

/**
 * Execute a database query with automatic connection handling
 * @param {Function} queryFn - Function that receives the client and performs queries
 * @returns {Promise<any>} Query result
 */
export async function withDatabase(queryFn) {
  const client = createPgClient();
  
  try {
    await client.connect();
    return await queryFn(client);
  } finally {
    await client.end();
  }
}

/**
 * Execute a transaction with automatic rollback on error
 * @param {Function} transactionFn - Function that receives the client and performs queries
 * @returns {Promise<any>} Transaction result
 */
export async function withTransaction(transactionFn) {
  const client = createPgClient();
  
  try {
    await client.connect();
    await client.query('BEGIN');
    
    const result = await transactionFn(client);
    
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}