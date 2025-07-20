#!/usr/bin/env node

import { withDatabase } from '../lib/db.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function queryBacklogTasks() {
  try {
    const result = await withDatabase(async (client) => {
      const query = `
        SELECT 
          id,
          task_id,
          name,
          priority,
          status,
          components,
          assignee_id,
          due_date,
          story_points,
          acceptance_criteria,
          technical_notes,
          created_at,
          updated_at
        FROM project_mgmt.tasks 
        WHERE status = 'Backlog' 
        ORDER BY 
          CASE priority 
            WHEN 'Critical' THEN 1
            WHEN 'High' THEN 2
            WHEN 'Medium' THEN 3
            WHEN 'Low' THEN 4
            ELSE 5
          END,
          created_at;
      `;
      
      return await client.query(query);
    });

    console.log(`Found ${result.rows.length} tasks in backlog:\n`);
    
    result.rows.forEach((task, index) => {
      console.log(`${index + 1}. Task ID: ${task.task_id} (DB ID: ${task.id})`);
      console.log(`   Name: ${task.name}`);
      console.log(`   Priority: ${task.priority}`);
      console.log(`   Components: ${task.components ? task.components.join(', ') : 'Not specified'}`);
      console.log(`   Story Points: ${task.story_points || 'Not estimated'}`);
      console.log(`   Due Date: ${task.due_date ? task.due_date.toISOString().split('T')[0] : 'No due date'}`);
      console.log(`   Assignee ID: ${task.assignee_id || 'Unassigned'}`);
      if (task.acceptance_criteria) {
        console.log(`   Acceptance Criteria: ${task.acceptance_criteria.substring(0, 100)}${task.acceptance_criteria.length > 100 ? '...' : ''}`);
      }
      if (task.technical_notes) {
        console.log(`   Technical Notes: ${task.technical_notes.substring(0, 100)}${task.technical_notes.length > 100 ? '...' : ''}`);
      }
      console.log(`   Created: ${task.created_at.toISOString()}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error querying backlog tasks:', error.message);
    process.exit(1);
  }
}

queryBacklogTasks();