#!/usr/bin/env node

import 'dotenv/config';

async function testEmailSubmission() {
  console.log('📧 Testing Memorial Garden submission with email confirmation...\n');
  
  const API_URL = 'https://unified-system.vercel.app/api/memorial/submit-garden';
  
  // Create a test submission for Sam - using the exact legacy format
  const timestamp = new Date().toISOString();
  const submissionId = 'MG-EMAIL-TEST-' + Date.now();
  
  const testData = {
    'Submission ID': submissionId,
    'Submission Date': timestamp,
    'date:Submission Date:start': timestamp.split('T')[0],
    'Status': 'pending',
    'Application Type': 'immediate',
    'Placement Type': 'immediate',
    'Bay View Member': 'Yes',
    'Member Name': 'Sam Scarrow',
    'Member Relationship': '',
    'Fee Amount': '750',
    'Policy Agreement': '__YES__',
    'Contact Name': 'Sam Scarrow',
    'Contact Phone': '(231) 555-0100',
    'Contact Email': 'sscarrow@gmail.com',
    'Contact Address': '123 Main Street, Petoskey, MI 49770',
    'Deceased Name': 'John TestPerson',
    'First Name': 'John',
    'Last Name': 'TestPerson',
    'Middle Name': 'Middle',
    'Maiden Name': '',
    'Personal History JSON': JSON.stringify({
      firstName: 'John',
      lastName: 'TestPerson',
      middleName: 'Middle',
      maidenName: ''
    })
  };

  try {
    console.log('📤 Sending submission to:', API_URL);
    console.log('   Submission ID:', testData['Submission ID']);
    console.log('   Contact Email:', testData['Contact Email']);
    console.log('   Application Type:', testData['Application Type']);
    console.log('   Fee Amount: $' + testData['Fee Amount']);
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ properties: testData })
    });

    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log('\n✅ Submission successful!');
      console.log('   Submission ID:', result.submissionId);
      console.log('   PostgreSQL ID:', result.pgId);
      console.log('   Notion ID:', result.notionId);
      console.log('   Email Sent:', result.emailSent ? '✅ Yes' : '❌ No');
      console.log('\n📬 Check your email at sscarrow@gmail.com');
      console.log('   Subject: "Memorial Garden Application Received"');
      console.log('   From: worshipservices@bayviewassociation.org');
    } else {
      console.error('❌ Submission failed:', result);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testEmailSubmission();