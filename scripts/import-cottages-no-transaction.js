#!/usr/bin/env node

/**
 * Import cottage leaseholders - Without transaction
 * For debugging purposes
 */

import { createPgClient } from '../lib/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function importLeaseholdersNoTransaction() {
  const client = createPgClient();
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Read test data
    const dataPath = path.join(__dirname, '../bayview-leaseholder-data/test-data/leaseholders-anonymized.json');
    const leaseholders = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    console.log(`📊 Loading ${leaseholders.length} leaseholder records`);
    console.log('⚠️  Running without transaction - data may be partially imported\n');
    
    let imported = 0;
    let errors = 0;
    
    // Process all records
    for (let i = 0; i < leaseholders.length; i++) {
      if (i % 50 === 0 && i > 0) {
        console.log(`\n✅ Progress: ${i}/${leaseholders.length} records processed`);
      }
      const leaseholder = leaseholders[i];
      
      try {
        // Only log every 10th record to reduce output
        if (i % 10 === 0) {
          console.log(`\nProcessing ${leaseholder.cottage_id}...`);
        }
        
        // Check if property location exists
        const locationCheck = await client.query(`
          SELECT id FROM property.locations 
          WHERE block_number = $1 AND lot_number = $2
        `, [leaseholder.block, leaseholder.lot]);
        
        let propertyId;
        
        if (locationCheck.rows.length === 0) {
          // Create property location
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
          if (i % 10 === 0) {
            console.log(`  ✅ Created property: Block ${leaseholder.block} Lot ${leaseholder.lot} (ID: ${propertyId})`);
          }
        } else {
          propertyId = locationCheck.rows[0].id;
          if (i % 10 === 0) {
            console.log(`  ℹ️  Property exists: Block ${leaseholder.block} Lot ${leaseholder.lot} (ID: ${propertyId})`);
          }
        }
        
        // Parse name
        const names = leaseholder.leaseholder_name.split(' ');
        const firstName = names[0];
        const lastName = names.slice(1).join(' ');
        
        // Create or find person
        const personCheck = await client.query(`
          SELECT id FROM core.persons 
          WHERE first_name = $1 AND last_name = $2 
          AND (primary_email = $3 OR primary_email IS NULL)
        `, [firstName, lastName, leaseholder.email]);
        
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
          if (i % 10 === 0) {
            console.log(`  ✅ Created person: ${leaseholder.leaseholder_name} (ID: ${personId})`);
          }
        } else {
          personId = personCheck.rows[0].id;
          if (i % 10 === 0) {
            console.log(`  ℹ️  Person exists: ${leaseholder.leaseholder_name} (ID: ${personId})`);
          }
        }
        
        // Create leasehold record
        const leaseholdCheck = await client.query(`
          SELECT id FROM property.leaseholds 
          WHERE property_id = $1 AND person_id = $2
        `, [propertyId, personId]);
        
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
          
          if (i % 10 === 0) {
            console.log(`  ✅ Created leasehold`);
          }
        } else {
          if (i % 10 === 0) {
            console.log(`  ℹ️  Leasehold exists`);
          }
        }
        
        // Create member record if active
        if (leaseholder.member_status === 'active') {
          const memberCheck = await client.query(`
            SELECT id FROM core.members WHERE person_id = $1
          `, [personId]);
          
          if (memberCheck.rows.length === 0) {
            const memberNumber = `L${leaseholder.lease_start_year}-${String(imported + 1).padStart(4, '0')}`;
            
            await client.query(`
              INSERT INTO core.members (
                person_id, member_number, membership_type, status,
                membership_start_date, voting_eligible, cottage_privileges
              ) VALUES ($1, $2, 'leaseholder', 'active', $3, $4, true)
            `, [personId, memberNumber, new Date(leaseholder.lease_start_year, 0, 1), leaseholder.voting_rights]);
            
            if (i % 10 === 0) {
              console.log(`  ✅ Created member record`);
            }
          } else {
            if (i % 10 === 0) {
              console.log(`  ℹ️  Member record exists`);
            }
          }
        }
        
        imported++;
        if (i % 10 === 0) {
          console.log(`  ✅ Import complete for ${leaseholder.cottage_id}`);
        }
        
      } catch (error) {
        console.error(`  ❌ Error: ${error.message}`);
        errors++;
      }
    }
    
    console.log(`\n📊 Import Summary (all ${leaseholders.length} records):`);
    console.log(`  ✅ Imported: ${imported}`);
    console.log(`  ❌ Errors: ${errors}`);
    
    // Verify results
    const verifyResult = await client.query(`
      SELECT 
        COUNT(DISTINCT l.id) as total_leaseholds,
        COUNT(DISTINCT l.property_id) as unique_properties,
        COUNT(DISTINCT l.person_id) as unique_persons,
        COUNT(DISTINCT CASE WHEN l.voting_rights THEN l.id END) as voting_leaseholders,
        COUNT(DISTINCT m.id) as active_members
      FROM property.leaseholds l
      LEFT JOIN core.members m ON l.person_id = m.person_id
      WHERE l.created_at >= CURRENT_DATE - INTERVAL '5 minutes'
    `);
    
    console.log('\n🏘️  Today\'s import totals:');
    console.table(verifyResult.rows[0]);
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
  }
}

// Run import
importLeaseholdersNoTransaction().catch(console.error);