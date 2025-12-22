import { applyCors } from '../../cors.js';
import { getConnection } from '../../database/adapters/oracle-adapter.js';
import oracledb from 'oracledb';

export default async function handler(req, res) {
  // Apply CORS
  applyCors(req, res);
  
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const health = {
    status: 'checking',
    timestamp: new Date().toISOString(),
    checks: {
      oracle: { status: 'checking' }
    },
    debug: {}
  };

  // Check database connection
  let connection;
  try {
    // Add detailed logging
    console.log('--- Oracle Connection Test ---');
    console.log('oracledb.thin:', oracledb.thin);
    
    connection = await getConnection();
    await connection.execute('SELECT 1 FROM dual');
    
    health.checks.oracle = { 
      status: 'ok', 
      message: 'Oracle connection successful' 
    };
    health.status = 'healthy';
    
  } catch (error) {
    console.error('--- Oracle Connection Error ---', error);
    health.checks.oracle = { 
      status: 'error', 
      message: error.message 
    };
    health.status = 'unhealthy';
    health.debug.errorMessage = error.message;
    health.debug.errorStack = error.stack;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection:', err.message);
      }
    }
    console.log('--- Oracle Connection Test End ---');
  }

  return res.status(200).json(health);
}
