#!/usr/bin/env node

/**
 * Secure Cottage Leaseholder Import Script
 * Imports 312 cottage properties into Bay View database
 * with dual-write to legacy systems
 */

import { Client } from 'pg';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const DATABASE_URL = process.env.DATABASE_URL;

// Security check - ensure we're not in production without explicit flag
const isProduction = process.env.NODE_ENV === 'production';
const forceProduction = process.argv.includes('--production');

if (isProduction && !forceProduction) {
  console.error('❌ Production import requires --production flag for safety');
  process.exit(1);
}

class CottageLeaseholderImporter {
  constructor() {
    this.pgClient = null;
    this.importStats = {
      total: 0,
      imported: 0,
      skipped: 0,
      errors: 0
    };
  }

  async connect() {
    this.pgClient = new Client({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : false
    });
    
    await this.pgClient.connect();
    console.log('✅ Connected to database');
  }

  async disconnect() {
    if (this.pgClient) {
      await this.pgClient.end();
      console.log('✅ Disconnected from database');
    }
  }

  async verifySchemas() {
    // Check that required schemas exist
    const schemaCheck = await this.pgClient.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name IN ('property', 'core', 'legacy')
      ORDER BY schema_name
    `);
    
    const schemas = schemaCheck.rows.map(r => r.schema_name);
    console.log('📋 Available schemas:', schemas.join(', '));
    
    if (!schemas.includes('property')) {
      throw new Error('Missing required schema: property');
    }
    
    // Verify cottages table exists
    const tableCheck = await this.pgClient.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'property' 
        AND table_name = 'cottages'
      ) as exists
    `);
    
    if (!tableCheck.rows[0].exists) {
      throw new Error('Missing required table: property.cottages');
    }
    
