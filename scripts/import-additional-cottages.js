#!/usr/bin/env node

/**
 * Import additional cottages to reach Bay View's full inventory of 440+
 * This imports from the 440-cottages test data file
 */

import { createPgClient } from '../lib/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function importAdditionalCottages() {
  const client = createPgClient();
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // First check current state
    const currentState = await client.query(`
      SELECT COUNT(*) as count FROM property.locations WHERE property_type = 'cottage'
    `);
    console.log(`\n📊 Current cottages in database: ${currentState.rows[0].count}`);
    
    // Read the 440 cottages data
    const dataPath = path.join(__dirname, '../bayview-leaseholder-data/test-data/leaseholders-440-cottages.json');
    const allCottages = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    console.log(`📋 Total cottages in new file: ${allCottages.length}`);
    
    // Get existing block/lot combinations to avoid duplicates
    const existing = await client.query(`
      SELECT block_number, lot_number 
      FROM property.locations 
      WHERE property_type = 'cottage'
    `);
    
    const existingSet = new Set(
      existing.rows.map(r => `${r.block_number}-${r.lot_number}`)
    );
    
    // Filter out cottages that already exist
    const newCottages = allCottages.filter(cottage => 
      !existingSet.has(`${cottage.block}-${cottage.lot}`)
    );
    
    console.log(`🆕 New cottages to import: ${newCottages.length}`);
    console.log('🚀 Starting import...\n');
    
    let imported = 0;
    let errors = 0;
    const startTime = Date.now();
    
    for (let i = 0; i < newCottages.length; i++) {
      const leaseholder = newCottages[i];
      
      // Progress indicator
      if (i % 25 === 0 && i > 0) {
        console.log(`Progress: ${i}/${newCottages.length} (${Math.round(i/newCottages.length*100)}%)`);
      }
      
      try {
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
        
        const propertyId = locationResult.rows[0].id;
        
        // Parse name
        const names = leaseholder.leaseholder_name.split(' ');
        const firstName = names[0];
        const lastName = names.slice(1).join(' ');
        
        // Create person
        const personResult = await client.query(`
          INSERT INTO core.persons (
            first_name, last_name, primary_email, primary_phone,
            person_type
          ) VALUES ($1, $2, $3, $4, 'member')
          RETURNING id
        `, [firstName, lastName, leaseholder.email, leaseholder.phone]);
        
        const personId = personResult.rows[0].id;
        
        // Create leasehold
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
        
        // Create member record if active
        if (leaseholder.member_status === 'active') {
          const memberNumber = `L${leaseholder.lease_start_year}-${String(400 + imported).padStart(4, '0')}`;
          
          await client.query(`
            INSERT INTO core.members (
              person_id, member_number, membership_type, status,
              membership_start_date, voting_eligible, cottage_privileges
            ) VALUES ($1, $2, 'leaseholder', 'active', $3, $4, true)
          `, [personId, memberNumber, new Date(leaseholder.lease_start_year, 0, 1), leaseholder.voting_rights]);
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
    console.log(`  ✅ Imported: ${imported}`);
    console.log(`  ❌ Errors: ${errors}`);
    
    // Verify final results
    const finalResult = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM property.locations WHERE property_type = 'cottage') as total_cottages,
        (SELECT COUNT(*) FROM property.leaseholds WHERE status = 'active') as active_leaseholds,
        (SELECT COUNT(*) FROM core.persons WHERE person_type = 'member') as member_persons,
        (SELECT COUNT(*) FROM core.members) as total_members,
        (SELECT COUNT(*) FROM core.members WHERE voting_eligible = true) as voting_members
    `);
    
    console.log('\n🏘️  Final database totals:');
    console.table(finalResult.rows[0]);
    
    console.log(`\n🎯 Target: 440+ cottages`);
    console.log(`✅ Achieved: ${finalResult.rows[0].total_cottages} cottages`);
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
  }
}

// Run import
importAdditionalCottages().catch(console.error);