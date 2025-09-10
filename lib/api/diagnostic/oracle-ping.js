// Oracle readiness ping: minimal connectivity check for uptime monitors
import { getConnection, closePool, getResolvedConnectInfo } from '../../database/adapters/oracle-adapter.js';

const allowedOrigins = [
  'https://bvaadmin.github.io',
  'https://vercel.com',
  'http://localhost:3000',
  'http://127.0.0.1:5500'
];

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://bvaadmin.github.io');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const response = {
    status: 'checking',
    timestamp: new Date().toISOString(),
    pingMs: null
  };

  // Optional: include how connection was resolved without exposing secrets
  try { response.connection = getResolvedConnectInfo(); } catch {}

  let connection;
  try {
    connection = await getConnection();
    const start = Date.now();
    await connection.execute('SELECT 1 FROM dual');
    response.pingMs = Date.now() - start;
    response.status = 'healthy';
    return res.status(200).json(response);
  } catch (err) {
    response.status = 'unhealthy';
    response.error = err.message;
    return res.status(500).json(response);
  } finally {
    if (connection) { try { await connection.close(); } catch {} }
    try { await closePool(); } catch {}
  }
}

