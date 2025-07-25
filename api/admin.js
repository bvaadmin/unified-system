import { applyCors } from '../lib/cors.js';
import { withTransaction, createPgClient } from '../lib/db.js';
import { Client } from 'pg';

export const config = {
  maxDuration: 60, // 60 seconds timeout for imports
};

/**
 * Unified Admin API
 * Handles all admin operations through a single endpoint
 */
export default async function handler(req, res) {
  await applyCors(req, res);
  
  const { action } = req.query;
  
  if (!action) {
    return res.status(400).json({ error: 'Missing action parameter' });
  }

  // Check admin authorization for all actions
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Route to appropriate handler based on action
  switch (action) {
    case 'db-init':
      return handleDbInit(req, res);
    case 'check-schema':
      return handleCheckSchema(req, res);
    case 'import-cottages':
      return handleImportCottages(req, res);
    default:
      return res.status(400).json({ error: `Unknown action: ${action}` });
  }
}

// DATABASE INITIALIZATION
async function handleDbInit(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();

    // Create schema
    await client.query('CREATE SCHEMA IF NOT EXISTS bayview');
    
    // Set search path
    await client.query('SET search_path TO bayview');

    // Create memorials table
    await client.query(`
      CREATE TABLE IF NOT EXISTS memorials (
        id SERIAL PRIMARY KEY,
        submission_id VARCHAR(50) UNIQUE,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        middle_name VARCHAR(100),
        maiden_name VARCHAR(100),
        birth_date DATE,
        death_date DATE,
        birth_place VARCHAR(255),
        home_address TEXT,
        bayview_address TEXT,
        mother_name VARCHAR(200),
        father_name VARCHAR(200),
        message TEXT,
        bayview_history TEXT,
        application_type VARCHAR(100),
        is_member BOOLEAN DEFAULT false,
        member_name VARCHAR(200),
        member_relationship VARCHAR(200),
        contact_name VARCHAR(200),
        contact_email VARCHAR(200),
        contact_phone VARCHAR(50),
        contact_address TEXT,
        service_date DATE,
        celebrant_requested VARCHAR(100),
        fee_amount DECIMAL(10, 2),
        payment_status VARCHAR(50) DEFAULT 'pending',
        notion_id VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_memorials_last_name ON memorials(last_name)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_memorials_first_name ON memorials(first_name)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_memorials_submission_id ON memorials(submission_id)');

    // Create update trigger
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_memorials_updated_at ON memorials
    `);

    await client.query(`
      CREATE TRIGGER update_memorials_updated_at 
      BEFORE UPDATE ON memorials 
      FOR EACH ROW 
      EXECUTE PROCEDURE update_updated_at_column()
    `);

    // Grant permissions
    await client.query('GRANT ALL PRIVILEGES ON SCHEMA bayview TO doadmin');
    await client.query('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA bayview TO doadmin');
    await client.query('GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA bayview TO doadmin');

    // Check if table was created successfully
    const result = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'bayview' 
      AND table_name = 'memorials'
    `);

    return res.status(200).json({
      success: true,
      message: 'Database initialized successfully',
      tableExists: result.rows[0].count > 0
    });

  } catch (error) {
    console.error('Database initialization error:', error);
    return res.status(500).json({
      error: 'Failed to initialize database',
      details: error.message
    });
  } finally {
    await client.end();
  }
}

// SCHEMA CHECK
async function handleCheckSchema(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
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

// COTTAGE IMPORT
async function handleImportCottages(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
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
    
    // Create a map of leaseholder addresses by name (case-insensitive)
    const addressMap = new Map();
    leasholdData.forEach(record => {
      const lastName = (record['Last name'] || '').trim().toLowerCase();
      const firstName = (record['First name'] || '').trim().toLowerCase();
      const key = `${lastName}_${firstName}`;
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
      
      // Check if migration 013 has been applied
      const migrationCheck = await client.query(`
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'property' 
        AND table_name = 'locations' 
        AND column_name = 'cottage_id'
      `);
      
      const hasCottageIdColumn = migrationCheck.rows.length > 0;
      
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
          const cottageId = record['Client ID'];
          
          // Input validation for Client ID
          if (!cottageId || typeof cottageId !== 'string' || !cottageId.trim()) {
            console.log(`Skipping invalid Client ID: ${cottageId}`);
            skipped++;
            continue;
          }
          
          // Validate Client ID format (Block-Lot pattern)
          if (!/^\d+[-]/.test(cottageId.trim())) {
            console.log(`Skipping malformed Client ID: ${cottageId}`);
            skipped++;
            continue;
          }
          
          // Get address info (case-insensitive matching)
          const payerLastName = (record['Payer last name'] || '').trim().toLowerCase();
          const payerFirstName = (record['Payer first name'] || '').trim().toLowerCase();
          const nameKey = `${payerLastName}_${payerFirstName}`;
          const address = addressMap.get(nameKey) || {};
          
          // Create address string
          let streetAddress = address.street || `Cottage ${cottageId}`;
          if (address.street2) {
            streetAddress += `, ${address.street2}`;
          }
          
          let propertyId;
          
          if (hasCottageIdColumn) {
            // Use new schema with cottage_id support
            const parseResult = await client.query(
              `SELECT * FROM property.parse_cottage_id($1)`,
              [cottageId]
            );
            
            const parsed = parseResult.rows[0];
            
            if (!parsed || !parsed.block_num) {
              console.log(`Skipping invalid ID: ${cottageId}`);
              skipped++;
              continue;
            }
            
            // Check if property already exists
            const existing = await client.query(`
              SELECT id FROM property.locations 
              WHERE cottage_id = $1
            `, [cottageId]);
            
            if (existing.rows.length > 0) {
              propertyId = existing.rows[0].id;
              // Update with real data
              await client.query(`
                UPDATE property.locations 
                SET street_address = $1, updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
              `, [streetAddress, propertyId]);
            } else {
              // Insert new property with full cottage ID support
              const locationResult = await client.query(`
                INSERT INTO property.locations (
                  cottage_id, block_number, lot_number, 
                  lot_suffix, lot_fraction,
                  property_type, street_address, lease_status
                ) VALUES ($1, $2, $3, $4, $5, 'cottage', $6, 'active')
                RETURNING id
              `, [
                cottageId,
                parsed.block_num,
                parsed.lot_num || 0, // Default to 0 if no numeric part
                parsed.lot_suffix,
                parsed.lot_fraction,
                streetAddress
              ]);
              propertyId = locationResult.rows[0].id;
            }
          } else {
            // Fallback: Use old schema (only numeric lots)
            const parts = cottageId.split('-');
            const block = parseInt(parts[0]);
            const lotPart = parts[1];
            const lot = parseInt(lotPart);
            
            if (isNaN(block) || isNaN(lot)) {
              console.log(`Skipping non-numeric lot: ${cottageId}`);
              skipped++;
              continue;
            }
            
            // Check if property already exists
            const existing = await client.query(`
              SELECT id FROM property.locations 
              WHERE block_number = $1 AND lot_number = $2
            `, [block, lot]);
            
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
          console.error(`Error with ${record['Client ID']}: ${error.message}`, error.stack);
          errors++;
          errorDetails.push({
            cottageId: record['Client ID'],
            payerName: `${record['Payer first name']} ${record['Payer last name']}`,
            error: error.message,
            errorCode: error.code,
            step: error.step || 'unknown'
          });
        }
      }
      
      // Get final statistics
      const statsQuery = hasCottageIdColumn ? `
        SELECT 
          COUNT(DISTINCT p.id) as total_properties,
          COUNT(DISTINCT l.person_id) as total_leaseholders,
          COUNT(DISTINCT p.cottage_id) as unique_cottages,
          COUNT(DISTINCT CASE WHEN p.lot_suffix IS NOT NULL THEN p.id END) as cottages_with_suffix,
          COUNT(DISTINCT CASE WHEN p.lot_fraction IS NOT NULL THEN p.id END) as cottages_with_fraction
        FROM property.locations p
        LEFT JOIN property.leaseholds l ON l.property_id = p.id
        WHERE p.property_type = 'cottage'
      ` : `
        SELECT 
          COUNT(DISTINCT p.id) as total_properties,
          COUNT(DISTINCT l.person_id) as total_leaseholders,
          COUNT(DISTINCT p.block_number || '-' || p.lot_number) as unique_cottages,
          0 as cottages_with_suffix,
          0 as cottages_with_fraction
        FROM property.locations p
        LEFT JOIN property.leaseholds l ON l.property_id = p.id
        WHERE p.property_type = 'cottage'
      `;
      
      const stats = await client.query(statsQuery);
      
      return {
        imported,
        skipped,
        errors,
        errorDetails: errorDetails,
        totalErrors: errorDetails.length,
        stats: stats.rows[0],
        migrationStatus: hasCottageIdColumn ? 'Migration 013 applied' : 'Migration 013 needed'
      };
    });
    
    return res.status(200).json({
      success: true,
      message: `Import complete: ${result.imported} cottages imported, ${result.skipped} skipped, ${result.errors} errors`,
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