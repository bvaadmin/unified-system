#!/usr/bin/env python3
"""
Process Bay View cottage and leaseholder data from Excel files
Converts XLS files to JSON format for database import
"""

import pandas as pd
import json
import sys
from datetime import datetime
from pathlib import Path


def process_leaseholder_file(filename='LEASHOLD 4-26-22.XLS'):
    """Process the main leaseholder Excel file"""
    print(f"📊 Processing {filename}...")
    
    try:
        # Read Excel file
        df = pd.read_excel(filename, engine='xlrd')
        
        print(f"  Found {len(df)} rows and {len(df.columns)} columns")
        print(f"  Columns: {list(df.columns)[:10]}...")  # Show first 10 columns
        
        # Clean column names
        df.columns = df.columns.str.strip().str.replace(' ', '_').str.lower()
        
        # Basic data cleaning
        df = df.fillna('')
        
        # Convert to records
        records = df.to_dict('records')
        
        # Save to JSON
        output_file = 'leaseholder_data.json'
        with open(output_file, 'w') as f:
            json.dump(records, f, indent=2, default=str)
        
        print(f"  ✅ Saved {len(records)} records to {output_file}")
        
        # Show sample record
        if records:
            print("\n  Sample record:")
            sample = records[0]
            for key, value in list(sample.items())[:5]:
                print(f"    {key}: {value}")
        
        return records
        
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return None


def process_block_lot_file(filename='block-lot 4-26-22.XLS'):
    """Process the block and lot mapping Excel file"""
    print(f"\n📊 Processing {filename}...")
    
    try:
        # Read Excel file
        df = pd.read_excel(filename, engine='xlrd')
        
        print(f"  Found {len(df)} rows and {len(df.columns)} columns")
        print(f"  Columns: {list(df.columns)}")
        
        # Clean column names
        df.columns = df.columns.str.strip().str.replace(' ', '_').str.lower()
        
        # Basic data cleaning
        df = df.fillna('')
        
        # Convert to records
        records = df.to_dict('records')
        
        # Save to JSON
        output_file = 'block_lot_data.json'
        with open(output_file, 'w') as f:
            json.dump(records, f, indent=2, default=str)
        
        print(f"  ✅ Saved {len(records)} records to {output_file}")
        
        # Show statistics
        if 'block' in df.columns and 'lot' in df.columns:
            unique_blocks = df['block'].nunique()
            print(f"  📍 Found {unique_blocks} unique blocks")
        
        return records
        
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return None


def create_import_ready_json(leaseholder_data, block_lot_data):
    """Combine data into import-ready format"""
    print("\n🔄 Creating import-ready JSON...")
    
    # This will be customized based on actual data structure
    import_data = {
        'metadata': {
            'source': 'Bay View Excel Files',
            'date': datetime.now().isoformat(),
            'leaseholder_count': len(leaseholder_data) if leaseholder_data else 0,
            'block_lot_count': len(block_lot_data) if block_lot_data else 0
        },
        'leaseholders': leaseholder_data or [],
        'block_lots': block_lot_data or []
    }
    
    # Save combined data
    with open('bay_view_import_data.json', 'w') as f:
        json.dump(import_data, f, indent=2, default=str)
    
    print("  ✅ Created bay_view_import_data.json")
    print(f"  📊 Total records ready for import: {import_data['metadata']['leaseholder_count']}")


def main():
    """Main processing function"""
    print("🏘️  Bay View Cottage Data Processor")
    print("=" * 50)
    
    # Check if files exist
    files_to_process = ['LEASHOLD 4-26-22.XLS', 'block-lot 4-26-22.XLS']
    
    for file in files_to_process:
        if not Path(file).exists():
            print(f"❌ Error: {file} not found in current directory")
            print("Please ensure Excel files are in the data-processing directory")
            sys.exit(1)
    
    # Process files
    leaseholder_data = process_leaseholder_file()
    block_lot_data = process_block_lot_file()
    
    # Create import-ready JSON
    if leaseholder_data or block_lot_data:
        create_import_ready_json(leaseholder_data, block_lot_data)
        print("\n✅ Processing complete! Check the generated JSON files.")
    else:
        print("\n❌ No data was successfully processed.")


if __name__ == "__main__":
    main()