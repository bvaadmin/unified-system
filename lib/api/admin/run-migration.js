import { applyCors } from '../../lib/cors.js';
import { withTransaction } from '../../lib/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  maxDuration: 30,
};

export default async function handler(req, res) {
  await applyCors(req, res);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check admin token
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { migrationNumber } = req.body;
    
    if (!migrationNumber) {
      return res.status(400).json({ 
        error: 'Missing migration number',
        example: { migrationNumber: 13 }
      });
    }
    
    // Construct migration file path
    const migrationFile = path.join(__dirname, `../../scripts/migrations/${String(migrationNumber).padStart(3, '0')}_*.sql`);
    
    // Find the actual file
    const migrationDir = path.join(__dirname, '../../scripts/migrations');
    const files = fs.readdirSync(migrationDir);
    const targetFile = files.find(f => f.startsWith(String(migrationNumber).padStart(3, '0') + '_'));
    
    if (!targetFile) {
      return res.status(404).json({ 
        error: `Migration ${migrationNumber} not found`,
        availableMigrations: files.filter(f => f.endsWith('.sql')).map(f => f.split('_')[0])
      });
    }
    
    // Read migration SQL
    const migrationPath = path.join(migrationDir, targetFile);
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Check if migration already applied
    const result = await withTransaction(async (client) => {
      const checkResult = await client.query(
        'SELECT * FROM migration.schema_versions WHERE version = $1',
        [migrationNumber]
      );
      
      if (checkResult.rows.length > 0) {
        return {
          alreadyApplied: true,
          appliedAt: checkResult.rows[0].applied_at,
          description: checkResult.rows[0].description
        };
      }
      
      // Execute migration
      console.log(`Executing migration ${migrationNumber}: ${targetFile}`);
      
      // Split by semicolons but preserve semicolons within functions
      const statements = migrationSQL
        .split(/;(?=(?:[^']*'[^']*')*[^']*$)/)
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      for (const statement of statements) {
        if (statement.length > 0) {
          await client.query(statement + ';');
        }
      }
      
      // Verify migration was recorded
      const verifyResult = await client.query(
        'SELECT * FROM migration.schema_versions WHERE version = $1',
        [migrationNumber]
      );
      
      if (verifyResult.rows.length === 0) {
        throw new Error('Migration executed but not recorded in schema_versions');
      }
      
      return {
        success: true,
        migrationNumber,
        fileName: targetFile,
        description: verifyResult.rows[0].description,
        appliedAt: verifyResult.rows[0].applied_at
      };
    });
    
    if (result.alreadyApplied) {
      return res.status(200).json({
        success: true,
        message: 'Migration already applied',
        ...result
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Migration applied successfully',
      ...result
    });
    
  } catch (error) {
    console.error('Migration failed:', error);
    return res.status(500).json({ 
      error: 'Migration failed',
      message: error.message,
      hint: 'Check database logs for detailed error information'
    });
  }
}