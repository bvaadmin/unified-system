#!/usr/bin/env node

/**
 * Test script to verify work queue priority ordering
 */

import pg from 'pg';
import dotenv from 'dotenv';

const { Client } = pg;
dotenv.config();

async function testPriorityOrdering() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('🔍 Testing Work Queue Priority Ordering\n');

    // Query all unassigned tasks to see ordering
    const result = await client.query(`
      SELECT 
        t.id,
        t.name,
        t.priority,
        t.created_at,
        CASE 
          WHEN t.priority = 'P0-Critical' THEN 1
          WHEN t.priority = 'P1-High' THEN 2  
          WHEN t.priority = 'P2-Medium' THEN 3
          WHEN t.priority = 'P3-Low' THEN 4
          ELSE 5
        END as priority_rank
      FROM project_mgmt.tasks t
      JOIN project_mgmt.projects p ON t.project_id = p.id
      WHERE t.assignee_id IS NULL 
        AND t.status IN ('To Do', 'Backlog')
        AND NOT t.is_archived
        AND NOT p.is_archived
        AND p.status IN ('Active', 'Planning')
      ORDER BY priority_rank ASC, t.created_at ASC
      LIMIT 15
    `);

    console.log('Tasks in priority order (as returned by query):');
    console.log('================================================');
    result.rows.forEach((task, index) => {
      console.log(`${index + 1}. [${task.priority}] ${task.name}`);
      console.log(`   Created: ${task.created_at}`);
      console.log(`   Priority Rank: ${task.priority_rank}`);
      console.log('');
    });

    // Check if P0 tasks come before P1 tasks
    let lastRank = 0;
    let isCorrectlyOrdered = true;
    for (const task of result.rows) {
      if (task.priority_rank < lastRank) {
        isCorrectlyOrdered = false;
        console.error(`❌ ERROR: ${task.priority} task found after higher priority!`);
      }
      lastRank = task.priority_rank;
    }

    if (isCorrectlyOrdered) {
      console.log('✅ Tasks are correctly ordered by priority (P0 before P1)');
    } else {
      console.log('❌ Tasks are NOT correctly ordered by priority!');
    }

    // Additional check: See if there's a different query being used somewhere
    console.log('\n🔍 Checking for alternative ordering issues...\n');
    
    // Check if tasks might be ordered by ID or other fields
    const altResult = await client.query(`
      SELECT id, name, priority, created_at
      FROM project_mgmt.tasks
      WHERE assignee_id IS NULL AND status IN ('To Do', 'Backlog')
      ORDER BY id ASC
      LIMIT 10
    `);
    
    console.log('Tasks ordered by ID (potential bug scenario):');
    altResult.rows.forEach((task, index) => {
      console.log(`${index + 1}. [${task.priority}] ${task.name} (ID: ${task.id})`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

testPriorityOrdering().catch(console.error);