/**
 * Test script for the Memorial Garden Submission API v2
 */

async function testMemorialAPI() {
    const API_URL = 'http://localhost:3000/api/memorial/submit-garden-v2';

    const testData = {
        firstName: 'Jane',
        lastName: 'Smith',
        birthDate: '1940-03-15',
        deathDate: '2024-12-01',
        message: 'A beloved member of the Bay View community who will be deeply missed.',
        contactName: 'John Smith',
        contactEmail: 'john.smith@example.com',
        contactPhone: '231-555-1234',
        contactAddress: '456 Oak Street, Petoskey, MI 49770'
    };

    console.log('Testing Memorial Garden Submission API v2...\n');
    console.log('Sending request to:', API_URL);
    console.log('Test data:', JSON.stringify(testData, null, 2));

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Origin': 'http://localhost:3000'
            },
            body: JSON.stringify(testData)
        });

        const result = await response.json();

        console.log('\nResponse status:', response.status);
        console.log('Response data:', JSON.stringify(result, null, 2));

        if (response.ok) {
            console.log('\n✅ Test passed!');
            console.log('Memorial created successfully:');
            console.log(`  - Submission ID: ${result.submissionId}`);
            console.log(`  - Legacy ID: ${result.legacyId}`);
            console.log(`  - Modern ID: ${result.modernId}`);
            console.log(`  - Notion ID: ${result.notionId || 'Not created'}`);
            console.log(`  - Sync Status: ${result.syncStatus}`);
        } else {
            console.log('\n❌ Test failed!');
            console.log('Error:', result.error);
            console.log('Message:', result.message);
        }

    } catch (error) {
        console.error('\n❌ Request failed:', error.message);
    }
}

// Run the test
testMemorialAPI();