#!/usr/bin/env node

import 'dotenv/config';
import { sendTestEmail, sendMemorialConfirmation } from '../lib/email/sendgrid.js';

async function testSendGrid() {
  console.log('🔧 Testing SendGrid Configuration...\n');
  
  // Check if API key is configured
  if (!process.env.SENDGRID_API_KEY) {
    console.error('❌ SENDGRID_API_KEY not found in environment variables');
    console.log('\nTo set up SendGrid:');
    console.log('1. Sign up at https://sendgrid.com');
    console.log('2. Create an API key');
    console.log('3. Add to Vercel: vercel env add SENDGRID_API_KEY');
    console.log('4. Add to .env: SENDGRID_API_KEY=your-key-here');
    return;
  }
  
  console.log('✅ SendGrid API key found\n');
  
  // Get test email from command line or use default
  const testEmail = process.argv[2] || 'worshipservices@bayviewassociation.org';
  
  console.log(`📧 Sending test email to: ${testEmail}`);
  
  try {
    // Test 1: Simple test email
    console.log('\nTest 1: Sending simple test email...');
    await sendTestEmail(testEmail);
    console.log('✅ Test email sent successfully!\n');
    
    // Test 2: Sample memorial confirmation
    console.log('Test 2: Sending sample memorial confirmation...');
    await sendMemorialConfirmation({
      contactEmail: testEmail,
      contactName: 'Test User',
      submissionId: 'TEST-' + Date.now(),
      applicationType: 'immediate',
      feeAmount: 1500,
      isMember: false,
      persons: ['John Doe', 'Jane Smith']
    });
    console.log('✅ Memorial confirmation sent successfully!\n');
    
    console.log('🎉 All tests passed! SendGrid is configured correctly.');
    console.log('\nEmails sent to:', testEmail);
    console.log('Check your inbox (and spam folder) for the test emails.');
    
  } catch (error) {
    console.error('❌ Error sending email:', error.message);
    if (error.response) {
      console.error('SendGrid response:', error.response.body);
    }
    console.log('\nTroubleshooting:');
    console.log('1. Verify your SendGrid API key is correct');
    console.log('2. Check if your SendGrid account is verified');
    console.log('3. Ensure sender domain is authenticated in SendGrid');
  }
}

// Run the test
testSendGrid();