// Oracle health check: connectivity + required tables existence
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
    env: {
      hasOracleUser: !!process.env.ORACLE_USER,
      hasConnectString: !!process.env.ORACLE_CONNECT_STRING
    },
    database: {
      connected: false,
      ping: null,
      tables: {}
    }
  };

  // Report how connect string was resolved (OCI vs hardcoded)
  try {
    response.connection = getResolvedConnectInfo();
  } catch {}

  const requiredTables = [
    'CROUSE_CHAPEL_SERVICE_APPLICATIONS',
    'CROUSE_CHAPEL_WEDDING_DETAILS',
    'CROUSE_CHAPEL_MEMORIAL_DETAILS',
    'CROUSE_CHAPEL_SERVICE_MUSIC',
    'CROUSE_CHAPEL_SERVICE_EQUIPMENT',
    'CROUSE_CHAPEL_CLERGY',
    'CROUSE_CHAPEL_SERVICE_CLERGY'
  ];

  let connection;
  try {
    connection = await getConnection();
    response.database.connected = true;

    // Basic ping
    const pingStart = Date.now();
    await connection.execute('SELECT 1 FROM dual');
    response.database.ping = Date.now() - pingStart;

    // Check required tables
    for (const table of requiredTables) {
      try {
        const r = await connection.execute(
          'SELECT COUNT(*) FROM user_tables WHERE table_name = :1',
          [table]
        );
        const exists = Array.isArray(r.rows) && r.rows[0] && (r.rows[0][0] || r.rows[0][0] === 0)
          ? r.rows[0][0] > 0
          : false;
        response.database.tables[table] = exists ? 'exists' : 'missing';
      } catch (err) {
        response.database.tables[table] = `error: ${err.message}`;
      }
    }

    // Overall status
    const allExist = Object.values(response.database.tables).every(v => v === 'exists');
    response.status = response.database.connected && allExist ? 'healthy' : 'degraded';
  } catch (error) {
    response.status = 'unhealthy';
    response.database.error = error.message;
    return res.status(500).json(response);
  } finally {
    if (connection) {
      try { await connection.close(); } catch {}
      try { await closePool(); } catch {}
    }
  }

  return res.status(200).json(response);
}
