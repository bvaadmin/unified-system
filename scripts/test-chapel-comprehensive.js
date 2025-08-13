#!/usr/bin/env node

import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const BASE_URL = 'https://unified-system.vercel.app/api/chapel';

// Test 1: Check Chapel Availability
async function testChapelAvailability() {
  console.log('🧪 Test 1: Chapel availability check...\n');
  
  const testDate = '2025-08-20';
  const testTime = '14:00';
  
  try {
    const response = await fetch(`${BASE_URL}/check-availability?date=${testDate}&time=${testTime}`);
    console.log(`📊 Status: ${response.status}`);
    const result = await response.json();
    
    if (response.status === 200) {
      console.log('✅ Availability check successful!');
      console.log(`   - Date: ${testDate} at ${testTime}`);
      console.log(`   - Available: ${result.available}`);
      console.log(`   - Conflicts: ${result.conflicts?.length || 0}`);
      if (result.suggestedTimes) {
        console.log(`   - Suggested times: ${result.suggestedTimes.slice(0, 3).join(', ')}`);
      }
    } else {
      console.log('❌ Availability check failed:', result.error);
    }
    
    console.log('');
    return result;
    
  } catch (error) {
    console.error(`💥 Availability check error: ${error.message}\n`);
    return { success: false, error: error.message };
  }
}

// Test 2: Submit Wedding Service
async function testWeddingSubmission() {
  console.log('🧪 Test 2: Wedding service submission...\n');
  
  const weddingData = {
    formType: 'wedding',
    serviceDate: '2025-09-15',
    serviceTime: '15:00',
    applicantName: 'Emily Johnson',
    applicantEmail: 'emily.johnson@test.com',
    applicantPhone: '231-555-0201',
    partnerName: 'Michael Davis',
    memberSponsor: 'Dr. Sarah Wilson',
    memberRelationship: 'Family friend',
    estimatedGuests: 75,
    brideMaidenName: 'Johnson',
    brideArrivalTime: '14:30',
    reception: 'Bay View Inn',
    rehearsal: '2025-09-14 at 17:00',
    clergy: 'Rev. Thompson',
    music: 'Organ and piano',
    flowers: 'White roses and lilies',
    photography: 'Professional photographer',
    specialRequests: 'Unity candle ceremony',
    policyAcknowledgment: true
  };
  
  return await submitChapelTest('Wedding', weddingData);
}

// Test 3: Submit Memorial Service
async function testMemorialSubmission() {
  console.log('🧪 Test 3: Memorial service submission...\n');
  
  const memorialData = {
    formType: 'memorial-funeral-service',
    serviceDate: '2025-08-25',
    serviceTime: '11:00',
    applicantName: 'Robert Wilson',
    applicantEmail: 'robert.wilson@test.com',
    applicantPhone: '231-555-0202',
    deceasedName: 'Eleanor Wilson',
    memberSponsor: 'Margaret Thompson',
    memberRelationship: 'Neighbor',
    estimatedGuests: 50,
    memorialGardenPlacement: true,
    clergy: 'Rev. Anderson',
    music: 'Hymns',
    flowers: 'Mixed seasonal arrangements',
    specialRequests: 'Reception following service',
    policyAcknowledgment: true
  };
  
  return await submitChapelTest('Memorial', memorialData);
}

async function submitChapelTest(testName, testData) {
  try {
    console.log(`📤 Sending ${testName} submission...`);
    const response = await fetch(`${BASE_URL}/submit-service`, {
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
      console.log(`✅ ${testName} submission successful!`);
      console.log(`   - Application ID: ${result.applicationId}`);
      console.log(`   - Service Date: ${testData.serviceDate}`);
      console.log(`   - Service Time: ${testData.serviceTime}`);
      console.log(`   - Next Steps: ${result.nextSteps?.length || 0} items`);
    } else {
      console.log(`❌ ${testName} submission failed: ${result.error || result.message}`);
    }
    
    console.log('');
    return result;
    
  } catch (error) {
    console.error(`💥 ${testName} submission error: ${error.message}\n`);
    return { success: false, error: error.message };
  }
}

// Test 4: Get Chapel Applications
async function testGetApplications() {
  console.log('🧪 Test 4: Get chapel applications...\n');
  
  try {
    const response = await fetch(`${BASE_URL}/get-applications?type=wedding&status=pending`);
    console.log(`📊 Status: ${response.status}`);
    const result = await response.json();
    
    if (response.status === 200) {
      console.log('✅ Get applications successful!');
      console.log(`   - Applications found: ${result.applications?.length || 0}`);
      if (result.applications?.length > 0) {
        console.log(`   - Sample: ${result.applications[0].applicant_name} on ${result.applications[0].service_date}`);
      }
    } else {
      console.log('❌ Get applications failed:', result.error);
    }
    
    console.log('');
    return result;
    
  } catch (error) {
    console.error(`💥 Get applications error: ${error.message}\n`);
    return { success: false, error: error.message };
  }
}

// Run all chapel tests
async function runChapelTests() {
  console.log('🏛️ Running comprehensive Chapel Service API tests...\n');
  console.log('==================================================\n');
  
  const results = [];
  
  results.push(await testChapelAvailability());
  results.push(await testWeddingSubmission());
  results.push(await testMemorialSubmission());
  results.push(await testGetApplications());
  
  // Summary
  console.log('📋 CHAPEL TESTS SUMMARY');
  console.log('=======================');
  const passed = results.filter(r => r.success !== false).length;
  const failed = results.length - passed;
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${results.length}`);
  
  return results;
}

// Run the tests
runChapelTests().catch(console.error);