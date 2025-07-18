const https = require('https');

// Test data for each form type
const testData = {
  wedding: {
    formType: 'wedding',
    data: {
      bayViewMember: 'John Smith',
      relationship: 'Member',
      contactName: 'Jane Doe',
      contactAddress: '123 Main St, Petoskey, MI 49770',
      contactPhone: '(231) 555-0123',
      contactEmail: 'janedoe@example.com',
      weddingDate: '2025-08-15',
      ceremonyTime: '14:00',
      rehearsalDate: '2025-08-14',
      rehearsalTime: '17:00',
      coupleNames: 'Jane Doe and John Smith',
      guestCount: '150',
      brideArrival: '13:30',
      dressingAtChapel: 'no',
      whyBayView: 'Family tradition',
      clergyName: 'Rev. Michael Johnson',
      denomination: 'Methodist',
      clergyAddress: '456 Church St',
      clergyPhone: '(231) 555-0456',
      clergyEmail: 'revjohnson@example.com',
      hasMusic: true,
      needsPiano: true,
      needsOrgan: false,
      musicianNames: 'Sarah Wilson - Pianist\nMary Thompson - Vocalist',
      standMic: true,
      wirelessMic: true,
      cdPlayer: false,
      communion: false,
      guestBookStand: true,
      ropedSeating: false,
      policyAgreement: true
    }
  },
  baptism: {
    formType: 'baptism',
    data: {
      bayViewMember: 'Mary Johnson',
      relationship: 'Grandmother',
      contactName: 'Sarah Johnson',
      contactAddress: '789 Oak St, Petoskey, MI 49770',
      contactPhone: '(231) 555-0789',
      contactEmail: 'sarah.johnson@example.com',
      serviceDate: '2025-07-20',
      serviceTime: '11:00',
      baptismPersonName: 'Emma Johnson',
      baptismDate: '2025-07-20',
      parentsNames: 'Sarah and David Johnson',
      witnesses: 'Mary Johnson, Robert Smith',
      baptismType: 'infant',
      clergyName: 'Rev. Patricia Williams',
      denomination: 'Presbyterian',
      clergyPhone: '(231) 555-0999',
      hasMusic: true,
      needsPiano: true,
      standMic: true,
      policyAgreement: true
    }
  },
  'memorial-funeral-service': {
    formType: 'memorial-funeral-service',
    data: {
      bayViewMember: 'Robert Brown',
      relationship: 'Son',
      contactName: 'Robert Brown Jr.',
      contactAddress: '321 Elm St, Petoskey, MI 49770',
      contactPhone: '(231) 555-0321',
      contactEmail: 'rbrown@example.com',
      serviceDate: '2025-07-25',
      serviceTime: '13:00',
      serviceType: 'memorial',
      deceasedName: 'Robert Brown Sr.',
      memorialGarden: 'yes',
      placementDate: '2025-07-26',
      placementTime: '10:00',
      clergyName: 'Rev. James Anderson',
      hasMusic: true,
      needsOrgan: true,
      musicianNames: 'Church Organist',
      standMic: true,
      policyAgreement: true
    }
  },
  'general-use': {
    formType: 'general-use',
    data: {
      bayViewMember: 'Susan Davis',
      relationship: 'Member',
      contactName: 'Thomas Wilson',
      contactAddress: '654 Pine St, Petoskey, MI 49770',
      contactPhone: '(231) 555-0654',
      contactEmail: 'twilson@example.com',
      serviceDate: '2025-09-10',
      serviceTime: '19:00',
      eventType: 'Concert',
      organizationName: 'Bay View Music Society',
      eventDescription: 'Annual classical music concert featuring local musicians',
      expectedAttendance: '200',
      setupTime: '17:00',
      cleanupTime: '22:00',
      hasMusic: true,
      needsPiano: true,
      needsOrgan: true,
      performSanctuary: true,
      additionalChairs: true,
      chairNumber: '20',
      chairPlacement: 'Front sanctuary area',
      standMic: true,
      wirelessMic: true,
      cdPlayer: true,
      policyAgreement: true
    }
  }
};

function makeRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

async function testForm(formName, testPayload) {
  console.log(`\n=== Testing ${formName} form ===`);
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/chapel/submit-service',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'http://localhost:3000'
    }
  };
  
  try {
    const response = await makeRequest(options, testPayload);
    
    if (response.status === 200 && response.data.success) {
      console.log(`✅ ${formName} submission successful!`);
      console.log(`   Application ID: ${response.data.applicationId}`);
      console.log(`   Submission Date: ${response.data.submissionDate}`);
    } else {
      console.log(`❌ ${formName} submission failed!`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${JSON.stringify(response.data, null, 2)}`);
    }
  } catch (error) {
    console.log(`❌ ${formName} submission error!`);
    console.log(`   Error: ${error.message}`);
  }
}

async function runTests() {
  console.log('Starting Chapel Forms API Tests...');
  console.log('Make sure the Vercel dev server is running (npm run dev)');
  
  // Test each form type
  for (const [formName, payload] of Object.entries(testData)) {
    await testForm(formName, payload);
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n=== Test Summary ===');
  console.log('All form types have been tested.');
  console.log('Check the database and Notion to verify data was saved correctly.');
}

// Run if called directly
if (require.main === module) {
  runTests();
}

module.exports = { testData, testForm };