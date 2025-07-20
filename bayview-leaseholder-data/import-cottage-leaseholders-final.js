#!/usr/bin/env node

/**
 * Import cottage leaseholders - Final version
 * Matches actual Bay View database schema
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
    
    // Begin transaction
    await pgClient.query('BEGIN');
    
    let imported = 0;
    let errors = 0;
    const errorDetails = [];
    
    for (const leaseholder of leaseholders) {
      try {
        // Check if property location exists
        const locationCheck = await pgClient.query(`
          SELECT id FROM property.locations 
          WHERE block_number = $1 AND lot_number = $2
        `, [leaseholder.block, leaseholder.lot]);
        
        let propertyId;
        
        if (locationCheck.rows.length === 0) {
          // Create property location if it doesn't exist
          const locationResult = await pgClient.query(`
            INSERT INTO property.locations (
              block_number, lot_number, property_type,
              street_address, lease_status,
              created_at, updated_at
            ) VALUES ($1, $2, 'cottage', $3, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id
          `, [
            leaseholder.block,
            leaseholder.lot,
            leaseholder.mailing_address?.street || `Block ${leaseholder.block} Lot ${leaseholder.lot}`
          ]);
          
          propertyId = locationResult.rows[0].id;
          console.log(`  ✅ Created property location: Block ${leaseholder.block} Lot ${leaseholder.lot}`);
        } else {
          propertyId = locationCheck.rows[0].id;
        }
        
        // Parse name
        const names = leaseholder.leaseholder_name.split(' ');
        const firstName = names[0];
        const lastName = names.slice(1).join(' ');
        
        // Create or find person
        const personCheck = await pgClient.query(`
          SELECT id FROM core.persons 
          WHERE first_name = $1 AND last_name = $2 
          AND (primary_email = $3 OR primary_email IS NULL)
        `, [firstName, lastName, leaseholder.email]);
        
        let personId;
        
        if (personCheck.rows.length === 0) {
          const personResult = await pgClient.query(`
            INSERT INTO core.persons (
              first_name, last_name, primary_email, primary_phone,
              person_type, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, 'member', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id
          `, [firstName, lastName, leaseholder.email, leaseholder.phone]);
          
          personId = personResult.rows[0].id;
          
          // Phone is already stored in primary_phone, no need for contact_methods
        } else {
          personId = personCheck.rows[0].id;
        }
        
        // Create leasehold record
        const leaseholdCheck = await pgClient.query(`
          SELECT id FROM property.leaseholds 
          WHERE property_id = $1 AND person_id = $2
        `, [propertyId, personId]);
        
        if (leaseholdCheck.rows.length === 0) {
          await pgClient.query(`
            INSERT INTO property.leaseholds (
              property_id, person_id, lease_type,
              is_primary_leaseholder, lease_start_date,
              voting_rights, status,
              created_at, updated_at
            ) VALUES ($1, $2, 'perpetual_leasehold', true, $3, $4, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `, [
            propertyId,
            personId,
            new Date(leaseholder.lease_start_year, 0, 1),
            leaseholder.voting_rights
          ]);
          
          console.log(`  ✅ Created leasehold for ${leaseholder.leaseholder_name} at Block ${leaseholder.block} Lot ${leaseholder.lot}`);
        }
        
        // Create member record if active
        if (leaseholder.member_status === 'active') {
          const memberCheck = await pgClient.query(`
            SELECT id FROM core.members WHERE person_id = $1
          `, [personId]);
          
          if (memberCheck.rows.length === 0) {
            // Generate a member number based on year and sequence
            const memberNumber = `L${leaseholder.lease_start_year}-${String(imported + 1).padStart(4, '0')}`;
            
            await pgClient.query(`
              INSERT INTO core.members (
                person_id, member_number, membership_type, status,
                membership_start_date, voting_eligible, cottage_privileges,
                created_at, updated_at
              ) VALUES ($1, $2, 'leaseholder', 'active', $3, $4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [personId, memberNumber, new Date(leaseholder.lease_start_year, 0, 1), leaseholder.voting_rights]);
          }
        }
        
        imported++;
        
      } catch (error) {
        console.error(`  ❌ Error importing ${leaseholder.cottage_id}:`, error.message);
        errorDetails.push({ cottage: leaseholder.cottage_id, error: error.message });
        errors++;
      }
    }
    
    await pgClient.query('COMMIT');
    console.log('\n✅ Transaction committed');
    
    // Summary
    console.log(`\n📊 Import Summary:`);
    console.log(`  ✅ Imported: ${imported}`);
    console.log(`  ❌ Errors: ${errors}`);
    
    if (errorDetails.length > 0 && errorDetails.length <= 5) {
      console.log('\n❌ Error details:');
      errorDetails.forEach(e => console.log(`  - ${e.cottage}: ${e.error}`));
    }
    
    // Verify results
    const verifyResult = await pgClient.query(`
      SELECT 
        COUNT(DISTINCT l.id) as total_leaseholds,
        COUNT(DISTINCT l.property_id) as unique_properties,
        COUNT(DISTINCT l.person_id) as unique_persons,
        COUNT(DISTINCT CASE WHEN l.voting_rights THEN l.id END) as voting_leaseholders,
        COUNT(DISTINCT m.id) as active_members
      FROM property.leaseholds l
      LEFT JOIN core.members m ON l.person_id = m.person_id
      WHERE l.created_at >= CURRENT_DATE
    `);
    
    console.log('\n🏘️  Today\'s import totals:');
    console.table(verifyResult.rows[0]);
    
    // Sample data
    const sampleResult = await pgClient.query(`
      SELECT 
        loc.block_number, loc.lot_number,
        p.first_name || ' ' || p.last_name as leaseholder_name,
        l.voting_rights, l.lease_start_date,
        CASE WHEN m.id IS NOT NULL THEN 'Yes' ELSE 'No' END as is_member
      FROM property.leaseholds l
      JOIN property.locations loc ON l.property_id = loc.id
      JOIN core.persons p ON l.person_id = p.person_id
      LEFT JOIN core.members m ON p.id = m.person_id
      WHERE l.created_at >= CURRENT_DATE
      ORDER BY loc.block_number, loc.lot_number
      LIMIT 10
    `);
    
    console.log('\n📋 Sample imported records:');
    console.table(sampleResult.rows);
    
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