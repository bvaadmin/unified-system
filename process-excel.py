
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
        print("\nSample data (first 3 rows):")
        for i, row in enumerate(result[:3]):
            print(f"Row {i+1}: {row}")
            
    except Exception as e:
        print(f"Error processing {filename}: {e}")
        sys.exit(1)

# Process both files
process_excel_file('bayview-real-cottage-data/block-lot-4-26-22.xls', 'bayview-real-cottage-data/block-lot-data.json')
print("\n" + "="*50 + "\n")
process_excel_file('bayview-real-cottage-data/LEASHOLD-4-26-22.xls', 'bayview-real-cottage-data/leashold-data.json')
