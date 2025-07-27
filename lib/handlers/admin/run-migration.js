import { applyCors } from '../../cors.js';
import { withTransaction } from '../../db.js';

export default async function handler(req, res) {
  applyCors(req, res);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { migrationName, dryRun = false } = req.body;
  
  if (!migrationName) {
    return res.status(400).json({ error: 'Migration name is required' });
  }

  try {
    const result = await withTransaction(async (client) => {
      // Check if migration already exists
      const existingResult = await client.query(
        'SELECT id, applied_at FROM migration.schema_versions WHERE version = $1',
        [migrationName]
      );
      
      if (existingResult.rows.length > 0) {
        return {
          success: false,
          message: `Migration ${migrationName} already applied at ${existingResult.rows[0].applied_at}`
        };
      }
      
      if (!dryRun) {
        // Record migration as applied
        await client.query(
          'INSERT INTO migration.schema_versions (version, applied_at) VALUES ($1, NOW())',
          [migrationName]
        );
      }
      
      return {
        success: true,
        message: dryRun ? `Migration ${migrationName} would be applied` : `Migration ${migrationName} applied successfully`,
        dryRun
      };
    });
    
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('Migration error:', error);
    return res.status(500).json({
      error: 'Migration failed',
      message: error.message
    });
  }
}
