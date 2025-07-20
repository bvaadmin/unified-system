#!/usr/bin/env node

/**
 * Import REAL Bay View cottage data via API
 * Task 35: Import 536 properties with leaseholder data
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function importViaAPI() {
  console.log('🏘️  Bay View REAL Cottage Import (via API)');
  console.log('==========================================\n');
  
  try {
    // Read the processed JSON files
    const blockLotPath = path.join(__dirname, '../bayview-real-cottage-data/block-lot-data.json');
    const leasholdPath = path.join(__dirname, '../bayview-real-cottage-data/leashold-data.json');
    
    const blockLotData = JSON.parse(fs.readFileSync(blockLotPath, 'utf8'));
    const leasholdData = JSON.parse(fs.readFileSync(leasholdPath, 'utf8'));
    
    console.log(`📊 Found ${blockLotData.length} block-lot records`);
    console.log(`📊 Found ${leasholdData.length} leaseholder records\n`);
    
    const apiUrl = process.env.VERCEL_URL || 'https://unified-system.vercel.app';
    console.log(`🌐 Sending to API: ${apiUrl}/api/admin/import-cottages`);
    
    const response = await fetch(`${apiUrl}/api/admin/import-cottages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_TOKEN}`
      },
      body: JSON.stringify({
        blockLotData,
        leasholdData
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error (${response.status}): ${error}`);
    }
    
    const result = await response.json();
    
    console.log(`\n✅ Import complete:`);
    console.log(`   - ${result.imported} cottages imported`);
    console.log(`   - ${result.skipped} skipped`);
    console.log(`   - ${result.errors} errors`);
    
    if (result.errorDetails && result.errorDetails.length > 0) {
      console.log(`\n❌ First few errors:`);
      result.errorDetails.forEach(err => {
        console.log(`   - ${err.cottageId}: ${err.error}`);
      });
    }
    
    if (result.stats) {
      console.log(`\n📊 Database statistics:`);
      console.log(`   - Total properties: ${result.stats.total_properties}`);
      console.log(`   - Total leaseholders: ${result.stats.total_leaseholders}`);
      console.log(`   - Unique block-lots: ${result.stats.unique_block_lots}`);
    }
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    process.exit(1);
  }
}

importViaAPI();