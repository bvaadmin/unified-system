#!/usr/bin/env node

import fetch from 'node-fetch';

const API_URL = 'https://unified-system.vercel.app/api/memorial/submit-garden';

async function testSubmission() {
  const testData = {
    properties: {
      'Submission ID': 'API-TEST-' + Date.now(),
      'Submission Date': new Date().toISOString(),
      'date:Submission Date:start': new Date().toISOString().split('T')[0],
      'Status': 'Pending',
      'Application Type': 'future',
      'Placement Type': 'single',
      'Bay View Member': 'Yes',
      'Member Name': 'Test Member',
      'Member Relationship': 'Self',
      'Fee Amount': '400',
      'Policy Agreement': '__YES__',
      'Contact Name': 'API Test User',
      'Contact Phone': '555-0001',
      'Contact Email': 'apitest@example.com',
      'Contact Address': '123 Test St, Test City, MI 49770',
      'Prepayment Person 1': 'John Test',
      'Prepayment Person 2': ''
    }
  };

  console.log('Testing memorial garden API...');
  console.log('Endpoint:', API_URL);
  console.log('');

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://bvaadmin.github.io'
      },
      body: JSON.stringify(testData)
    });

    const data = await response.json();
    
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log('\n✅ SUCCESS!');
      console.log('- Submission ID:', data.submissionId);
      console.log('- PostgreSQL ID:', data.pgId || '❌ Not saved to database');
      console.log('- Notion ID:', data.notionId || '❌ Not saved to Notion');
      console.log('- Sync Status:', data.syncStatus);
      
      if (!data.pgId) {
        console.log('\n⚠️  WARNING: Data was not saved to PostgreSQL!');
      }
    } else {
      console.log('\n❌ FAILED:', data.error || data.message);
    }
    
  } catch (error) {
    console.error('Network error:', error.message);
  }
}

testSubmission();