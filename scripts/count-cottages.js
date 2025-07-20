import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataPath = path.join(__dirname, '../bayview-leaseholder-data/test-data/leaseholders-anonymized.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

console.log('📊 Cottage Data Analysis:');
console.log('Total cottage records in JSON:', data.length);
console.log('Last cottage ID:', data[data.length-1].cottage_id);
console.log('Highest block number:', Math.max(...data.map(d => d.block)));
console.log('Unique blocks:', new Set(data.map(d => d.block)).size);

// Check for gaps or patterns
const blockCounts = {};
data.forEach(d => {
  blockCounts[d.block] = (blockCounts[d.block] || 0) + 1;
});

console.log('\nCottages per block:');
Object.entries(blockCounts)
  .sort((a, b) => Number(a[0]) - Number(b[0]))
  .slice(0, 10)
  .forEach(([block, count]) => {
    console.log(`  Block ${block}: ${count} cottages`);
  });
console.log('  ...');

console.log('\nTotal cottages by summing blocks:', Object.values(blockCounts).reduce((a, b) => a + b, 0));