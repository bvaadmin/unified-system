#!/usr/bin/env node
/**
 * Process real Bay View cottage data from Excel files
 * Converts XLS to JSON for import into database
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

async function processRealData() {
  console.log('🏘️  Processing Real Bay View Cottage Data');
  console.log('========================================\n');

  try {
    // Check if Python and required libraries are available
    try {
      await execAsync('python3 --version');
      console.log('✅ Python3 available');
    } catch (error) {
      console.error('❌ Python3 is required to process Excel files');
      console.log('Please install Python3 and run: pip3 install pandas openpyxl xlrd');
      process.exit(1);
    }

    // Create Python script to convert Excel to JSON
    const pythonScript = `
import pandas as pd
import json
import sys

def process_excel_file(filename, output_name):
    try:
        # Read Excel file
        df = pd.read_excel(filename, engine='xlrd')
        print(f"Processing {filename}...")
        print(f"Found {len(df)} rows and {len(df.columns)} columns")
        print(f"Columns: {list(df.columns)}")
        
        # Convert to JSON
        result = df.to_dict('records')
        
        # Save to JSON file
        with open(output_name, 'w') as f:
            json.dump(result, f, indent=2, default=str)
        
        print(f"Saved to {output_name}")
        
        # Show sample data
        print("\\nSample data (first 3 rows):")
        for i, row in enumerate(result[:3]):
            print(f"Row {i+1}: {row}")
            
    except Exception as e:
        print(f"Error processing {filename}: {e}")
        sys.exit(1)

# Process both files
process_excel_file('bayview-real-cottage-data/block-lot-4-26-22.xls', 'bayview-real-cottage-data/block-lot-data.json')
print("\\n" + "="*50 + "\\n")
process_excel_file('bayview-real-cottage-data/LEASHOLD-4-26-22.xls', 'bayview-real-cottage-data/leashold-data.json')
`;

    // Write Python script
    fs.writeFileSync('process-excel.py', pythonScript);
    
    // Execute Python script
    console.log('📊 Converting Excel files to JSON...\n');
    const { stdout, stderr } = await execAsync('python3 process-excel.py');
    
    if (stderr) {
      console.error('Warnings:', stderr);
    }
    
    console.log(stdout);
    
    // Clean up Python script
    fs.unlinkSync('process-excel.py');
    
    // Check if JSON files were created
    const blockLotJson = 'bayview-real-cottage-data/block-lot-data.json';
    const leasholdJson = 'bayview-real-cottage-data/leashold-data.json';
    
    if (fs.existsSync(blockLotJson) && fs.existsSync(leasholdJson)) {
      console.log('\n✅ Successfully converted Excel files to JSON');
      console.log('📁 Output files:');
      console.log(`  - ${blockLotJson}`);
      console.log(`  - ${leasholdJson}`);
      
      // Show statistics
      const blockLotData = JSON.parse(fs.readFileSync(blockLotJson, 'utf8'));
      const leasholdData = JSON.parse(fs.readFileSync(leasholdJson, 'utf8'));
      
      console.log('\n📊 Data Statistics:');
      console.log(`  - Block/Lot records: ${blockLotData.length}`);
      console.log(`  - Leaseholder records: ${leasholdData.length}`);
      
    } else {
      console.error('❌ Failed to create JSON files');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the processor
processRealData();