#!/usr/bin/env node

/**
 * Check Recent Form Submissions
 * 
 * This script checks for recent form submissions in the database
 * to verify the pipeline is working correctly.
 * 
 * Usage: npm run check-submissions
 */

import { createPgClient } from '../lib/db.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkRecentSubmissions() {
  const pgClient = createPgClient();
  
  try {
    await pgClient.connect();
    console.log('🔍 Checking recent form submissions...\n');
    
    // Check memorial garden submissions
    console.log('📋 MEMORIAL GARDEN SUBMISSIONS (Last 24 hours):');
    console.log('─'.repeat(50));
    
    const memorialResult = await pgClient.query(`
      SELECT 
        id,
        submission_id,
        first_name,
        last_name,
        email,
        created_at,
        notion_id,
        CASE 
          WHEN notion_id IS NOT NULL THEN 'Synced'
          ELSE 'Not Synced'
        END as sync_status
      FROM bayview.memorials
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    if (memorialResult.rows.length === 0) {
      console.log('No memorial garden submissions in the last 24 hours.\n');
    } else {
      memorialResult.rows.forEach(row => {
        console.log(`ID: ${row.id} | ${row.first_name} ${row.last_name}`);
        console.log(`   Email: ${row.email}`);
        console.log(`   Time: ${row.created_at.toLocaleString()}`);
        console.log(`   Notion: ${row.sync_status}`);
        console.log('');
      });
    }
    
    // Check chapel service submissions
    console.log('⛪ CHAPEL SERVICE APPLICATIONS (Last 24 hours):');
    console.log('─'.repeat(50));
    
    const chapelResult = await pgClient.query(`
      SELECT 
        sa.id,
        sa.service_type,
        sa.service_date,
        sa.service_time,
        sa.primary_contact_name,
        sa.primary_contact_email,
        sa.status,
        sa.created_at
      FROM crouse_chapel.service_applications sa
      WHERE sa.created_at >= NOW() - INTERVAL '24 hours'
      ORDER BY sa.created_at DESC
      LIMIT 10
    `);
    
    if (chapelResult.rows.length === 0) {
      console.log('No chapel service applications in the last 24 hours.\n');
    } else {
      chapelResult.rows.forEach(row => {
        console.log(`ID: ${row.id} | ${row.service_type.toUpperCase()}`);
        console.log(`   Contact: ${row.primary_contact_name} (${row.primary_contact_email})`);
        console.log(`   Service: ${row.service_date.toLocaleDateString()} at ${row.service_time}`);
        console.log(`   Status: ${row.status}`);
        console.log(`   Submitted: ${row.created_at.toLocaleString()}`);
        console.log('');
      });
    }
    
    // Summary statistics
    console.log('📊 SUMMARY STATISTICS:');
    console.log('─'.repeat(50));
    
    // Total memorial submissions
    const memorialTotal = await pgClient.query(`
      SELECT COUNT(*) as total
      FROM bayview.memorials
    `);
    console.log(`Total Memorial Garden Submissions: ${memorialTotal.rows[0].total}`);
    
    // Total chapel applications
    const chapelTotal = await pgClient.query(`
      SELECT COUNT(*) as total
      FROM crouse_chapel.service_applications
    `);
    console.log(`Total Chapel Service Applications: ${chapelTotal.rows[0].total}`);
    
    // Check for sync issues
    const unsyncedMemorials = await pgClient.query(`
      SELECT COUNT(*) as total
      FROM bayview.memorials
      WHERE notion_id IS NULL
      AND created_at >= NOW() - INTERVAL '24 hours'
    `);
    
    if (unsyncedMemorials.rows[0].total > 0) {
      console.log(`\n⚠️  WARNING: ${unsyncedMemorials.rows[0].total} memorial submissions not synced to Notion!`);
    }
    
    console.log('\n✅ Check complete!');
    
  } catch (error) {
    console.error('❌ Error checking submissions:', error.message);
    process.exit(1);
  } finally {
    await pgClient.end();
  }
}

// Run the check
checkRecentSubmissions();