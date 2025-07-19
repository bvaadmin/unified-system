/**
 * Direct test of the Memorial Garden Submission API v2 handler
 */
import handler from '../api/memorial/submit-garden-v2.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testMemorialAPIDirect() {
    console.log('Testing Memorial Garden Submission API v2 directly...\n');

    // Mock request object
    const req = {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'origin': 'http://localhost:3000'
        },
        body: {
            firstName: 'Jane',
            lastName: 'Smith',
            birthDate: '1940-03-15',
            deathDate: '2024-12-01',
            message: 'A beloved member of the Bay View community who will be deeply missed.',
            contactName: 'John Smith',
            contactEmail: 'john.smith@example.com',
            contactPhone: '231-555-1234',
            contactAddress: '456 Oak Street, Petoskey, MI 49770'
        }
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
            console.log('Response Headers:', this.headers);
            console.log('Response Body:', JSON.stringify(data, null, 2));
            
            if (this.statusCode === 200) {
                console.log('\n✅ Test passed!');
            } else {
                console.log('\n❌ Test failed!');
            }
            
            return this;
        }
    };

    try {
        console.log('Calling handler...');
        await handler(req, res);
        console.log('Handler completed');
    } catch (error) {
        console.error('Handler error:', error);
    }
}

// Run the test
testMemorialAPIDirect();