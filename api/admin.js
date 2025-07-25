import { withPooledTransaction, withPooledConnection } from '../lib/db.js';
import { applyCors } from '../lib/cors.js';

export default async function handler(req, res) {
  try {
    // Apply CORS
    applyCors(req, res);

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Route to appropriate handler
    if (req.url.includes('/db-init')) {
      return await handleDbInit(req, res);
    } else if (req.url.includes('/check-schema')) {
      return await handleCheckSchema(req, res);
    } else if (req.url.includes('/import-cottages')) {
      return await handleImportCottages(req, res);
    } else {
      return res.status(404).json({ error: 'Endpoint not found' });
    }
  } catch (error) {
    console.error('Admin API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

// Database initialization handler
async function handleDbInit(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check for admin token
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.ADMIN_TOKEN;
  
  if (!authHeader || !expectedToken || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const token = authHeader.substring(7);
  if (token !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await withPooledConnection(async (pgClient) => {
      // Initialize database schemas
      await pgClient.query(`
        CREATE SCHEMA IF NOT EXISTS bayview;
        CREATE SCHEMA IF NOT EXISTS crouse_chapel;
        CREATE SCHEMA IF NOT EXISTS bayview_forms;
      `);
      
      return { message: 'Database schemas initialized successfully' };
    });
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Database initialization error:', error);
    return res.status(500).json({ 
      error: 'Database initialization failed',
      message: error.message 
    });
  }
}

// Schema checking handler
async function handleCheckSchema(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await withPooledConnection(async (pgClient) => {
      const schemaQuery = `
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name IN ('bayview', 'crouse_chapel', 'bayview_forms')
        ORDER BY schema_name;
      `;
      
      const schemaResult = await pgClient.query(schemaQuery);
      const schemas = schemaResult.rows.map(row => row.schema_name);
      
      return {
        schemas_found: schemas,
        all_present: schemas.length === 3
      };
    });
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Schema check error:', error);
    return res.status(500).json({ 
      error: 'Schema check failed',
      message: error.message 
    });
  }
}

// Cottage import handler
async function handleImportCottages(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { cottages } = req.body;
  if (!cottages || !Array.isArray(cottages)) {
    return res.status(400).json({ error: 'Invalid cottage data' });
  }

  try {
    const result = await withPooledTransaction(async (pgClient) => {
      let imported = 0;
      let errors = [];
      
      for (const cottage of cottages) {
        try {
          await pgClient.query(
            `INSERT INTO property.locations (cottage_id, block, lot, address)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (cottage_id) DO UPDATE SET
             block = EXCLUDED.block,
             lot = EXCLUDED.lot,
             address = EXCLUDED.address`,
            [cottage.cottage_id, cottage.block, cottage.lot, cottage.address]
          );
          imported++;
        } catch (cottageError) {
          errors.push({
            cottage_id: cottage.cottage_id,
            error: cottageError.message
          });
        }
      }
      
      return {
        total_processed: cottages.length,
        imported,
        errors: errors.length,
        error_details: errors.slice(0, 10) // Limit error details
      };
    });
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Cottage import error:', error);
    return res.status(500).json({ 
      error: 'Cottage import failed',
      message: error.message 
    });
  }
}
