import { applyCors } from '../../cors.js';
import { createPgClient } from '../../db.js';

export default async function handler(req, res) {
  applyCors(req, res);
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const client = createPgClient();
    await client.connect();
    
    // Check for required schemas
    const schemaResult = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name IN ('bayview', 'crouse_chapel', 'core', 'config')
      ORDER BY schema_name
    `);
    
    const schemas = schemaResult.rows.map(r => r.schema_name);
    
    // Check for required tables in each schema
    const tableChecks = {};
    
    if (schemas.includes('bayview')) {
      const bayviewTables = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'bayview'
        ORDER BY table_name
      `);
      tableChecks.bayview = bayviewTables.rows.map(r => r.table_name);
    }
    
    if (schemas.includes('crouse_chapel')) {
      const chapelTables = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'crouse_chapel'
        ORDER BY table_name
      `);
      tableChecks.crouse_chapel = chapelTables.rows.map(r => r.table_name);
    }
    
    if (schemas.includes('core')) {
      const coreTables = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'core'
        ORDER BY table_name
      `);
      tableChecks.core = coreTables.rows.map(r => r.table_name);
    }
    
    if (schemas.includes('config')) {
      const configTables = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'config'
        ORDER BY table_name
      `);
      tableChecks.config = configTables.rows.map(r => r.table_name);
    }
    
    await client.end();
    
    return res.status(200).json({
      success: true,
      schemas: schemas,
      tables: tableChecks,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Schema check error:', error);
    return res.status(500).json({
      error: 'Schema check failed',
      message: error.message
    });
  }
}
