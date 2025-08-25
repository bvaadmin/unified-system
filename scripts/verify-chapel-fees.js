import pg from 'pg';
const { Client } = pg;
import dotenv from 'dotenv';
dotenv.config();

const client = new Client({
  connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

await client.connect();

// Get FINANCE category ID
const catResult = await client.query(`
  SELECT id FROM config.categories WHERE category_code = 'FINANCE'
`);
const categoryId = catResult.rows[0].id;

// Get all chapel fees
const result = await client.query(`
  SELECT setting_key, setting_name, value_number
  FROM config.settings
  WHERE category_id = $1 AND setting_key LIKE 'chapel_%'
  ORDER BY setting_key
`, [categoryId]);

console.log('Chapel Service Fee Verification:');
console.log('=' + '='.repeat(50));

const fees = {};
result.rows.forEach(row => {
  fees[row.setting_key] = parseFloat(row.value_number);
  console.log(row.setting_name + ': $' + parseFloat(row.value_number).toFixed(2));
});

console.log('\nCalculated Totals:');
console.log('-' + '-'.repeat(50));

const audioFee = fees['chapel_audio_support_fee'] || 0;

console.log('\nMember Wedding:');
console.log('  Base: $' + (fees['chapel_wedding_fee_member'] || 0).toFixed(2));
console.log('  Audio: $' + audioFee.toFixed(2));
console.log('  TOTAL: $' + ((fees['chapel_wedding_fee_member'] || 0) + audioFee).toFixed(2));

console.log('\nNon-Member Wedding:');
console.log('  Base: $' + (fees['chapel_wedding_fee_nonmember'] || 0).toFixed(2));
console.log('  Audio: $' + audioFee.toFixed(2));
console.log('  TOTAL: $' + ((fees['chapel_wedding_fee_nonmember'] || 0) + audioFee).toFixed(2));

console.log('\nMember Memorial:');
console.log('  Base: $' + (fees['chapel_memorial_fee_member'] || 0).toFixed(2));
console.log('  Audio: $' + audioFee.toFixed(2));
console.log('  TOTAL: $' + ((fees['chapel_memorial_fee_member'] || 0) + audioFee).toFixed(2));

console.log('\nNon-Member Memorial:');
console.log('  Base: $' + (fees['chapel_memorial_fee_nonmember'] || 0).toFixed(2));
console.log('  Audio: $' + audioFee.toFixed(2));
console.log('  TOTAL: $' + ((fees['chapel_memorial_fee_nonmember'] || 0) + audioFee).toFixed(2));

await client.end();