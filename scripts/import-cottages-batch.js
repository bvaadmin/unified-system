#!/usr/bin/env node

/**
 * Import cottage leaseholders - Batch mode
 * Efficient batch processing without logging every record
 */

import { createPgClient } from '../lib/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function importLeaseholdersBatch() {
  const client = createPgClient();
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Read test data
    const dataPath = path.join(__dirname, '../bayview-leaseholder-data/test-data/leaseholders-anonymized.json');
    const leaseholders = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    console.log(`📊 Loading ${leaseholders.length} leaseholder records`);
    console.log('🚀 Running batch import...\n');
    
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    const startTime = Date.now();
    
    for (let i = 0; i < leaseholders.length; i++) {
      const leaseholder = leaseholders[i];
      
      // Progress indicator
      if (i % 25 === 0 && i > 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const rate = (i / elapsed).toFixed(1);
        console.log(`Progress: ${i}/${leaseholders.length} (${Math.round(i/leaseholders.length*100)}%) - ${rate} records/sec`);
      }
      
      try {
        // Check if property location exists
        const locationCheck = await client.query(
          'SELECT id FROM property.locations WHERE block_number = $1 AND lot_number = $2',
          [leaseholder.block, leaseholder.lot]
        );
        
        let propertyId;
        if (locationCheck.rows.length === 0) {
          const locationResult = await client.query(`
            INSERT INTO property.locations (
              block_number, lot_number, property_type,
              street_address, lease_status
            ) VALUES ($1, $2, 'cottage', $3, 'active')
            RETURNING id
          `, [
            leaseholder.block,
            leaseholder.lot,
            leaseholder.mailing_address?.street || `Block ${leaseholder.block} Lot ${leaseholder.lot}`
          ]);
          propertyId = locationResult.rows[0].id;
        } else {
          propertyId = locationCheck.rows[0].id;
        }
        
        // Parse name
        const names = leaseholder.leaseholder_name.split(' ');
        const firstName = names[0];
        const lastName = names.slice(1).join(' ');
        
        // Create or find person
        const personCheck = await client.query(
          'SELECT id FROM core.persons WHERE first_name = $1 AND last_name = $2 AND (primary_email = $3 OR primary_email IS NULL)',
          [firstName, lastName, leaseholder.email]
        );
        
        let personId;
        if (personCheck.rows.length === 0) {
          const personResult = await client.query(`
            INSERT INTO core.persons (
              first_name, last_name, primary_email, primary_phone,
              person_type
            ) VALUES ($1, $2, $3, $4, 'member')
            RETURNING id
          `, [firstName, lastName, leaseholder.email, leaseholder.phone]);
          personId = personResult.rows[0].id;
        } else {
          personId = personCheck.rows[0].id;
        }
        
        // Create leasehold record
        const leaseholdCheck = await client.query(
          'SELECT id FROM property.leaseholds WHERE property_id = $1 AND person_id = $2',
          [propertyId, personId]
        );
        
        if (leaseholdCheck.rows.length === 0) {
          await client.query(`
            INSERT INTO property.leaseholds (
              property_id, person_id, lease_type,
              is_primary_leaseholder, lease_start_date,
              voting_rights, status
            ) VALUES ($1, $2, 'perpetual_leasehold', true, $3, $4, 'active')
          `, [
            propertyId,
            personId,
            new Date(leaseholder.lease_start_year, 0, 1),
            leaseholder.voting_rights
          ]);
        }
        
        // Create member record if active
        if (leaseholder.member_status === 'active') {
          const memberCheck = await client.query(
            'SELECT id FROM core.members WHERE person_id = $1',
            [personId]
          );
          
          if (memberCheck.rows.length === 0) {
            const memberNumber = `L${leaseholder.lease_start_year}-${String(imported + 1).padStart(4, '0')}`;
            
            await client.query(`
              INSERT INTO core.members (
                person_id, member_number, membership_type, status,
                membership_start_date, voting_eligible, cottage_privileges
              ) VALUES ($1, $2, 'leaseholder', 'active', $3, $4, true)
            `, [personId, memberNumber, new Date(leaseholder.lease_start_year, 0, 1), leaseholder.voting_rights]);
          }
        }
        
        imported++;
        
      } catch (error) {
        console.error(`❌ Error with ${leaseholder.cottage_id}: ${error.message}`);
        errors++;
      }
    }
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log(`\n✅ Import completed in ${totalTime} seconds`);
    console.log(`\n📊 Import Summary:`);
    console.log(`  ✅ Processed: ${imported + skipped + errors}`);
    console.log(`  ✅ Imported: ${imported}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  ❌ Errors: ${errors}`);
    
    // Verify final results
    const verifyResult = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM property.locations WHERE property_type = 'cottage') as total_cottages,
        (SELECT COUNT(*) FROM property.leaseholds WHERE status = 'active') as active_leaseholds,
        (SELECT COUNT(*) FROM core.persons WHERE person_type = 'member') as member_persons,
        (SELECT COUNT(*) FROM core.members) as total_members,
        (SELECT COUNT(*) FROM core.members WHERE voting_eligible = true) as voting_members
    `);
    
    console.log('\n🏘️  Final database totals:');
    console.table(verifyResult.rows[0]);
    
    // Sample imported records
    const sampleResult = await client.query(`
      SELECT 
        loc.block_number, loc.lot_number,
        p.first_name || ' ' || p.last_name as leaseholder_name,
        l.voting_rights, l.lease_start_date,
        CASE WHEN m.id IS NOT NULL THEN 'Yes' ELSE 'No' END as is_member
      FROM property.leaseholds l
      JOIN property.locations loc ON l.property_id = loc.id
      JOIN core.persons p ON l.person_id = p.id
      LEFT JOIN core.members m ON p.id = m.person_id
      WHERE l.created_at >= CURRENT_DATE - INTERVAL '1 hour'
      ORDER BY loc.block_number, loc.lot_number
      LIMIT 5
    `);
    
    console.log('\n📋 Sample imported records:');
    console.table(sampleResult.rows);
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
  }
}

// Run import
importLeaseholdersBatch().catch(console.error);