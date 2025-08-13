#!/usr/bin/env node

import 'dotenv/config';
import { Client } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

async function testImmediatePlacement() {
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
    console.log('Connected to database');
    
    // Test immediate placement data
    const testData = {
      'Submission ID': 'TEST-IMMEDIATE-' + Date.now(),
      'First Name': 'John',
      'Last Name': 'Doe',
      'Personal History JSON': JSON.stringify({
        firstName: 'John',
        lastName: 'Doe',
        middleName: 'Michael',
        birthDate: '1940-01-01',
        deathDate: '2024-12-01',
        birthPlace: 'Petoskey, MI',
        homeAddress: '123 Main St',
        bayviewAddress: 'Block 12 Lot 7',
        motherName: 'Jane Doe',
        fatherName: 'James Doe',
        bayviewHistory: 'Long-time member'
      }),
      'Application Type': 'immediate',
      'Bay View Member': 'Yes',
      'Member Name': 'Test Member',
      'Contact Name': 'Contact Person',
      'Contact Email': 'contact@example.com',
      'Contact Phone': '555-1234',
      'Contact Address': '456 Contact St',
      'Fee Amount': '400',
      'Bay View History': 'Test history'
    };
    
    // Parse personal history
    const personalHistory = JSON.parse(testData['Personal History JSON']);
    
    const insertQuery = `
      INSERT INTO bayview.memorials (
        submission_id,
        first_name, 
        last_name, 
        middle_name,
        maiden_name,
        birth_date, 
        death_date,
        birth_place,
        home_address,
        bayview_address,
        mother_name,
        father_name,
        message,
        bayview_history,
        application_type,
        is_member,
        member_name,
        member_relationship,
        contact_name,
        contact_email,
        contact_phone,
        contact_address,
        service_date,
        celebrant_requested,
        fee_amount,
        other_first_name,
        other_middle_name,
        other_last_name,
        other_maiden_name,
        other_birth_date,
        other_death_date,
        other_birth_place,
        other_home_address,
        other_bayview_address,
        other_bayview_history,
        second_first_name,
        second_middle_name,
        second_last_name,
        second_maiden_name,
        second_birth_date,
        second_death_date,
        second_birth_place,
        second_home_address,
        second_bayview_address,
        second_bayview_history
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45)
      RETURNING id, created_at
    `;
    
    const values = [
      testData['Submission ID'],
      testData['First Name'] || personalHistory.firstName || '',
      testData['Last Name'] || personalHistory.lastName || '',
      personalHistory.middleName || '',
      personalHistory.maidenName || '',
      personalHistory.birthDate || null,
      personalHistory.deathDate || null,
      personalHistory.birthPlace || '',
      personalHistory.homeAddress || '',
      personalHistory.bayviewAddress || '',
      personalHistory.motherName || '',
      personalHistory.fatherName || '',
      testData['Bay View History'] || '',
      personalHistory.bayviewHistory || '',
      testData['Application Type'] || '',
      testData['Bay View Member'] === 'Yes',
      testData['Member Name'] || '',
      '', // member_relationship
      testData['Contact Name'] || '',
      testData['Contact Email'] || '',
      testData['Contact Phone'] || '',
      testData['Contact Address'] || '',
      null, // service_date
      '', // celebrant_requested
      parseFloat(testData['Fee Amount']) || 0,
      null, null, null, null, null, null, null, null, null, null, // other person fields
      null, null, null, null, null, null, null, null, null, null  // second person fields
    ];
    
    console.log('Testing insert with', values.length, 'values');
    console.log('First few values:', values.slice(0, 5));
    
    const result = await client.query(insertQuery, values);
    console.log('✅ Success! Created record:', result.rows[0]);
    
    // Clean up test record
    await client.query('DELETE FROM bayview.memorials WHERE id = $1', [result.rows[0].id]);
    console.log('Cleaned up test record');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.detail) console.error('Detail:', error.detail);
    if (error.hint) console.error('Hint:', error.hint);
  } finally {
    await client.end();
  }
}

testImmediatePlacement();