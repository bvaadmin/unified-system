/**
 * Direct test of the Chapel Service Submission API v2 handler
 */
import handler from '../api/chapel/submit-service-v2.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testChapelAPIDirect() {
    console.log('Testing Chapel Service Submission API v2 directly...\n');

    // Test different application types
    const testCases = [
        {
            name: 'Wedding Application',
            data: {
                applicationType: 'wedding',
                serviceDate: '2025-09-20',
                serviceTime: '15:00:00',
                rehearsalDate: '2025-09-19',
                rehearsalTime: '18:00:00',
                memberName: 'Robert Smith',
                memberRelationship: 'Father of Bride',
                contactName: 'Emily Johnson',
                contactAddress: '123 Wedding Lane, Petoskey, MI 49770',
                contactPhone: '231-555-LOVE',
                contactEmail: 'emily.johnson@example.com',
                // Wedding-specific
                coupleNames: 'Emily Johnson & Michael Davis',
                guestCount: 150,
                brideArrivalTime: '15:30:00',
                weddingFee: 750
            }
        },
        {
            name: 'Memorial Service Application',
            data: {
                applicationType: 'memorial-funeral-service',
                serviceDate: '2025-03-15',
                serviceTime: '13:00:00',
                memberName: 'Mary Wilson',
                memberRelationship: 'Daughter',
                contactName: 'John Wilson',
                contactAddress: '456 Memorial Drive, Petoskey, MI 49770',
                contactPhone: '231-555-MEMO',
                contactEmail: 'john.wilson@example.com',
                // Memorial-specific
                deceasedName: 'Thomas Wilson',
                memorialGardenPlacement: true
            }
        },
        {
            name: 'Baptism Application',
            data: {
                applicationType: 'baptism',
                serviceDate: '2025-05-11',
                serviceTime: '10:30:00',
                memberName: 'Sarah Miller',
                memberRelationship: 'Mother',
                contactName: 'Sarah Miller',
                contactPhone: '231-555-BAPT',
                contactEmail: 'sarah.miller@example.com',
                // Baptism-specific
                baptismCandidateName: 'Grace Miller',
                parentsNames: 'Sarah Miller & David Miller',
                witnesses: 'Grandparents Tom & Helen Miller',
                baptismType: 'infant'
            }
        }
    ];

    for (const testCase of testCases) {
        console.log(`--- Testing ${testCase.name} ---`);

        // Mock request object
        const req = {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'origin': 'http://localhost:3000'
            },
            body: testCase.data
        };

        // Mock response object
        const res = {
            statusCode: null,
            headers: {},
            status(code) {
                this.statusCode = code;
                return this;
            },
            setHeader(name, value) {
                this.headers[name] = value;
                return this;
            },
            json(data) {
                console.log(`Response Status: ${this.statusCode}`);
                
                if (this.statusCode === 200) {
                    console.log('✅ Test passed!');
                    console.log(`Application ID: ${data.applicationId}`);
                    console.log(`Modern ID: ${data.modernId}`);
                    console.log(`Sync Status: ${data.syncStatus}`);
                    console.log(`Message: ${data.message}`);
                } else {
                    console.log('❌ Test failed!');
                    console.log('Error:', data.error);
                    console.log('Message:', data.message);
                }
                
                return this;
            }
        };

        try {
            await handler(req, res);
        } catch (error) {
            console.error('Handler error:', error.message);
        }

        console.log('\n');
    }
}

// Run the test
testChapelAPIDirect();