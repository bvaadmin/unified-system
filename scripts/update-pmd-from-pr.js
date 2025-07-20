#!/usr/bin/env node

/**
 * Update Project Management Database from Pull Request
 * Links GitHub PRs to PMD tasks and updates status based on PR state
 */

import pg from 'pg';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

const { Client } = pg;
dotenv.config();

async function updatePMDFromPR(prNumber) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log(`🔗 Checking PMD connections for PR #${prNumber}`);

    // Get PR information
    const prInfo = JSON.parse(execSync(`gh pr view ${prNumber} --json title,body,state,merged,author,labels`, { encoding: 'utf8' }));
    
    console.log(`PR Info: ${prInfo.title} by ${prInfo.author.login} - State: ${prInfo.state}`);

    // Look for task references in PR title and body
    const content = `${prInfo.title} ${prInfo.body || ''}`;
    const taskMatches = content.match(/(?:task|closes|fixes|implements)\s*#?(\d+)/gi);
    
    let linkedTasks = [];
    
    if (taskMatches) {
      for (const match of taskMatches) {
        const taskId = match.replace(/\D/g, ''); // Extract number
        if (taskId) {
          linkedTasks.push(parseInt(taskId));
        }
      }
    }

    // Also check for tasks that might be related by components or keywords
    const keywords = extractKeywords(content);
    const relatedTasks = await findRelatedTasks(client, keywords);
    
    // Combine explicit and related tasks
    const allTasks = [...new Set([...linkedTasks, ...relatedTasks])];
    
    if (allTasks.length === 0) {
      console.log('ℹ️  No PMD tasks found related to this PR');
      return { linkedTasks: 0, updated: 0 };
    }

    console.log(`🎯 Found ${allTasks.length} related PMD tasks:`, allTasks);

    let updatedCount = 0;

    for (const taskId of allTasks) {
      try {
        // Get current task status
        const taskResult = await client.query(
          'SELECT id, name, status, project_id FROM project_mgmt.tasks WHERE id = $1',
          [taskId]
        );

        if (taskResult.rows.length === 0) {
          console.log(`⚠️  Task ${taskId} not found in PMD`);
          continue;
        }

        const task = taskResult.rows[0];
        console.log(`📋 Task ${taskId}: ${task.name} (current: ${task.status})`);

        // Determine new status based on PR state
        let newStatus = task.status;
        let notes = `GitHub PR #${prNumber}: ${prInfo.title}`;

        switch (prInfo.state) {
          case 'OPEN':
            if (task.status === 'To Do' || task.status === 'Backlog') {
              newStatus = 'In Progress';
              notes += ' - Work started';
            }
            break;
            
          case 'MERGED':
            if (task.status !== 'Done') {
              newStatus = 'Done';
              notes += ' - Completed via merged PR';
            }
            break;
            
          case 'CLOSED':
            if (!prInfo.merged && task.status === 'In Progress') {
              newStatus = 'To Do';
              notes += ' - PR closed without merging, task reset';
            }
            break;
        }

        // Update task if status changed
        if (newStatus !== task.status) {
          await client.query(`
            UPDATE project_mgmt.tasks 
            SET status = $1, notes = $2, updated_at = CURRENT_TIMESTAMP,
                progress = CASE WHEN $1 = 'Done' THEN 100 WHEN $1 = 'In Progress' THEN 50 ELSE progress END
            WHERE id = $3
          `, [newStatus, notes, taskId]);

          console.log(`✅ Updated task ${taskId}: ${task.status} → ${newStatus}`);
          updatedCount++;
        } else {
          console.log(`ℹ️  Task ${taskId} status unchanged (${task.status})`);
        }

        // Add PR reference to task if not already present
        const existingNotes = task.notes || '';
        if (!existingNotes.includes(`PR #${prNumber}`)) {
          const updatedNotes = existingNotes ? `${existingNotes}\n${notes}` : notes;
          await client.query(
            'UPDATE project_mgmt.tasks SET notes = $1 WHERE id = $2',
            [updatedNotes, taskId]
          );
        }

      } catch (taskError) {
        console.error(`❌ Error updating task ${taskId}:`, taskError.message);
      }
    }

    // Log the PR tracking
    await logPRTracking(client, prNumber, prInfo, allTasks);

    console.log(`🎉 PMD update complete: ${updatedCount} tasks updated`);
    return { linkedTasks: allTasks.length, updated: updatedCount };

  } catch (error) {
    console.error('❌ Error updating PMD from PR:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

function extractKeywords(content) {
  const keywords = [];
  const lowercaseContent = content.toLowerCase();
  
  // Common component keywords
  const componentKeywords = [
    'api', 'database', 'frontend', 'backend', 'chapel', 'memorial', 
    'finance', 'payment', 'auth', 'config', 'migration', 'deployment',
    'analytics', 'portal', 'mobile', 'notification', 'email'
  ];
  
  for (const keyword of componentKeywords) {
    if (lowercaseContent.includes(keyword)) {
      keywords.push(keyword);
    }
  }
  
  return keywords;
}

async function findRelatedTasks(client, keywords) {
  if (keywords.length === 0) return [];
  
  try {
    // Search for tasks with matching components or keywords in name/description
    const placeholders = keywords.map((_, i) => `$${i + 1}`).join(', ');
    const result = await client.query(`
      SELECT DISTINCT id 
      FROM project_mgmt.tasks 
      WHERE status NOT IN ('Done', 'Archived')
        AND (
          components && ARRAY[${placeholders}]
          OR LOWER(name) ~ ANY(ARRAY[${placeholders}])
          OR LOWER(acceptance_criteria) ~ ANY(ARRAY[${placeholders}])
        )
      LIMIT 5
    `, [...keywords, ...keywords, ...keywords]);
    
    return result.rows.map(row => row.id);
  } catch (error) {
    console.warn('Warning: Could not search for related tasks:', error.message);
    return [];
  }
}

async function logPRTracking(client, prNumber, prInfo, linkedTasks) {
  try {
    // Simple tracking - could be expanded to a dedicated table
    console.log(`📝 PR #${prNumber} linked to tasks: ${linkedTasks.join(', ')}`);
  } catch (error) {
    console.warn('Warning: Could not log PR tracking:', error.message);
  }
}

// Main execution
async function main() {
  const prNumber = process.argv[2];
  
  if (!prNumber) {
    console.error('❌ Usage: node update-pmd-from-pr.js <pr_number>');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable required');
    process.exit(1);
  }

  try {
    const result = await updatePMDFromPR(prNumber);
    console.log('🎉 PMD update completed:', result);
    process.exit(0);
  } catch (error) {
    console.error('❌ PMD update failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { updatePMDFromPR };