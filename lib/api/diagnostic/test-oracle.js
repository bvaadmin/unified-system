import { applyCors } from '../../cors.js';
import { getConnection } from '../../database/adapters/oracle-adapter.js';

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
    }
  };

  // Check database connection
  let connection;
  try {
    connection = await getConnection();
    await connection.execute('SELECT 1 FROM dual');
    health.checks.oracle = { 
      status: 'ok', 
      message: 'Oracle connection successful' 
    };
    health.status = 'healthy';
  } catch (error) {
    health.checks.oracle = { 
      status: 'error', 
      message: error.message 
    };
    health.status = 'unhealthy';
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection:', err.message);
      }
    }
  }

  return res.status(200).json(health);
}