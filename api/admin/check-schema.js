import { applyCors } from '../../lib/cors.js';
import { createPgClient } from '../../lib/db.js';

export default async function handler(req, res) {
  await applyCors(req, res);
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check admin token
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const client = await createPgClient();
  
  try {
    await client.connect();
    
    // Check for property schema
    const schemaCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.schemata 
        WHERE schema_name = 'property'
      );
    `);
    
    // Check for cottages table
    const cottageTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'property' 
        AND table_name = 'cottages'
      );
    `);
    
    // Get all tables in property schema
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'property' 
      ORDER BY table_name;
    `);
    
    // If cottages table exists, get its structure
    let cottageColumns = [];
    if (cottageTableCheck.rows[0].exists) {
      const columns = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'property' AND table_name = 'cottages'
        ORDER BY ordinal_position;
      `);
      cottageColumns = columns.rows;
    }
    
    // Count existing cottages
    let cottageCount = 0;
    if (cottageTableCheck.rows[0].exists) {
      const count = await client.query(`
        SELECT COUNT(*) FROM property.cottages
      `);
      cottageCount = count.rows[0].count;
    }
    
    return res.status(200).json({
      success: true,
      propertySchemaExists: schemaCheck.rows[0].exists,
      cottagesTableExists: cottageTableCheck.rows[0].exists,
      tablesInPropertySchema: tables.rows.map(r => r.table_name),
      cottageColumns,
      existingCottageCount: cottageCount
    });
    
  } catch (error) {
    console.error('Error checking schema:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  } finally {
    await client.end();
  }
}