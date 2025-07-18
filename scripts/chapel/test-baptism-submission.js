#!/usr/bin/env node

/**
 * Test script for baptism form submission
 * Usage: node test-baptism-submission.js [api-url]
 */

const apiUrl = process.argv[2] || 'http://localhost:3000/api/chapel/submit-service';

const testData = {
  formType: 'baptism',
  bayViewMember: 'Test Member',
  relationship: 'Member',
  contactName: 'Test Contact',
  contactAddress: 'Test Address',
  contactPhone: '(231) 555-0000',
  serviceDate: '2025-08-01',
  serviceTime: '10:00',
  baptismPersonName: 'Test Baby',
  parentsNames: 'Test Parents',
  policyAgreement: true
};

console.log('Testing baptism form submission...');
console.log('API URL:', apiUrl);
console.log('Test data:', JSON.stringify(testData, null, 2));
console.log('---');

fetch(apiUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(testData)
})
  .then(async response => {
    const responseData = await response.text();
    console.log('Response Status:', response.status, response.statusText);
    console.log('Response Headers:');
    response.headers.forEach((value, key) => {
      console.log(`  ${key}: ${value}`);
    });
    console.log('\nResponse Body:');
    try {
      const jsonData = JSON.parse(responseData);
      console.log(JSON.stringify(jsonData, null, 2));
    } catch {
      console.log(responseData);
    }
    
    if (!response.ok) {
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Error:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
    process.exit(1);
  });