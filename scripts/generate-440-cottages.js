#!/usr/bin/env node

/**
 * Generate 440 cottage leaseholders to match Bay View's actual property count
 * This creates realistic test data for the full cottage inventory
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Bay View has approximately 440 cottages across 60-70 blocks
const TARGET_COTTAGES = 440;
const BLOCKS = 60; // Spread across 60 blocks
const AVG_LOTS_PER_BLOCK = Math.ceil(TARGET_COTTAGES / BLOCKS);

// Realistic name pools
const FIRST_NAMES = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
  'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa',
  'Matthew', 'Dorothy', 'Anthony', 'Sandra', 'Mark', 'Ashley', 'Donald', 'Kimberly',
  'Kenneth', 'Emily', 'Joshua', 'Donna', 'Kevin', 'Michelle', 'Brian', 'Carol'
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker',
  'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill'
];

const CITIES = [
  'Petoskey', 'Harbor Springs', 'Charlevoix', 'Traverse City', 'Boyne City',
  'Grand Rapids', 'Detroit', 'Ann Arbor', 'Chicago', 'Milwaukee', 'Indianapolis',
  'Columbus', 'Cleveland', 'Cincinnati', 'St. Louis', 'Kansas City', 'Nashville'
];

const STATES = ['MI', 'IL', 'OH', 'IN', 'WI', 'MO', 'KY', 'TN'];

function generateCottageDistribution() {
  const distribution = [];
  let cottageCount = 0;
  
  // Create varying lots per block (5-9 cottages per block)
  for (let block = 1; block <= BLOCKS && cottageCount < TARGET_COTTAGES; block++) {
    const lotsInBlock = 5 + Math.floor(Math.random() * 5); // 5-9 lots per block
    
    for (let lot = 1; lot <= lotsInBlock && cottageCount < TARGET_COTTAGES; lot++) {
      distribution.push({ block, lot });
      cottageCount++;
    }
  }
  
  return distribution;
}

function generateLeaseholder(block, lot, index) {
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  const city = CITIES[Math.floor(Math.random() * CITIES.length)];
  const state = STATES[Math.floor(Math.random() * STATES.length)];
  
  // Generate realistic lease start years (1960-2021)
  const leaseStartYear = 1960 + Math.floor(Math.random() * 62);
  
  // 70% are active members
  const isActive = Math.random() < 0.7;
  
  // 60% of active members have voting rights
  const hasVotingRights = isActive && Math.random() < 0.6;
  
  return {
    cottage_id: `BV-${String(block).padStart(3, '0')}-${String(lot).padStart(2, '0')}`,
    block: block,
    lot: lot,
    leaseholder_name: `${firstName} ${lastName}`,
    mailing_address: {
      street: `${1000 + Math.floor(Math.random() * 8000)} Main Street`,
      city: city,
      state: state,
      zip: `${48000 + Math.floor(Math.random() * 1000)}`
    },
    phone: `231-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
    lease_start_year: leaseStartYear,
    member_status: isActive ? 'active' : 'inactive',
    voting_rights: hasVotingRights
  };
}

// Generate the data
console.log(`🏘️  Generating ${TARGET_COTTAGES} Bay View cottage leaseholders...`);

const cottageDistribution = generateCottageDistribution();
const leaseholders = cottageDistribution.map((cottage, index) => 
  generateLeaseholder(cottage.block, cottage.lot, index)
);

// Save to file
const outputPath = path.join(__dirname, '../bayview-leaseholder-data/test-data/leaseholders-440-cottages.json');
fs.writeFileSync(outputPath, JSON.stringify(leaseholders, null, 2));

// Summary statistics
const stats = {
  totalCottages: leaseholders.length,
  uniqueBlocks: new Set(leaseholders.map(l => l.block)).size,
  activeMembers: leaseholders.filter(l => l.member_status === 'active').length,
  votingMembers: leaseholders.filter(l => l.voting_rights).length,
  averageCottagesPerBlock: (leaseholders.length / new Set(leaseholders.map(l => l.block)).size).toFixed(1)
};

console.log('\n✅ Generation complete!');
console.log(`📊 Statistics:`);
console.log(`   Total cottages: ${stats.totalCottages}`);
console.log(`   Unique blocks: ${stats.uniqueBlocks}`);
console.log(`   Active members: ${stats.activeMembers}`);
console.log(`   Voting members: ${stats.votingMembers}`);
console.log(`   Avg cottages/block: ${stats.averageCottagesPerBlock}`);
console.log(`\n📁 Saved to: ${outputPath}`);