#!/usr/bin/env node

import { Client } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

async function checkColumns() {
  if (!DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const client = new Client({
    connectionString: DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // Get all columns from prepayments table
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'bayview' 
      AND table_name = 'prepayments'
      ORDER BY ordinal_position
    `);
    
    console.log('Columns in bayview.prepayments table:');
    console.log('=====================================');
    result.rows.forEach(row => {
      console.log(`${row.column_name.padEnd(25)} ${row.data_type.padEnd(20)} ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    console.log('\nExpected columns for insert:');
    console.log('============================');
    const expectedColumns = [
      'submission_id',
      'placement_type',
      'person1_name',
      'person2_name',
      'purchaser_name',
      'purchaser_phone',
      'purchaser_email',
      'purchaser_address',
      'is_member',
      'sponsor_member_name',
      'amount_paid',
      'status',
      'notes'
    ];
    
    expectedColumns.forEach(col => {
      const exists = result.rows.some(row => row.column_name === col);
      console.log(`${col.padEnd(25)} ${exists ? '✅' : '❌ MISSING'}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkColumns();