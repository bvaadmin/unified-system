#!/usr/bin/env python3
"""
Merge and prepare Bay View cottage data for database import
Creates a unified dataset with block/lot assignments
"""

import json
import re
from collections import defaultdict


def load_json_files():
    """Load the processed JSON files"""
    with open('leaseholder_data.json', 'r') as f:
        leaseholders = json.load(f)
    
    with open('block_lot_data.json', 'r') as f:
        block_lots = json.load(f)
    
    return leaseholders, block_lots


def parse_block_lot(client_id):
    """Parse block and lot from client_id (e.g., '1-1' -> block 1, lot 1)"""
    match = re.match(r'(\d+)-(\d+)', client_id)
    if match:
        return int(match.group(1)), int(match.group(2))
    return None, None


def create_cottage_import_data(leaseholders, block_lots):
    """Create cottage import data matching the database schema"""
    
    # Create a mapping of leaseholder names to their full info
    leaseholder_map = {}
    for lh in leaseholders:
        if lh['client_type'] == 'Leaseholding':
            key = f"{lh['last_name'].lower()}_{lh['first_name'].lower()}"
            leaseholder_map[key] = lh
    
    # Process block/lot assignments
    cottages = []
    missing_leaseholders = []
    
    for bl in block_lots:
        if bl['client_type'] == 'Block/Lot' and bl['payer_relationship'] == 'Leaseholding':
            block, lot = parse_block_lot(bl['client_id'])
            
            if block and lot:
                # Try to find the leaseholder
                key = f"{bl['payer_last_name'].lower()}_{bl['payer_first_name'].lower()}"
                leaseholder = leaseholder_map.get(key)
                
                cottage = {
                    'cottage_id': f"BV-{block:03d}-{lot:02d}",
                    'block': block,
                    'lot': lot,
                    'leaseholder_name': f"{bl['payer_first_name']} {bl['payer_last_name']}",
                    'last_name': bl['payer_last_name'],
                    'first_name': bl['payer_first_name']
                }
                
                if leaseholder:
                    # Add full leaseholder info
                    cottage.update({
                        'address': leaseholder['address_line_1'],
                        'address2': leaseholder['address_line_2'],
                        'city': leaseholder['city'],
                        'state': leaseholder['state/province'],
                        'zip': leaseholder['zip/postcode'],
                        'street_address': f"Block {block}, Lot {lot}",  # Bay View address
                        'street_name': 'Bay View',
                        'full_address': leaseholder['address_line_1'] + (f", {leaseholder['address_line_2']}" if leaseholder['address_line_2'] else "")
                    })
                else:
                    missing_leaseholders.append(f"{bl['payer_first_name']} {bl['payer_last_name']}")
                    cottage.update({
                        'address': '',
                        'city': '',
                        'state': '',
                        'zip': '',
                        'note': 'No address data found'
                    })
                
                cottages.append(cottage)
    
    return cottages, missing_leaseholders


def generate_statistics(cottages):
    """Generate statistics about the cottage data"""
    stats = {
        'total_cottages': len(cottages),
        'blocks': defaultdict(int),
        'cottages_with_addresses': 0,
        'cottages_without_addresses': 0
    }
    
    for cottage in cottages:
        stats['blocks'][cottage['block']] += 1
        if cottage.get('address'):
            stats['cottages_with_addresses'] += 1
        else:
            stats['cottages_without_addresses'] += 1
    
    return stats


def main():
    """Main processing function"""
    print("🔄 Merging Bay View Cottage Data")
    print("=" * 50)
    
    # Load data
    leaseholders, block_lots = load_json_files()
    
    print(f"📊 Loaded {len(leaseholders)} leaseholder records")
    print(f"📊 Loaded {len(block_lots)} block/lot records")
    
    # Create cottage import data
    cottages, missing = create_cottage_import_data(leaseholders, block_lots)
    
    print(f"\n✅ Created {len(cottages)} cottage records")
    
    if missing:
        print(f"⚠️  {len(set(missing))} leaseholders in block/lot file not found in address file")
    
    # Generate statistics
    stats = generate_statistics(cottages)
    
    print(f"\n📊 Statistics:")
    print(f"  Total cottages: {stats['total_cottages']}")
    print(f"  Unique blocks: {len(stats['blocks'])}")
    print(f"  Cottages with addresses: {stats['cottages_with_addresses']}")
    print(f"  Cottages without addresses: {stats['cottages_without_addresses']}")
    
    # Show block distribution
    print(f"\n📍 Block distribution:")
    for block in sorted(stats['blocks'].keys())[:10]:
        print(f"  Block {block}: {stats['blocks'][block]} cottages")
    
    # Save the merged data
    output = {
        'metadata': {
            'source': 'Bay View Excel Files (April 26, 2022)',
            'total_cottages': len(cottages),
            'unique_blocks': len(stats['blocks']),
            'cottages_with_addresses': stats['cottages_with_addresses']
        },
        'cottages': cottages
    }
    
    with open('bay_view_cottages_final.json', 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"\n✅ Saved merged data to bay_view_cottages_final.json")
    print(f"📊 Ready to import {len(cottages)} cottages into the database")


if __name__ == "__main__":
    main()