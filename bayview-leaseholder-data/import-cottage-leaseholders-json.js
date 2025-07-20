#!/usr/bin/env node

/**
 * Import cottage leaseholders from JSON data
 * Simplified version for testing with anonymized data
 */

import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const DATABASE_URL = process.env.DATABASE_URL;

async function importLeaseholders() {
  const connectionString = DATABASE_URL?.replace('?sslmode=require', '');
  const pgClient = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await pgClient.connect();
    console.log('✅ Connected to database');
    
    // Read test data
    const dataPath = path.join(__dirname, 'test-data', 'leaseholders-anonymized.json');
    const leaseholders = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    console.log(`📊 Loading ${leaseholders.length} leaseholder records`);
    
    // Check schemas
    const schemaCheck = await pgClient.query(`
      SELECT schema_name FROM information_schema.schemata 
      WHERE schema_name IN ('property', 'core') 
      ORDER BY schema_name
    `);
    
    console.log('📋 Available schemas:', schemaCheck.rows.map(r => r.schema_name).join(', '));
    
    // Begin transaction
    await pgClient.query('BEGIN');
    
    let imported = 0;
    let errors = 0;
    
    for (const leaseholder of leaseholders) {
      try {
        // Insert cottage
        const cottageResult = await pgClient.query(`
          INSERT INTO property.cottages (
            block_number, lot_number,
            cottage_name, street_address,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT (block_number, lot_number) 
          DO UPDATE SET updated_at = CURRENT_TIMESTAMP
          RETURNING cottage_id
        `, [
          leaseholder.block,
          leaseholder.lot,
          `Block ${leaseholder.block} Lot ${leaseholder.lot}`,
          leaseholder.mailing_address?.street || null
        ]);
        
        const cottageId = cottageResult.rows[0].cottage_id;
        
        // Parse name
        const names = leaseholder.leaseholder_name.split(' ');
        const firstName = names[0];
        const lastName = names.slice(1).join(' ');
        
        // Insert person
        const personResult = await pgClient.query(`
          INSERT INTO core.persons (
            first_name, last_name, email, phone,
            person_type, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, 'leaseholder', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT (first_name, last_name) WHERE email IS NOT DISTINCT FROM $3
          DO UPDATE SET updated_at = CURRENT_TIMESTAMP
          RETURNING person_id
        `, [firstName, lastName, leaseholder.email, leaseholder.phone]);
        
        const personId = personResult.rows[0].person_id;
        
        // Insert leaseholder record
        await pgClient.query(`
          INSERT INTO property.leaseholders (
            person_id, cottage_id,
            mailing_address_line1, mailing_city,
            mailing_state, mailing_postal_code,
            is_primary, lease_start_date,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, true, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT (person_id, cottage_id) DO NOTHING
        `, [
          personId, cottageId,
          leaseholder.mailing_address?.street || null,
          leaseholder.mailing_address?.city || null,
          leaseholder.mailing_address?.state || null,
          leaseholder.mailing_address?.zip || null,
          new Date(leaseholder.lease_start_year, 0, 1)
        ]);
        
        // Link to member if active
        if (leaseholder.member_status === 'active') {
          await pgClient.query(`
            INSERT INTO core.members (
              person_id, membership_type, membership_status,
              join_date, has_voting_rights,
              created_at, updated_at
            ) VALUES ($1, 'leaseholder', 'active', $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (person_id) DO UPDATE SET
              has_voting_rights = EXCLUDED.has_voting_rights,
              updated_at = CURRENT_TIMESTAMP
          `, [personId, new Date(leaseholder.lease_start_year, 0, 1), leaseholder.voting_rights]);
        }
        
        imported++;
        
      } catch (error) {
        console.error(`❌ Error importing ${leaseholder.cottage_id}:`, error.message);
        errors++;
      }
    }
    
    await pgClient.query('COMMIT');
    console.log('✅ Transaction committed');
    
    // Summary
    console.log(`\n📊 Import Summary:`);
    console.log(`✅ Imported: ${imported}`);
    console.log(`❌ Errors: ${errors}`);
    
    // Verify
    const countResult = await pgClient.query(`
      SELECT 
        COUNT(DISTINCT c.cottage_id) as cottages,
        COUNT(DISTINCT p.person_id) as persons,
        COUNT(DISTINCT l.leaseholder_id) as leaseholders,
        COUNT(DISTINCT m.member_id) as members
      FROM property.cottages c
      LEFT JOIN property.leaseholders l ON c.cottage_id = l.cottage_id
      LEFT JOIN core.persons p ON l.person_id = p.person_id
      LEFT JOIN core.members m ON p.person_id = m.person_id
    `);
    
    console.log('\n🏘️  Database totals:');
    console.table(countResult.rows[0]);
    
  } catch (error) {
    await pgClient.query('ROLLBACK');
    console.error('❌ Import failed:', error.message);
    throw error;
  } finally {
    await pgClient.end();
  }
}

// Run import
importLeaseholders().catch(console.error);