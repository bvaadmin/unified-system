#!/usr/bin/env node

/**
 * Comprehensive test for work queue priority ordering
 * Tests both the query logic and identifies any mismatches
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { AgentWorkQueue } from './agent-work-queue.js';

const { Client } = pg;
dotenv.config();

async function comprehensiveWorkQueueTest() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
  });

  const workQueue = new AgentWorkQueue();

  try {
    await client.connect();
    await workQueue.connect();
    
    console.log('🔍 Comprehensive Work Queue Testing\n');

    // Test 1: Check for progress/status mismatches
    console.log('Test 1: Checking for progress/status mismatches');
    console.log('================================================');
    
    const mismatchResult = await client.query(`
      SELECT id, task_id, name, status, progress, priority
      FROM project_mgmt.tasks
      WHERE (progress = 100 AND status != 'Done')
         OR (progress > 0 AND progress < 100 AND status IN ('Backlog', 'Done'))
      ORDER BY id
    `);
    
    if (mismatchResult.rows.length > 0) {
      console.log('❌ Found tasks with progress/status mismatch:');
      mismatchResult.rows.forEach(task => {
        console.log(`  - [${task.priority}] ${task.name}: Status=${task.status}, Progress=${task.progress}%`);
      });
    } else {
      console.log('✅ No progress/status mismatches found');
    }

    // Test 2: Compare work queue query with actual database state
    console.log('\n\nTest 2: Work Queue Algorithm Test');
    console.log('==================================');
    
    // Get next task using work queue
    const nextTask = await workQueue.getNextTask(['Algorithm', 'Work Queue']);
    console.log('Next task from work queue:', nextTask ? `${nextTask.task_name} (${nextTask.priority})` : 'None');

    // Manual query to verify
    const manualResult = await client.query(`
      SELECT t.id, t.name, t.priority, t.progress, t.status
      FROM project_mgmt.tasks t
      JOIN project_mgmt.projects p ON t.project_id = p.id
      WHERE t.assignee_id IS NULL 
        AND t.status IN ('To Do', 'Backlog')
        AND NOT t.is_archived
        AND NOT p.is_archived
        AND p.status IN ('Active', 'Planning')
        AND ('Algorithm' = ANY(t.components) OR 'Work Queue' = ANY(t.components))
      ORDER BY 
        CASE 
          WHEN t.priority = 'P0-Critical' THEN 1
          WHEN t.priority = 'P1-High' THEN 2  
          WHEN t.priority = 'P2-Medium' THEN 3
          WHEN t.priority = 'P3-Low' THEN 4
          ELSE 5
        END,
        t.created_at
      LIMIT 5
    `);

    console.log('\nTop 5 tasks that should be considered:');
    manualResult.rows.forEach((task, idx) => {
      console.log(`${idx + 1}. [${task.priority}] ${task.name} (Progress: ${task.progress}%, Status: ${task.status})`);
    });

    // Test 3: Verify priority ordering across all unassigned tasks
    console.log('\n\nTest 3: Priority Ordering Verification');
    console.log('======================================');
    
    const allTasksResult = await client.query(`
      SELECT priority, COUNT(*) as count,
        MIN(id) as first_task_id,
        MAX(id) as last_task_id
      FROM project_mgmt.tasks
      WHERE assignee_id IS NULL 
        AND status IN ('To Do', 'Backlog')
      GROUP BY priority
      ORDER BY 
        CASE 
          WHEN priority = 'P0-Critical' THEN 1
          WHEN priority = 'P1-High' THEN 2  
          WHEN priority = 'P2-Medium' THEN 3
          WHEN priority = 'P3-Low' THEN 4
          ELSE 5
        END
    `);

    console.log('Task distribution by priority:');
    allTasksResult.rows.forEach(row => {
      console.log(`  ${row.priority}: ${row.count} tasks (IDs ${row.first_task_id}-${row.last_task_id})`);
    });

    // Test 4: Check if the bug task should actually be picked up
    console.log('\n\nTest 4: Bug Task Analysis');
    console.log('=========================');
    
    const bugTaskResult = await client.query(`
      SELECT * FROM project_mgmt.tasks WHERE id = 31
    `);

    if (bugTaskResult.rows.length > 0) {
      const bugTask = bugTaskResult.rows[0];
      console.log(`Bug Task Details:`);
      console.log(`  Name: ${bugTask.name}`);
      console.log(`  Status: ${bugTask.status}`);
      console.log(`  Progress: ${bugTask.progress}%`);
      console.log(`  Priority: ${bugTask.priority}`);
      console.log(`  Components: ${bugTask.components.join(', ')}`);
      console.log(`  Assignee: ${bugTask.assignee_id || 'None'}`);
      
      if (bugTask.progress === 100 && bugTask.status !== 'Done') {
        console.log('\n❌ ISSUE FOUND: Task is 100% complete but not marked as Done!');
        console.log('   This is likely the real bug - completed tasks should have status="Done"');
      }
    }

    // Test 5: Fix the issue
    console.log('\n\nTest 5: Proposed Fix');
    console.log('====================');
    console.log('The issue appears to be that task 31 has progress=100 but status=Backlog.');
    console.log('This creates confusion about whether the task is actually complete.');
    console.log('\nProposed fixes:');
    console.log('1. Update task status to "Done" if progress is 100%');
    console.log('2. Add a constraint to ensure progress and status are consistent');
    console.log('3. Update the work queue to exclude tasks with progress=100 regardless of status');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
    await workQueue.close();
  }
}

comprehensiveWorkQueueTest().catch(console.error);