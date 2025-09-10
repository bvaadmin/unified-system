#!/usr/bin/env node

import oracledb from 'oracledb';
import { getConnection, closePool } from '../lib/database/adapters/oracle-adapter.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Use environment variable (must be set before running)
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL environment variable not set');
  console.error('Please set DATABASE_URL environment variable before running this script');
  process.exit(1);
}

async function testConnection() {
  console.log('Testing Oracle connection...');
  console.log('Database URL:', DATABASE_URL.replace(/:[^:@]+@/, ':****@')); // Hide password in logs
  
  let connection;

  try {
    console.log('\n1. Connecting to database...');
    connection = await getConnection();
    console.log('✅ Connected successfully!');

    console.log('\n2. Testing BAYVIEW_MEMORIALS table...');
    const result = await connection.execute(`
      SELECT column_name, data_type, nullable 
      FROM user_tab_columns 
      WHERE table_name = 'BAYVIEW_MEMORIALS'
      ORDER BY column_id
      FETCH FIRST 5 ROWS ONLY
    `);
    console.log(`✅ Found ${result.rows.length} columns in BAYVIEW_MEMORIALS`);
    result.rows.forEach(row => {
      console.log(`   - ${row[0]}: ${row[1]}`);
    });

    console.log('\n3. Testing INSERT capability...');
    const bindIn = {
      submission_id: 'TEST-' + Date.now(),
      first_name: 'Test',
      last_name: 'User',
      application_type: 'immediate',
      is_member: 1,
      contact_name: 'Test Contact',
      contact_email: 'test@example.com',
      contact_phone: '555-0000',
      fee_amount: 400.00,
      out_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      out_created_at: { dir: oracledb.BIND_OUT, type: oracledb.DATE }
    };

    const testInsert = await connection.execute(`
      INSERT INTO BAYVIEW_MEMORIALS (
        submission_id, first_name, last_name, application_type, 
        is_member, contact_name, contact_email, contact_phone,
        fee_amount, created_at
      ) VALUES (
        :submission_id, :first_name, :last_name, :application_type,
        :is_member, :contact_name, :contact_email, :contact_phone,
        :fee_amount, CURRENT_TIMESTAMP
      ) RETURNING id, created_at INTO :out_id, :out_created_at
    `, bindIn, { autoCommit: false });

    const insertedId = (testInsert.outBinds && testInsert.outBinds.out_id && testInsert.outBinds.out_id[0]) || null;
    console.log('✅ Test INSERT successful! ID:', insertedId);

    // Clean up test data
    console.log('\n4. Cleaning up test data...');
    if (insertedId != null) {
      await connection.execute('DELETE FROM BAYVIEW_MEMORIALS WHERE id = :id', { id: insertedId }, { autoCommit: true });
      console.log('✅ Test data cleaned up');
    } else {
      console.log('ℹ️ Skipping cleanup: could not resolve inserted ID');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection:', err.message);
      }
    }
    await closePool();
    console.log('\n5. Connection closed');
  }
}

testConnection();
