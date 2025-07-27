import { applyCors } from '../../cors.js';
import { withTransaction } from '../../db.js';

export default async function handler(req, res) {
  applyCors(req, res);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { csvData, dryRun = false } = req.body;
  
  if (!csvData || !Array.isArray(csvData)) {
    return res.status(400).json({ error: 'CSV data is required as an array' });
  }

  try {
    const result = await withTransaction(async (client) => {
      const imported = [];
      const errors = [];
      
      for (const row of csvData) {
        try {
          // Validate required fields
          if (!row.block || !row.lot) {
            errors.push({ row, error: 'Missing block or lot' });
            continue;
          }
          
          if (!dryRun) {
            // Insert cottage
            const cottageResult = await client.query(`
              INSERT INTO property.cottages (
                block, lot, street_address, leaseholder_name,
                historical_notes, architectural_style, year_built
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (block, lot) DO UPDATE SET
                street_address = EXCLUDED.street_address,
                leaseholder_name = EXCLUDED.leaseholder_name,
                historical_notes = EXCLUDED.historical_notes,
                architectural_style = EXCLUDED.architectural_style,
                year_built = EXCLUDED.year_built
              RETURNING id
            `, [
              row.block,
              row.lot,
              row.street_address || null,
              row.leaseholder_name || null,
              row.historical_notes || null,
              row.architectural_style || null,
              row.year_built ? parseInt(row.year_built) : null
            ]);
            
            imported.push({
              id: cottageResult.rows[0].id,
              block: row.block,
              lot: row.lot,
              address: row.street_address
            });
          } else {
            imported.push({
              block: row.block,
              lot: row.lot,
              address: row.street_address,
              status: 'would import'
            });
          }
          
        } catch (error) {
          errors.push({ row, error: error.message });
        }
      }
      
      return {
        success: true,
        imported: imported.length,
        errors: errors.length,
        details: { imported, errors },
        dryRun
      };
    });
    
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('Cottage import error:', error);
    return res.status(500).json({
      error: 'Import failed',
      message: error.message
    });
  }
}
