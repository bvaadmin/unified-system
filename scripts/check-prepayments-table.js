#!/usr/bin/env node

import { Client } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

async function checkTable() {
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
    
    // Check if prepayments table exists
    const result = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'bayview' 
        AND table_name = 'prepayments'
      )
    `);
    
    console.log('Prepayments table exists:', result.rows[0].exists);
    
    if (!result.rows[0].exists) {
      console.log('\nTable bayview.prepayments does NOT exist!');
      console.log('This is why prepayment submissions are failing.');
      
      // Check what tables do exist in bayview schema
      const tables = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'bayview'
        ORDER BY table_name
      `);
      
      console.log('\nAvailable tables in bayview schema:');
      tables.rows.forEach(row => {
        console.log('  -', row.table_name);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkTable();