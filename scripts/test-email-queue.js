#!/usr/bin/env node
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const API_URL = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}/api`
  : 'http://localhost:3000/api';

async function testEmailSubmission() {
  console.log('🧪 Testing Chapel Service Submission with Email...\n');
  
  // Test data for a wedding
  const testData = {
    formType: 'wedding',
    contactName: 'Test User',
    contactEmail: 'test@bayviewassociation.org', // Change to your email for testing
    contactPhone: '231-555-0100',
    contactAddress: '123 Test St, Petoskey, MI 49770',
    weddingDate: '2025-07-15',
    weddingTime: '14:00',
    coupleNames: 'John Doe and Jane Smith',
    isMember: 'yes',
    memberName: 'Test Member',
    memberRelationship: 'Friend',
    guestCount: '75',
    brideArrivalTime: '13:30',
    clergyName: 'Rev. Test Pastor',
    clergyAffiliation: 'Test Church',
    organist: 'yes',
    musicianNames: 'Test Violinist',
    stand_microphone: 'on',
    wireless_microphone: 'on',
    guest_book_stand: 'on',
    chair_setup: 'standard',
    policyAgreement: 'on',
    feeAgreement: 'on'
  };

  try {
    console.log('📤 Submitting test wedding application...');
    const response = await fetch(`${API_URL}/chapel/submit-service`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log('✅ Application submitted successfully!');
      console.log(`   Application ID: ${result.applicationId}`);
      console.log(`   Submission Date: ${result.submissionDate}`);
      if (result.notionId) {
        console.log(`   Notion ID: ${result.notionId}`);
      }
      
      console.log('\n📧 Email Status:');
      console.log('   Email queued for delivery');
      console.log('   Will be sent within 5 minutes by Vercel cron');
      console.log(`   Recipient: ${testData.contactEmail}`);
      
      // Now test the email batch processor
      console.log('\n🔄 Testing email batch processor...');
      const emailResponse = await fetch(`${API_URL}/email/send-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ batchSize: 10 })
      });
      
      if (emailResponse.ok) {
        const emailResult = await emailResponse.json();
        console.log('✅ Email batch processed:');
        console.log(`   Processed: ${emailResult.results.processed}`);
        console.log(`   Sent: ${emailResult.results.sent}`);
        console.log(`   Failed: ${emailResult.results.failed}`);
        
        if (emailResult.results.errors.length > 0) {
          console.log('\n⚠️  Email errors:');
          emailResult.results.errors.forEach(err => {
            console.log(`   - ${err.to}: ${err.error}`);
          });
        }
      } else {
        const error = await emailResponse.json();
        console.log('⚠️  Email batch processing failed:', error.message || error.error);
      }
      
    } else {
      console.log('❌ Submission failed:', result.message || result.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

console.log('📧 Email Notification Test Script');
console.log('==================================');
console.log(`API Endpoint: ${API_URL}`);
console.log(`SendGrid Configured: ${process.env.SENDGRID_API_KEY ? 'Yes' : 'No'}`);
console.log('\nNote: Make sure to:');
console.log('1. Run the migration first: npm run email-migration');
console.log('2. Update contactEmail in test data to your email');
console.log('3. Check your email inbox after running this test');
console.log('\n');

testEmailSubmission();