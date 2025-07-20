#!/usr/bin/env node

/**
 * Import REAL Bay View cottage data from Excel files
 * Task 35: Import 536 properties with leaseholder data
 */

import { withTransaction } from '../lib/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function importRealCottages() {
  console.log('🏘️  Bay View REAL Cottage Import');
  console.log('================================\n');
  
  try {
    // Read the processed JSON files
    const blockLotPath = path.join(__dirname, '../bayview-real-cottage-data/block-lot-data.json');
    const leasholdPath = path.join(__dirname, '../bayview-real-cottage-data/leashold-data.json');
    
    const blockLotData = JSON.parse(fs.readFileSync(blockLotPath, 'utf8'));
    const leasholdData = JSON.parse(fs.readFileSync(leasholdPath, 'utf8'));
    
    console.log(`📊 Found ${blockLotData.length} block-lot records`);
    console.log(`📊 Found ${leasholdData.length} leaseholder records\n`);
    
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
      
      // First, check existing data
      console.log('🧹 Checking existing data...');
      const existingCount = await client.query(`
        SELECT COUNT(*) as count 
        FROM property.locations 
        WHERE property_type = 'cottage'
      `);
      console.log(`   Found ${existingCount.rows[0].count} existing cottages`);
      
      console.log('📥 Importing real cottage data...\n');
      
      for (const record of blockLotData) {
        try {
          // Parse block and lot from Client ID (e.g., "1-10")
          const [block, lot] = record['Client ID'].split('-').map(n => parseInt(n));
          const cottageId = `${block}-${lot}`;
          
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
          
          // Note: We don't have a separate cottages table
          // The property is identified by the location record itself
          
          // 3. Create person record for leaseholder
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
          
          // 4. Create leasehold relationship
          await client.query(`
            INSERT INTO property.leaseholds (
              property_id, person_id, lease_type,
              is_primary_leaseholder, status
            ) VALUES ($1, $2, 'perpetual_leasehold', true, 'active')
            ON CONFLICT (property_id, person_id) DO NOTHING
          `, [propertyId, personId]);
          
          // Note: primary leaseholder is tracked via the leaseholds table
          
          imported++;
          if (imported % 50 === 0) {
            console.log(`  ✅ Imported ${imported} cottages...`);
          }
          
        } catch (error) {
          console.error(`  ❌ Error with ${record['Client ID']}: ${error.message}`);
          errors++;
        }
      }
      
      console.log(`\n✅ Import complete:`);
      console.log(`   - ${imported} cottages imported`);
      console.log(`   - ${errors} errors`);
      
      // Verify the import
      const stats = await client.query(`
        SELECT 
          COUNT(DISTINCT p.id) as total_properties,
          COUNT(DISTINCT l.person_id) as total_leaseholders,
          COUNT(DISTINCT p.block_number || '-' || p.lot_number) as unique_block_lots
        FROM property.locations p
        LEFT JOIN property.leaseholds l ON l.property_id = p.id
        WHERE p.property_type = 'cottage'
      `);
      
      console.log(`\n📊 Database statistics:`);
      console.log(`   - Total properties: ${stats.rows[0].total_properties}`);
      console.log(`   - Total leaseholders: ${stats.rows[0].total_leaseholders}`);
      console.log(`   - Unique block-lots: ${stats.rows[0].unique_block_lots}`);
      
      return { imported, errors };
    });
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

importRealCottages();