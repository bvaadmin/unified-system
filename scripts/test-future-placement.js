#!/usr/bin/env node

// Test script to simulate a future placement submission

import fetch from 'node-fetch';

const testData = {
  properties: {
    'Submission ID': `TEST-FUTURE-${Date.now()}`,
    'Application Type': 'future',
    'Bay View Member': 'Yes',
    'Deceased Name': 'Future Planning Test',
    'Contact Name': 'Test Contact',
    'Contact Email': 'test@example.com',
    'Contact Phone': '231-555-0001',
    'Contact Address': '123 Test St, Petoskey, MI 49770',
    'Member Name': 'John Member',
    'Member Relationship': 'Self',
    'Bay View History': 'Planning for future',
    'Fee Amount': '300',
    'Policy Agreement': '__YES__',
    'date:Submission Date:start': new Date().toISOString(),
    'Personal History JSON': JSON.stringify({
      firstName: 'Future',
      lastName: 'Planning',
      birthDate: '1950-01-01',
      bayviewHistory: 'Planning ahead for peace of mind'
    })
  }
};

async function testSubmission() {
  console.log('Testing future placement submission...');
  
  try {
    const response = await fetch('https://unified-system-229ae5i4t-sam-scarrows-projects.vercel.app/api/memorial/submit-garden', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://bvaadmin.github.io'
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();
    console.log('Response:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n✅ Test submission successful!');
      console.log('Submission ID:', result.submissionId);
      console.log('PostgreSQL ID:', result.pgId);
      console.log('Notion URL:', result.notionUrl);
    } else {
      console.error('\n❌ Test submission failed:', result.error);
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

testSubmission();