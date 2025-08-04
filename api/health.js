import { applyCors } from '../lib/cors.js';
import { createPgClient } from '../lib/db.js';

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
      api: { status: 'ok', message: 'API endpoint accessible' },
      database: { status: 'checking' },
      notion: { status: 'checking' },
      environment: { status: 'checking' }
    }
  };

  // Check database connection
  let pgClient;
  try {
    pgClient = createPgClient();
    await pgClient.connect();
    await pgClient.query('SELECT 1');
    health.checks.database = { 
      status: 'ok', 
      message: 'Database connection successful' 
    };
  } catch (error) {
    health.checks.database = { 
      status: 'error', 
      message: error.message 
    };
  } finally {
    if (pgClient) await pgClient.end();
  }

  // Check environment variables
  const requiredEnvVars = [
    'DATABASE_URL',
    'NOTION_API_KEY',
    'CHAPEL_NOTION_DB_ID',
    'MEMORIAL_NOTION_DB_ID'
  ];

  const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingEnvVars.length === 0) {
    health.checks.environment = { 
      status: 'ok', 
      message: 'All required environment variables present' 
    };
  } else {
    health.checks.environment = { 
      status: 'warning', 
      message: `Missing: ${missingEnvVars.join(', ')}` 
    };
  }

  // Check Notion configuration
  if (process.env.NOTION_API_KEY && process.env.NOTION_API_KEY.length > 0) {
    health.checks.notion = { 
      status: 'ok', 
      message: 'Notion API key configured' 
    };
  } else {
    health.checks.notion = { 
      status: 'error', 
      message: 'Notion API key not configured' 
    };
  }

  // Overall status
  const allChecks = Object.values(health.checks);
  if (allChecks.every(check => check.status === 'ok')) {
    health.status = 'healthy';
  } else if (allChecks.some(check => check.status === 'error')) {
    health.status = 'unhealthy';
  } else {
    health.status = 'degraded';
  }

  return res.status(200).json(health);
}