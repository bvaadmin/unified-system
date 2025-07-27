import { applyCors } from '../../cors.js';
import { withTransaction } from '../../db.js';

export default async function handler(req, res) {
  applyCors(req, res);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { cottages } = req.body;
  
  if (!cottages || !Array.isArray(cottages)) {
    return res.status(400).json({ error: 'Cottages array is required' });
  }

  try {
    const result = await withTransaction(async (client) => {
      const imported = [];
      const errors = [];
      
      for (const cottage of cottages) {
        try {
          // Validate required fields
          if (!cottage.block || !cottage.lot) {
            errors.push({ cottage, error: 'Missing block or lot' });
            continue;
          }
          
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
            cottage.block,
            cottage.lot,
            cottage.street_address || null,
            cottage.leaseholder_name || null,
            cottage.historical_notes || null,
            cottage.architectural_style || null,
            cottage.year_built ? parseInt(cottage.year_built) : null
          ]);
          
          imported.push({
            id: cottageResult.rows[0].id,
            block: cottage.block,
            lot: cottage.lot,
            address: cottage.street_address
          });
          
        } catch (error) {
          errors.push({ cottage, error: error.message });
        }
      }
      
      return {
        success: true,
        imported: imported.length,
        errors: errors.length,
        details: { imported, errors }
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