    console.log('✅ Schema verification passed');
  }

  async importFromExcel(filePath) {
    console.log(`📂 Reading Excel file: ${path.basename(filePath)}`);
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('No worksheet found in Excel file');
    }
    
    console.log(`📊 Found ${worksheet.rowCount - 1} data rows`);
    
    // Begin transaction for safety
    await this.pgClient.query('BEGIN');
    
    try {
      // Process each row
      const rows = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header
        
        const data = {
          block: row.getCell(1).value,
          lot: row.getCell(2).value,
          leaseholder_name: row.getCell(3).value,
          address: row.getCell(4).value,
          city: row.getCell(5).value,
          state: row.getCell(6).value,
          zip: row.getCell(7).value,
          phone: row.getCell(8).value,
          email: row.getCell(9).value
        };
        
        rows.push(data);
      });
      
      // Import in batches for efficiency
      const batchSize = 50;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        await this.importBatch(batch);
        console.log(`⏳ Progress: ${Math.min(i + batchSize, rows.length)}/${rows.length}`);
      }
      
      // Commit transaction
      await this.pgClient.query('COMMIT');
      console.log('✅ Transaction committed successfully');
      
    } catch (error) {
      // Rollback on error
      await this.pgClient.query('ROLLBACK');
      console.error('❌ Transaction rolled back due to error');
      throw error;
    }
  }

  async importBatch(batch) {
    for (const row of batch) {
      try {
        this.importStats.total++;
        
        // Validate required fields
        if (!row.block || !row.lot) {
          console.warn(`⚠️  Skipping row - missing block/lot: ${JSON.stringify(row)}`);
          this.importStats.skipped++;
          continue;
        }
        
        // Insert into property.cottages
        const cottageResult = await this.pgClient.query(`
          INSERT INTO property.cottages (
            block_number, lot_number, 
            cottage_name, street_address,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT (block_number, lot_number) 
          DO UPDATE SET
            cottage_name = EXCLUDED.cottage_name,
            street_address = EXCLUDED.street_address,
            updated_at = CURRENT_TIMESTAMP
          RETURNING cottage_id
        `, [
          row.block,
          row.lot,
          `Block ${row.block} Lot ${row.lot}`, // Default cottage name
          row.address || null
        ]);
        
        const cottageId = cottageResult.rows[0].cottage_id;
        
        // Create or find person record for leaseholder
        if (row.leaseholder_name) {
          const names = row.leaseholder_name.split(' ');
          const firstName = names[0] || '';
          const lastName = names.slice(1).join(' ') || '';
          
          const personResult = await this.pgClient.query(`
            INSERT INTO core.persons (
              first_name, last_name,
              email, phone,
              person_type,
              created_at, updated_at
            ) VALUES ($1, $2, $3, $4, 'leaseholder', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (first_name, last_name) WHERE email IS NOT DISTINCT FROM $3
            DO UPDATE SET
              phone = EXCLUDED.phone,
              updated_at = CURRENT_TIMESTAMP
            RETURNING person_id
          `, [firstName, lastName, row.email || null, row.phone || null]);
          
          const personId = personResult.rows[0].person_id;
          
          // Create leaseholder record
          await this.pgClient.query(`
            INSERT INTO property.leaseholders (
              person_id, cottage_id,
              mailing_address_line1, mailing_city,
              mailing_state, mailing_postal_code,
              is_primary, lease_start_date,
              created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, true, CURRENT_DATE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (person_id, cottage_id)
            DO UPDATE SET
              mailing_address_line1 = EXCLUDED.mailing_address_line1,
              mailing_city = EXCLUDED.mailing_city,
              mailing_state = EXCLUDED.mailing_state,
              mailing_postal_code = EXCLUDED.mailing_postal_code,
              updated_at = CURRENT_TIMESTAMP
          `, [
            personId, cottageId,
            row.address || null,
            row.city || null,
            row.state || null,
            row.zip || null
          ]);
          
          // Dual-write to legacy system (if exists)
          await this.dualWriteToLegacy(row, cottageId, personId);
        }
        
        this.importStats.imported++;
        
      } catch (error) {
        console.error(`❌ Error importing row:`, row, error.message);
        this.importStats.errors++;
      }
    }
  }

  async dualWriteToLegacy(row, cottageId, personId) {
    // Check if legacy schema exists
    const legacyCheck = await this.pgClient.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.schemata 
        WHERE schema_name = 'legacy'
      ) as exists
    `);
    
    if (!legacyCheck.rows[0].exists) {
      return; // No legacy schema, skip dual-write
    }
    
    // Write to legacy.cottage_registry if it exists
    try {
      await this.pgClient.query(`
        INSERT INTO legacy.cottage_registry (
          block, lot, owner_name,
          mailing_address, phone, email,
          cottage_id, person_id,
          import_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
        ON CONFLICT DO NOTHING
      `, [
        row.block, row.lot, row.leaseholder_name,
        `${row.address || ''}, ${row.city || ''} ${row.state || ''} ${row.zip || ''}`.trim(),
        row.phone, row.email,
        cottageId, personId
      ]);
    } catch (error) {
      // Legacy table might not exist, continue
      console.log('ℹ️  Legacy dual-write skipped:', error.message);
    }
  }

  async generateReport() {
    console.log('\n📊 Import Summary Report');
    console.log('========================');
    console.log(`Total Records: ${this.importStats.total}`);
    console.log(`✅ Imported: ${this.importStats.imported}`);
    console.log(`⚠️  Skipped: ${this.importStats.skipped}`);
    console.log(`❌ Errors: ${this.importStats.errors}`);
    
    // Verify final count
    const countResult = await this.pgClient.query(`
      SELECT COUNT(*) as total FROM property.cottages
    `);
    
    console.log(`\n🏘️  Total cottages in database: ${countResult.rows[0].total}`);
    
    // Sample verification
    const sampleResult = await this.pgClient.query(`
      SELECT 
        c.block_number, c.lot_number, c.cottage_name,
        p.first_name || ' ' || p.last_name as leaseholder_name
      FROM property.cottages c
      LEFT JOIN property.leaseholders l ON c.cottage_id = l.cottage_id
      LEFT JOIN core.persons p ON l.person_id = p.person_id
      ORDER BY c.block_number, c.lot_number
      LIMIT 5
    `);
    
    console.log('\n📋 Sample imported records:');
    console.table(sampleResult.rows);
  }
}

async function main() {
  const importer = new CottageLeaseholderImporter();
  
  try {
    // For development, use anonymized test data
    const dataFile = isProduction && forceProduction
      ? process.argv.find(arg => arg.endsWith('.xlsx')) || 'leaseholders.xlsx'
      : path.join(__dirname, 'test-data', 'leaseholders-anonymized.json');
    
    if (!fs.existsSync(dataFile)) {
      console.error(`❌ Data file not found: ${dataFile}`);
      console.log('💡 For testing, run: node generate-anonymized-data.js');
      process.exit(1);
    }
    
    await importer.connect();
    await importer.verifySchemas();
    
    if (dataFile.endsWith('.json')) {
      // Import from JSON test data
      console.log('🧪 Using anonymized test data');
      const testData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
      await importer.importBatch(testData);
    } else {
      // Import from Excel
      await importer.importFromExcel(dataFile);
    }
    
    await importer.generateReport();
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    process.exit(1);
  } finally {
    await importer.disconnect();
  }
}

// Run the import
main();