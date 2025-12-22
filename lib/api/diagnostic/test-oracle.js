import { applyCors } from '../../cors.js';
import { getConnection } from '../../database/adapters/oracle-adapter.js';
import oracledb from 'oracledb';

export default async function handler(req, res) {
  console.log('--- ENTERING /api/diagnostic/test-oracle ---');
  
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
    console.log('--- Oracle Connection Test ---');
    console.log('oracledb.thin:', oracledb.thin);
    
    console.log('Attempting to get a connection...');
    connection = await getConnection();
    console.log('Successfully got a connection.');

    console.log('Attempting to execute a query...');
    await connection.execute('SELECT 1 FROM dual');
    console.log('Successfully executed a query.');
    
    health.checks.oracle = { 
      status: 'ok', 
      message: 'Oracle connection successful' 
    };
    health.status = 'healthy';
    
  } catch (error) {
    console.error('--- Oracle Connection Error ---');
    console.error(error);
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
        console.log('Closing connection...');
        await connection.close();
        console.log('Connection closed.');
      } catch (err) {
        console.error('Error closing connection:', err.message);
      }
    }
    console.log('--- Oracle Connection Test End ---');
  }

  console.log('--- EXITING /api/diagnostic/test-oracle ---');
  return res.status(200).json(health);
}
