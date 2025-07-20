#!/usr/bin/env node

/**
 * Generate anonymized test data for cottage leaseholders
 * This creates realistic but fake data for development/testing
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Bay View authentic block/lot structure
const BLOCKS = Array.from({length: 145}, (_, i) => i + 1); // Blocks 1-145
const MAX_LOTS_PER_BLOCK = 8;

// Realistic name pools for anonymization
const FIRST_NAMES = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
  'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa'
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson'
];

const CITIES = [
  'Petoskey', 'Harbor Springs', 'Charlevoix', 'Traverse City', 'Boyne City',
  'Grand Rapids', 'Detroit', 'Ann Arbor', 'Chicago', 'Milwaukee', 'Indianapolis'
];

const STATES = ['MI', 'IL', 'OH', 'IN', 'WI'];

function generateAnonymizedLeaseholder(index) {
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  const city = CITIES[Math.floor(Math.random() * CITIES.length)];
  const state = STATES[Math.floor(Math.random() * STATES.length)];
  
  // Generate authentic Bay View block/lot
  const block = BLOCKS[Math.floor(index / MAX_LOTS_PER_BLOCK) % BLOCKS.length];
  const lot = (index % MAX_LOTS_PER_BLOCK) + 1;
  
  return {
    cottage_id: `BV-${String(block).padStart(3, '0')}-${String(lot).padStart(2, '0')}`,
    block: block,
    lot: lot,
    leaseholder_name: `${firstName} ${lastName}`,
    mailing_address: {
      street: `${Math.floor(Math.random() * 9999) + 100} Main Street`,
      city: city,
      state: state,
      zip: `${Math.floor(Math.random() * 90000) + 10000}`
    },
    phone: `${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
    lease_start_year: Math.floor(Math.random() * 50) + 1970,
    member_status: Math.random() > 0.2 ? 'active' : 'inactive',
    voting_rights: Math.random() > 0.3
  };
}

function generateTestData() {
  const leaseholders = [];
  
  // Generate exactly 312 properties as specified
  for (let i = 0; i < 312; i++) {
    leaseholders.push(generateAnonymizedLeaseholder(i));
  }
  
  // Save anonymized test data
  const outputPath = path.join(__dirname, 'test-data');
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath);
  }
  
  const outputFile = path.join(outputPath, 'leaseholders-anonymized.json');
  fs.writeFileSync(outputFile, JSON.stringify(leaseholders, null, 2));
  
  console.log(`✅ Generated ${leaseholders.length} anonymized leaseholder records`);
  console.log(`📁 Saved to: ${outputFile}`);
  
  // Generate summary statistics
  const stats = {
    total_properties: leaseholders.length,
    unique_blocks: [...new Set(leaseholders.map(l => l.block))].length,
    active_members: leaseholders.filter(l => l.member_status === 'active').length,
    voting_members: leaseholders.filter(l => l.voting_rights).length
  };
  
  console.log('\n📊 Summary Statistics:');
  console.log(JSON.stringify(stats, null, 2));
  
  return leaseholders;
}

// Run if called directly
generateTestData();

export { generateTestData };