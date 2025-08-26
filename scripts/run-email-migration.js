#!/usr/bin/env node
import { Client } from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const { DATABASE_URL } = process.env;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function runMigration() {
  const client = new Client({
    connectionString: DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('📧 Connecting to database...');
    await client.connect();
    
    // Read migration SQL
    const migrationPath = join(__dirname, 'migrations', '010_email_notifications.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    console.log('🔧 Running email notification migration...');
    await client.query(migrationSQL);
    
    console.log('✅ Email notification system initialized successfully!');
    console.log('\nCreated:');
    console.log('  - Extended crouse_chapel.notifications table with email queue columns');
    console.log('  - communications.email_queue table for general emails');
    console.log('  - communications.email_templates table with default templates');
    console.log('  - Helper functions for email queue management');
    console.log('\nNext steps:');
    console.log('  1. Deploy to Vercel: npm run deploy');
    console.log('  2. Verify SendGrid API key in environment');
    console.log('  3. Test with: npm run test-email-submission');
    console.log('  4. Monitor queue at: /api/email/send-batch');
    console.log('\nEmail processing:');
    console.log('  - Automatic processing every 5 minutes via Vercel cron');
    console.log('  - Manual trigger: POST to /api/email/send-batch');
    console.log('  - Retry logic: 5 min, 30 min, 2 hours');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.detail) {
      console.error('Details:', error.detail);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();