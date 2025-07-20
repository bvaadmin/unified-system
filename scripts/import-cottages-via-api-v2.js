#!/usr/bin/env node

/**
 * Import cottages via API - Version 2 with non-standard cottage ID support
 * Handles cottages like "1-11A", "19-1 1/6", etc.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function importCottagesViaAPI() {
  console.log('🏘️  Bay View Cottage Import via API V2');
  console.log('=====================================\n');
  
  try {
    // Check for admin token
    if (!process.env.ADMIN_TOKEN) {
      throw new Error('ADMIN_TOKEN not found in environment variables');
    }
    
    // Read the processed JSON files
    const blockLotPath = path.join(__dirname, '../bayview-real-cottage-data/block-lot-data.json');
    const leasholdPath = path.join(__dirname, '../bayview-real-cottage-data/leashold-data.json');
    
    if (!fs.existsSync(blockLotPath) || !fs.existsSync(leasholdPath)) {
      throw new Error('Processed JSON files not found. Run process-excel.py first.');
    }
    
    const blockLotData = JSON.parse(fs.readFileSync(blockLotPath, 'utf8'));
    const leasholdData = JSON.parse(fs.readFileSync(leasholdPath, 'utf8'));
    
    console.log(`📊 Loaded ${blockLotData.length} block-lot records`);
    console.log(`📊 Loaded ${leasholdData.length} leaseholder records`);
    
    // Analyze non-standard cottage IDs
    const nonStandardIds = blockLotData.filter(record => {
      const parts = record['Client ID'].split('-');
      if (parts.length !== 2) return true;
      const lotPart = parts[1];
      return isNaN(parseInt(lotPart)) || lotPart !== parseInt(lotPart).toString();
    });
    
    console.log(`\n⚠️  Found ${nonStandardIds.length} non-standard cottage IDs:`);
    if (nonStandardIds.length > 0) {
      console.log('Examples:', nonStandardIds.slice(0, 10).map(r => r['Client ID']).join(', '));
    }
    
    // Determine API endpoint based on environment
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';
    
    const apiUrl = `${baseUrl}/api/admin/import-cottages-v2`;
    
    console.log(`\n🚀 Sending data to: ${apiUrl}`);
    
    // Send to API
    const response = await fetch(apiUrl, {
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
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(`API error: ${result.error || 'Unknown error'}`);
    }
    
    console.log('\n✅ Import Complete!');
    console.log(`  - Imported: ${result.imported}`);
    console.log(`  - Skipped: ${result.skipped}`);
    console.log(`  - Errors: ${result.errors}`);
    console.log(`  - Migration Status: ${result.migrationStatus}`);
    
    if (result.stats) {
      console.log('\n📊 Database Statistics:');
      console.log(`  - Total Properties: ${result.stats.total_properties}`);
      console.log(`  - Total Leaseholders: ${result.stats.total_leaseholders}`);
      console.log(`  - Unique Cottages: ${result.stats.unique_cottages}`);
      console.log(`  - Cottages with Suffix (A, B, etc.): ${result.stats.cottages_with_suffix}`);
      console.log(`  - Cottages with Fraction (1/6, etc.): ${result.stats.cottages_with_fraction}`);
    }
    
    if (result.errorDetails && result.errorDetails.length > 0) {
      console.log('\n❌ Error Details (first 10):');
      result.errorDetails.forEach(err => {
        console.log(`  - ${err.cottageId}: ${err.error}`);
      });
    }
    
    if (result.migrationStatus === 'Migration 013 needed') {
      console.log('\n⚠️  WARNING: Migration 013 has not been applied!');
      console.log('   Non-standard cottage IDs will be skipped.');
      console.log('   Run the migration to import all cottages.');
    }
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    process.exit(1);
  }
}

// Run the import
importCottagesViaAPI().catch(console.error);