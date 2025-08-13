#!/usr/bin/env node

import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const API_URL = 'https://unified-system.vercel.app/api/memorial/submit-garden';

// Test 1: Immediate placement (member)
async function testImmediatePlacement() {
  console.log('🧪 Test 1: Immediate placement for member...\n');
  
  const testData = {
    properties: {
      'Submission ID': `MG-TEST-IMM-${Date.now()}`,
      'Application Type': 'immediate',
      'Bay View Member': 'Yes',
      'Contact Name': 'Mary Smith',
      'Contact Email': 'mary.smith@test.com',
      'Contact Phone': '231-555-0101',
      'Contact Address': '123 Bay View St, Petoskey, MI 49770',
      'first_name': 'John',
      'last_name': 'Smith',
      'middle_name': 'William',
      'Personal History JSON': JSON.stringify({
        firstName: 'John',
        lastName: 'Smith',
        middleName: 'William',
        birthDate: '1945-03-15',
        deathDate: '2024-11-15',
        birthPlace: 'Grand Rapids, MI',
        homeAddress: '789 Main St, Grand Rapids, MI',
        bayviewAddress: 'Block 8 Lot 12',
        motherName: 'Helen Smith',
        fatherName: 'Robert Smith',
        bayviewHistory: 'Long-time member, served on worship committee'
      }),
      'Fee Amount': '1500.00',
      'is_member': true,
      'application_type': 'immediate'
    }
  };
  
  return await submitTest('Immediate Member', testData);
}

// Test 2: Prepayment (non-member with sponsor)
async function testPrepaymentNonMember() {
  console.log('🧪 Test 2: Prepayment for non-member with sponsor...\n');
  
  const testData = {
    properties: {
      'Submission ID': `MG-TEST-PREP-${Date.now()}`,
      'Application Type': 'future',
      'Bay View Member': 'No',
      'Member Name': 'Jane Anderson',
      'Member Relationship': 'Friend',
      'Contact Name': 'Bob Johnson',
      'Contact Email': 'bob.johnson@test.com',
      'Contact Phone': '231-555-0102',
      'Contact Address': '456 Harbor St, Petoskey, MI 49770',
      'first_name': 'Alice',
      'last_name': 'Johnson',
      'Fee Amount': '3000.00',
      'is_member': false,
      'application_type': 'future'
    }
  };
  
  return await submitTest('Prepayment Non-Member', testData);
}

// Test 3: Invalid submission (missing required fields)
async function testInvalidSubmission() {
  console.log('🧪 Test 3: Invalid submission (missing contact info)...\n');
  
  const testData = {
    properties: {
      'Submission ID': `MG-TEST-INV-${Date.now()}`,
      'Application Type': 'immediate',
      'Bay View Member': 'Yes',
      // Missing contact name, email, phone - should fail
      'first_name': 'Test',
      'last_name': 'Person',
      'Fee Amount': '1500.00'
    }
  };
  
  return await submitTest('Invalid Submission', testData);
}

async function submitTest(testName, testData) {
  try {
    console.log(`📤 Sending ${testName}...`);
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://bvaadmin.github.io'
      },
      body: JSON.stringify(testData)
    });
    
    console.log(`📊 Status: ${response.status}`);
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ ${testName} successful!`);
      console.log(`   - Submission ID: ${result.submissionId}`);
      console.log(`   - PostgreSQL ID: ${result.pgId || 'null'}`);
      console.log(`   - Notion ID: ${result.notionId}`);
      console.log(`   - Sync Status: ${result.syncStatus}`);
      if (result.personsCreated) {
        console.log(`   - Contact Person: ${result.personsCreated.contact_person_id}`);
        console.log(`   - Deceased Persons: ${result.personsCreated.deceased_person_ids?.join(', ')}`);
      }
    } else {
      console.log(`❌ ${testName} failed: ${result.error || result.message}`);
    }
    
    console.log(''); // blank line
    return result;
    
  } catch (error) {
    console.error(`💥 ${testName} error: ${error.message}\n`);
    return { success: false, error: error.message };
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Running comprehensive Memorial Garden API tests...\n');
  console.log('================================================\n');
  
  const results = [];
  
  results.push(await testImmediatePlacement());
  results.push(await testPrepaymentNonMember());
  results.push(await testInvalidSubmission());
  
  // Summary
  console.log('📋 TEST SUMMARY');
  console.log('===============');
  const passed = results.filter(r => r.success).length;
  const failed = results.length - passed;
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${results.length}`);
  
  return results;
}

// Run the tests
runAllTests().catch(console.error);