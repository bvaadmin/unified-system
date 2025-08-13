#!/usr/bin/env node

import { Client } from 'pg';

// Use environment variable (must be set before running)
const DATABASE_URL = process.env.DATABASE_URL_CLEAN || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL or DATABASE_URL_CLEAN environment variable not set');
  console.error('Please set one of these environment variables before running this script');
  process.exit(1);
}

async function testConnection() {
  console.log('Testing PostgreSQL connection...');
  console.log('Database URL:', DATABASE_URL.replace(/:[^:@]+@/, ':****@')); // Hide password in logs
  
  const pgClient = new Client({
    connectionString: DATABASE_URL.replace('?sslmode=require', ''),
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('\n1. Connecting to database...');
    await pgClient.connect();
    console.log('✅ Connected successfully!');

    console.log('\n2. Testing bayview.memorials table...');
    const result = await pgClient.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'bayview' 
      AND table_name = 'memorials'
      ORDER BY ordinal_position
      LIMIT 5
    `);
    console.log(`✅ Found ${result.rowCount} columns in bayview.memorials`);
    result.rows.forEach(row => {
      console.log(`   - ${row.column_name}: ${row.data_type}`);
    });

    console.log('\n3. Testing INSERT capability...');
    const testInsert = await pgClient.query(`
      INSERT INTO bayview.memorials (
        submission_id, first_name, last_name, application_type, 
        is_member, contact_name, contact_email, contact_phone,
        fee_amount, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()
      ) RETURNING id, created_at
    `, [
      'TEST-' + Date.now(),
      'Test',
      'User',
      'immediate',
      true,
      'Test Contact',
      'test@example.com',
      '555-0000',
      400.00
    ]);
    console.log('✅ Test INSERT successful! ID:', testInsert.rows[0].id);

    // Clean up test data
    console.log('\n4. Cleaning up test data...');
    await pgClient.query('DELETE FROM bayview.memorials WHERE id = $1', [testInsert.rows[0].id]);
    console.log('✅ Test data cleaned up');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pgClient.end();
    console.log('\n5. Connection closed');
  }
}

testConnection();