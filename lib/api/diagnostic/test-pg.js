// Test PostgreSQL connection and basic operations
import { Client } from 'pg';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const DATABASE_URL = process.env.DATABASE_URL;
  const result = {
    timestamp: new Date().toISOString(),
    hasUrl: !!DATABASE_URL,
    urlPreview: DATABASE_URL ? DATABASE_URL.replace(/:[^:@]+@/, ':****@').substring(0, 60) + '...' : 'not set',
    connection: false,
    tableExists: false,
    canInsert: false,
    error: null
  };

  if (!DATABASE_URL) {
    result.error = 'DATABASE_URL not configured';
    return res.status(500).json(result);
  }

  const pgClient = new Client({
    connectionString: DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Test connection
    console.log('Testing connection...');
    await pgClient.connect();
    result.connection = true;
    console.log('Connected successfully');

    // Test if table exists
    console.log('Checking if bayview.memorials exists...');
    const tableCheck = await pgClient.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'bayview' 
        AND table_name = 'memorials'
      )
    `);
    result.tableExists = tableCheck.rows[0].exists;
    console.log('Table exists:', result.tableExists);

    if (result.tableExists) {
      // Test insert with minimal data
      console.log('Testing INSERT...');
      const testInsert = await pgClient.query(`
        INSERT INTO bayview.memorials (
          submission_id, first_name, last_name, application_type,
          is_member, contact_name, contact_email, fee_amount
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [
        'PGTEST-' + Date.now(),
        'PG', 'Test', 'immediate',
        true, 'Test Contact', 'pgtest@test.com', 0
      ]);
      
      const insertedId = testInsert.rows[0].id;
      result.canInsert = true;
      result.insertedId = insertedId;
      console.log('Insert successful, ID:', insertedId);

      // Clean up test data
      await pgClient.query('DELETE FROM bayview.memorials WHERE id = $1', [insertedId]);
      console.log('Test data cleaned up');
    }

  } catch (error) {
    console.error('PostgreSQL test error:', error);
    result.error = error.message;
    result.errorCode = error.code;
    result.errorDetail = error.detail;
  } finally {
    try {
      await pgClient.end();
    } catch (e) {
      console.error('Error closing connection:', e);
    }
  }

  const status = result.canInsert ? 200 : 500;
  return res.status(status).json(result);
}