import { applyCors } from '../../lib/cors.js';
import { withTransaction } from '../../lib/db.js';

export const config = {
  maxDuration: 60, // 60 seconds timeout for import
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
    const { blockLotData, leasholdData } = req.body;
    
    if (!blockLotData || !leasholdData) {
      return res.status(400).json({ 
        error: 'Missing required data',
        required: ['blockLotData', 'leasholdData']
      });
    }
    
    console.log(`📊 Received ${blockLotData.length} block-lot records`);
    console.log(`📊 Received ${leasholdData.length} leaseholder records`);
    
    // Create a map of leaseholder addresses by name
    const addressMap = new Map();
    leasholdData.forEach(record => {
      const key = `${record['Last name']}_${record['First name']}`.toLowerCase();
      addressMap.set(key, {
        street: record['Address line 1'],
        street2: record['Address line 2'],
        city: record['City'],
        state: record['State/province'],
        zip: record['ZIP/Postcode']
      });
    });
    
    const result = await withTransaction(async (client) => {
      let imported = 0;
      let skipped = 0;
      let errors = 0;
      const errorDetails = [];
      
      // Check existing data
      const existingCount = await client.query(`
        SELECT COUNT(*) as count 
        FROM property.locations 
        WHERE property_type = 'cottage'
      `);
      console.log(`Found ${existingCount.rows[0].count} existing cottages`);
      
      // Process each cottage
      for (const record of blockLotData) {
        try {
          // Parse block and lot from Client ID (e.g., "1-10")
          const [block, lot] = record['Client ID'].split('-').map(n => parseInt(n));
          const cottageId = `${block}-${lot}`;
          
          // Skip if invalid data
          if (isNaN(block) || isNaN(lot)) {
            console.log(`Skipping invalid ID: ${record['Client ID']}`);
            skipped++;
            continue;
          }
          
          // Get address info
          const nameKey = `${record['Payer last name']}_${record['Payer first name']}`.toLowerCase();
          const address = addressMap.get(nameKey) || {};
          
          // Create address string
          let streetAddress = address.street || `${block}-${lot} Bay View`;
          if (address.street2) {
            streetAddress += `, ${address.street2}`;
          }
          
          // 1. Check if property already exists
          const existing = await client.query(`
            SELECT id FROM property.locations 
            WHERE block_number = $1 AND lot_number = $2
          `, [block, lot]);
          
          let propertyId;
          if (existing.rows.length > 0) {
            propertyId = existing.rows[0].id;
            // Update with real data
            await client.query(`
              UPDATE property.locations 
              SET street_address = $1, updated_at = CURRENT_TIMESTAMP
              WHERE id = $2
            `, [streetAddress, propertyId]);
          } else {
            // Insert new property
            const locationResult = await client.query(`
              INSERT INTO property.locations (
                block_number, lot_number, property_type,
                street_address, lease_status
              ) VALUES ($1, $2, 'cottage', $3, 'active')
              RETURNING id
            `, [block, lot, streetAddress]);
            propertyId = locationResult.rows[0].id;
          }
          
          // 2. Create person record for leaseholder
          const firstName = record['Payer first name'];
          const lastName = record['Payer last name'];
          
          // Check if person exists
          let personId;
          const existingPerson = await client.query(`
            SELECT id FROM core.persons 
            WHERE first_name = $1 AND last_name = $2
          `, [firstName, lastName]);
          
          if (existingPerson.rows.length > 0) {
            personId = existingPerson.rows[0].id;
            // Update address if we have it
            if (address.street) {
              await client.query(`
                UPDATE core.persons 
                SET mailing_address = jsonb_build_object(
                  'street', $1,
                  'street2', $2,
                  'city', $3,
                  'state', $4,
                  'postal_code', $5,
                  'country', 'USA'
                ),
                updated_at = CURRENT_TIMESTAMP
                WHERE id = $6
              `, [
                address.street,
                address.street2 || null,
                address.city,
                address.state,
                address.zip,
                personId
              ]);
            }
          } else {
            const personResult = await client.query(`
              INSERT INTO core.persons (
                first_name, last_name, person_type,
                mailing_address
              ) VALUES ($1, $2, 'member', $3)
              RETURNING id
            `, [
              firstName, 
              lastName,
              address.street ? {
                street: address.street,
                street2: address.street2 || null,
                city: address.city,
                state: address.state,
                postal_code: address.zip,
                country: 'USA'
              } : null
            ]);
            personId = personResult.rows[0].id;
          }
          
          // 3. Create leasehold relationship
          await client.query(`
            INSERT INTO property.leaseholds (
              property_id, person_id, lease_type,
              is_primary_leaseholder, status
            ) VALUES ($1, $2, 'perpetual_leasehold', true, 'active')
            ON CONFLICT (property_id, person_id) DO NOTHING
          `, [propertyId, personId]);
          
          imported++;
          
        } catch (error) {
          console.error(`Error with ${record['Client ID']}: ${error.message}`);
          errors++;
          errorDetails.push({
            cottageId: record['Client ID'],
            error: error.message
          });
        }
      }
      
      // Get final statistics
      const stats = await client.query(`
        SELECT 
          COUNT(DISTINCT p.id) as total_properties,
          COUNT(DISTINCT l.person_id) as total_leaseholders,
          COUNT(DISTINCT p.block_number || '-' || p.lot_number) as unique_block_lots
        FROM property.locations p
        LEFT JOIN property.leaseholds l ON l.property_id = p.id
        WHERE p.property_type = 'cottage'
      `);
      
      return {
        imported,
        skipped,
        errors,
        errorDetails: errorDetails.slice(0, 10), // Return first 10 errors
        stats: stats.rows[0]
      };
    });
    
    return res.status(200).json({
      success: true,
      message: `Import complete: ${result.imported} cottages imported, ${result.errors} errors`,
      ...result
    });
    
  } catch (error) {
    console.error('Import failed:', error);
    return res.status(500).json({ 
      error: 'Import failed',
      message: error.message 
    });
  }
}