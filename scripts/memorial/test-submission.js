// Test script for dual database submission
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testSubmission() {
  const testData = {
    properties: {
      'Submission ID': 'MG-TEST-' + Date.now(),
      'date:Submission Date:start': '2025-07-17',
      'Status': 'Submitted',
      'Application Type': 'Payment for immediate placement of ashes',
      'Bay View Member': 'Yes',
      'Contact Name': 'John Test',
      'Contact Phone': '555-123-4567',
      'Contact Email': 'john@test.com',
      'Contact Address': '123 Test St, Test City, MI 12345',
      'Deceased Name': 'Jane Test',
      'Member Name': 'John Test',
      'Member Relationship': 'Spouse',
      'Bay View History': 'Long-time summer resident',
      'Personal History JSON': JSON.stringify({
        firstName: 'Jane',
        lastName: 'Test',
        middleName: '',
        maidenName: 'Smith',
        birthDate: '1940-01-01',
        deathDate: '2023-12-01',
        birthPlace: 'Detroit, MI',
        homeAddress: '123 Test St, Test City, MI 12345',
        bayviewAddress: '456 Bay View Ave, Petoskey, MI 49770',
        motherName: 'Mary Smith',
        fatherName: 'Robert Smith',
        bayviewHistory: 'Active in community events'
      }),
      'Fee Amount': 400.00,
      'Policy Agreement': '__YES__',
      'date:Service Date:start': '2025-08-15',
      'Celebrant Requested': 'Yes - Request Bay View celebrant'
    }
  };

  try {
    console.log('Testing dual database submission...');
    
    const response = await fetch('https://bay-view-memorial-api.vercel.app/api/submit-memorial-garden', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();
    
    console.log('Response Status:', response.status);
    console.log('Response Data:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n✅ SUCCESS!');
      console.log('Submission ID:', result.submissionId);
      console.log('PostgreSQL ID:', result.pgId);
      console.log('Notion ID:', result.notionId);
      console.log('Sync Status:', result.syncStatus);
      console.log('Message:', result.message);
    } else {
      console.log('\n❌ FAILED!');
      console.log('Error:', result.error);
    }
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

testSubmission();