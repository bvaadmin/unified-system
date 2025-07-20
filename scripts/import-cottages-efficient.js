#!/usr/bin/env node

/**
 * Efficient cottage leaseholder import
 * Optimized for 312 properties with batch processing
 */

import { withTransaction } from '../lib/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function importLeaseholdersEfficient() {
  console.log('🏘️  Bay View Cottage Leaseholder Import (Efficient Version)');
  console.log('=========================================================\n');
  
  try {
    // Read test data
    const dataPath = path.join(__dirname, '../bayview-leaseholder-data/test-data/leaseholders-anonymized.json');
    const leaseholders = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    console.log(`📊 Loading ${leaseholders.length} leaseholder records\n`);
    
    const result = await withTransaction(async (client) => {
      let imported = 0;
      let errors = 0;
      
      // Process in batches of 50
      const batchSize = 50;
      
      for (let i = 0; i < leaseholders.length; i += batchSize) {
        const batch = leaseholders.slice(i, Math.min(i + batchSize, leaseholders.length));
        console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(leaseholders.length/batchSize)} (${batch.length} records)...`);
        
        for (const leaseholder of batch) {
          try {
            // 1. Create property location
            const locationResult = await client.query(`
              INSERT INTO property.locations (
                block_number, lot_number, property_type,
                street_address, lease_status
              ) VALUES ($1, $2, 'cottage', $3, 'active')
              ON CONFLICT (block_number, lot_number) 
              DO UPDATE SET updated_at = CURRENT_TIMESTAMP
              RETURNING id
            `, [
              leaseholder.block,
              leaseholder.lot,
              leaseholder.mailing_address?.street || `Block ${leaseholder.block} Lot ${leaseholder.lot}`
            ]);
            
            const propertyId = locationResult.rows[0].id;
            
            // 2. Parse name and create person
            const names = leaseholder.leaseholder_name.split(' ');
            const firstName = names[0];
            const lastName = names.slice(1).join(' ');
            
            // Check if person exists first
            let personId;
            const existingPerson = await client.query(`
              SELECT id FROM core.persons 
              WHERE first_name = $1 AND last_name = $2 
              AND (primary_email = $3 OR primary_email IS NULL)
            `, [firstName, lastName, leaseholder.email]);
            
            if (existingPerson.rows.length > 0) {
              personId = existingPerson.rows[0].id;
            } else {
              const personResult = await client.query(`
                INSERT INTO core.persons (
                  first_name, last_name, primary_email, primary_phone,
                  person_type
                ) VALUES ($1, $2, $3, $4, 'member')
                RETURNING id
              `, [firstName, lastName, leaseholder.email, leaseholder.phone]);
              personId = personResult.rows[0].id;
            }
            
            // 3. Create leasehold
            await client.query(`
              INSERT INTO property.leaseholds (
                property_id, person_id, lease_type,
                is_primary_leaseholder, lease_start_date,
                voting_rights, status
              ) VALUES ($1, $2, 'perpetual_leasehold', true, $3, $4, 'active')
              ON CONFLICT (property_id, person_id) DO NOTHING
            `, [
              propertyId,
              personId,
              new Date(leaseholder.lease_start_year, 0, 1),
              leaseholder.voting_rights
            ]);
            
            // 4. Create member record if active
            if (leaseholder.member_status === 'active') {
              const memberNumber = `L${leaseholder.lease_start_year}-${String(imported + 1).padStart(4, '0')}`;
              
              await client.query(`
                INSERT INTO core.members (
                  person_id, member_number, membership_type, status,
                  membership_start_date, voting_eligible, cottage_privileges
                ) VALUES ($1, $2, 'leaseholder', 'active', $3, $4, true)
                ON CONFLICT (person_id) DO NOTHING
              `, [
                personId, 
                memberNumber, 
                new Date(leaseholder.lease_start_year, 0, 1), 
                leaseholder.voting_rights
              ]);
            }
            
            imported++;
            
          } catch (error) {
            console.error(`  ❌ Error with ${leaseholder.cottage_id}: ${error.message}`);
            errors++;
          }
        }
        
        console.log(`  ✅ Batch complete: ${imported} imported, ${errors} errors\n`);
      }
      
      return { imported, errors };
    });
    
    // Verify results
    const verifyResult = await withTransaction(async (client) => {
      return await client.query(`
        SELECT 
          (SELECT COUNT(*) FROM property.locations WHERE property_type = 'cottage') as total_cottages,
          (SELECT COUNT(*) FROM property.leaseholds WHERE status = 'active') as active_leaseholds,
          (SELECT COUNT(*) FROM core.persons WHERE person_type = 'member') as member_persons,
          (SELECT COUNT(*) FROM core.members) as total_members,
          (SELECT COUNT(*) FROM core.members WHERE voting_eligible = true) as voting_members
      `);
    });
    
    console.log('📊 Import Summary:');
    console.log(`  ✅ Successfully imported: ${result.imported}`);
    console.log(`  ❌ Errors: ${result.errors}`);
    console.log('\n🏘️  Database totals:');
    console.table(verifyResult.rows[0]);
    
    console.log('\n✅ Import completed successfully!');
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    process.exit(1);
  }
}

// Run import
importLeaseholdersEfficient().catch(console.error);