// Oracle deep self-test: connectivity + insert/delete roundtrip (admin-only)
import { getConnection, closePool, oracledb, getResolvedConnectInfo } from '../../database/adapters/oracle-adapter.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Admin auth (Bearer token)
  const adminToken = process.env.ADMIN_TOKEN;
  const authHeader = req.headers.authorization || '';
  if (!adminToken || !authHeader.startsWith('Bearer ') || authHeader.slice(7) !== adminToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const response = {
    status: 'checking',
    timestamp: new Date().toISOString(),
    connection: undefined,
    operations: {
      pingMs: null,
      tableProbe: null,
      insert: null,
      cleanup: null
    }
  };

  try {
    try { response.connection = getResolvedConnectInfo(); } catch {}

    const startConnect = Date.now();
    const conn = await getConnection();
    const connectMs = Date.now() - startConnect;

    try {
      // Ping
      const pingStart = Date.now();
      await conn.execute('SELECT 1 FROM dual');
      response.operations.pingMs = Date.now() - pingStart;

      // Probe target table
      const table = 'BAYVIEW_MEMORIALS';
      const probe = await conn.execute(
        'SELECT COUNT(1) FROM user_tables WHERE table_name = :t',
        { t: table }
      );
      const exists = Array.isArray(probe.rows) && probe.rows[0] && probe.rows[0][0] > 0;
      response.operations.tableProbe = { table, exists };
      if (!exists) {
        throw new Error(`Required table ${table} not found`);
      }

      // Insert with RETURNING
      const binds = {
        submission_id: 'SELFTEST-' + Date.now(),
        first_name: 'Self',
        last_name: 'Test',
        application_type: 'immediate',
        is_member: 1,
        contact_name: 'Self Test',
        contact_email: 'selftest@example.com',
        contact_phone: '555-0000',
        fee_amount: 1.23,
        out_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        out_created_at: { dir: oracledb.BIND_OUT, type: oracledb.DATE }
      };

      const insSql = `
        INSERT INTO BAYVIEW_MEMORIALS (
          submission_id, first_name, last_name, application_type, 
          is_member, contact_name, contact_email, contact_phone,
          fee_amount, created_at
        ) VALUES (
          :submission_id, :first_name, :last_name, :application_type,
          :is_member, :contact_name, :contact_email, :contact_phone,
          :fee_amount, CURRENT_TIMESTAMP
        ) RETURNING id, created_at INTO :out_id, :out_created_at`;

      const insStart = Date.now();
      const ins = await conn.execute(insSql, binds, { autoCommit: false });
      const insertedId = ins?.outBinds?.out_id?.[0] ?? null;
      response.operations.insert = { ok: insertedId != null, id: insertedId, ms: Date.now() - insStart };

      // Cleanup
      const delStart = Date.now();
      if (insertedId != null) {
        await conn.execute('DELETE FROM BAYVIEW_MEMORIALS WHERE id = :id', { id: insertedId }, { autoCommit: true });
        response.operations.cleanup = { ok: true, ms: Date.now() - delStart };
      } else {
        response.operations.cleanup = { ok: false, skipped: true, reason: 'no id' };
      }

      response.status = 'healthy';
      response.ms = { connect: connectMs };
      try { await conn.close(); } catch {}
      try { await closePool(); } catch {}
      return res.status(200).json(response);
    } catch (opErr) {
      try { await conn.close(); } catch {}
      try { await closePool(); } catch {}
      response.status = 'degraded';
      response.error = opErr.message;
      return res.status(200).json(response);
    }
  } catch (err) {
    response.status = 'unhealthy';
    response.error = err.message;
    return res.status(500).json(response);
  }
}

