// api/test-db.js
// Simple test endpoint to debug PostgreSQL connection

import { Client } from 'pg';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const DATABASE_URL = process.env.DATABASE_URL_CLEAN || process.env.DATABASE_URL;
  
  const result = {
    hasDatabaseUrl: !!DATABASE_URL,
    databaseUrlLength: DATABASE_URL ? DATABASE_URL.length : 0,
    databaseUrlStart: DATABASE_URL ? DATABASE_URL.substring(0, 30) + '...' : 'undefined',
    testResults: []
  };

  if (!DATABASE_URL) {
    return res.status(200).json(result);
  }

  const cleanUrl = DATABASE_URL.replace('?sslmode=require', '');
  
  try {
    const client = new Client({
      connectionString: cleanUrl,
      ssl: {
        rejectUnauthorized: false
      }
    });

    result.testResults.push('Client created successfully');
    
    await client.connect();
    result.testResults.push('Connection successful');
    
    const queryResult = await client.query('SELECT NOW() as current_time');
    result.testResults.push('Query successful: ' + queryResult.rows[0].current_time);
    
    const schemaResult = await client.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'bayview'");
    result.testResults.push('Schema exists: ' + (schemaResult.rows.length > 0));
    
    if (schemaResult.rows.length > 0) {
      const tableResult = await client.query("SELECT COUNT(*) FROM bayview.memorials");
      result.testResults.push('Records in memorials table: ' + tableResult.rows[0].count);
    }
    
    await client.end();
    result.testResults.push('Connection closed');
    
  } catch (error) {
    result.testResults.push('Error: ' + error.message);
    result.testResults.push('Stack: ' + error.stack);
  }

  return res.status(200).json(result);
}