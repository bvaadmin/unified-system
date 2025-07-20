#!/usr/bin/env node

/**
 * Create Pull Request from PMD Task
 * Automatically generates PRs for tasks with implementation plans
 */

import pg from 'pg';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
import { AgentWorkQueue } from './agent-work-queue.js';

const { Client } = pg;
dotenv.config();

async function createPRFromTask(taskId, options = {}) {
  const {
    agentId = 'claude-code-agent',
    branchPrefix = 'feature/task',
    autoCommit = false
  } = options;

  const client = new Client({
    connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log(`🚀 Creating PR for task ${taskId}...`);

    // Get task details and implementation plan
    const workQueue = new AgentWorkQueue();
    await workQueue.connect();

    const implementationPlan = await workQueue.generateImplementationPlan(taskId);
    
    if (!implementationPlan) {
      throw new Error(`Task ${taskId} not found or inaccessible`);
    }

    const task = implementationPlan.task;
    const project = implementationPlan.project;

    console.log(`📋 Task: ${task.name}`);
    console.log(`🏗️  Project: ${project.code} - ${project.name}`);

    // Create feature branch
    const branchName = `${branchPrefix}-${taskId}-${slugify(task.name)}`;
    
    try {
      execSync(`git checkout -b ${branchName}`, { stdio: 'inherit' });
      console.log(`✅ Created branch: ${branchName}`);
    } catch (error) {
      console.log(`⚠️  Branch ${branchName} may already exist, switching to it`);
      execSync(`git checkout ${branchName}`, { stdio: 'inherit' });
    }

    // Generate PR title and body
    const prTitle = `${task.type}: ${task.name}`;
    const prBody = generatePRBody(implementationPlan);

    // Check if there are changes to commit
    const statusOutput = execSync('git status --porcelain', { encoding: 'utf8' });
    
    if (autoCommit && statusOutput.trim()) {
      // Stage and commit changes
      execSync('git add .', { stdio: 'inherit' });
      execSync(`git commit -m "${prTitle}\n\nImplements task #${taskId} from ${project.code}"`, { stdio: 'inherit' });
      console.log('✅ Changes committed');
    }

    // Push branch
    try {
      execSync(`git push -u origin ${branchName}`, { stdio: 'inherit' });
      console.log('✅ Branch pushed to remote');
    } catch (pushError) {
      console.warn('⚠️  Could not push branch, may need to create changes first');
    }

    // Create pull request
    const prCommand = `gh pr create --title "${prTitle}" --body "${prBody.replace(/"/g, '\\"')}" --head ${branchName} --base main`;
    
    try {
      const prOutput = execSync(prCommand, { encoding: 'utf8' });
      const prUrl = prOutput.trim();
      console.log(`✅ Pull request created: ${prUrl}`);

      // Update task status in PMD
      await client.query(`
        UPDATE project_mgmt.tasks 
        SET status = 'In Progress', 
            notes = COALESCE(notes, '') || '\nPR created: ' || $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [prUrl, taskId]);

      await workQueue.close();

      return {
        taskId,
        branchName,
        prUrl,
        success: true
      };

    } catch (prError) {
      console.error('❌ Failed to create PR:', prError.message);
      
      // Still return branch info even if PR creation failed
      return {
        taskId,
        branchName,
        prUrl: null,
        success: false,
        error: prError.message
      };
    }

  } catch (error) {
    console.error('❌ Error creating PR from task:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

function generatePRBody(implementationPlan) {
  const { task, project, context } = implementationPlan;
  
  return `## Summary

Implements **${task.name}** for project **${project.name}** (${project.code}).

**Task Type:** ${task.type}  
**Priority:** ${task.priority}  
**Components:** ${task.components.join(', ')}  
**Estimated Hours:** ${task.estimatedHours}

## Description

${project.description}

## Acceptance Criteria

${task.acceptanceCriteria}

## Implementation Approach

${context.suggestedApproach.map(suggestion => `- ${suggestion}`).join('\n')}

## Related Context

**Project Phase:** ${project.phase}  
**Success Criteria:** ${project.successCriteria}

${context.relatedTasks?.length > 0 ? `
**Related Tasks:**
${context.relatedTasks.map(t => `- ${t.name} (${t.status})`).join('\n')}
` : ''}

${context.milestones?.length > 0 ? `
**Project Milestones:**
${context.milestones.map(m => `- ${m.name} - ${m.due_date} (${m.status})`).join('\n')}
` : ''}

## Testing

- [ ] Unit tests pass
- [ ] Integration tests pass  
- [ ] Manual testing completed
- [ ] Security review (if applicable)
- [ ] Performance review (if applicable)

## Checklist

- [ ] Code follows project conventions
- [ ] Documentation updated
- [ ] Error handling implemented
- [ ] Security considerations addressed
- [ ] Performance implications considered

---

🤖 This PR was automatically created from PMD Task #${task.id} using Claude Code automation.

Closes #${task.id}`;
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const taskId = parseInt(args[0]);
  
  if (!taskId) {
    console.error('❌ Usage: node create-pr-from-task.js <task_id> [--auto-commit] [--branch-prefix=custom]');
    console.error('');
    console.error('Examples:');
    console.error('  node create-pr-from-task.js 42');
    console.error('  node create-pr-from-task.js 42 --auto-commit');
    console.error('  node create-pr-from-task.js 42 --branch-prefix=feature/analytics');
    process.exit(1);
  }

  const options = {
    autoCommit: args.includes('--auto-commit'),
    branchPrefix: args.find(arg => arg.startsWith('--branch-prefix='))?.split('=')[1] || 'feature/task'
  };

  try {
    const result = await createPRFromTask(taskId, options);
    
    if (result.success) {
      console.log('\n🎉 PR Creation Summary:');
      console.log(`📋 Task: ${taskId}`);
      console.log(`🌿 Branch: ${result.branchName}`);
      console.log(`🔗 PR URL: ${result.prUrl}`);
      console.log('\n✅ Task status updated to "In Progress"');
    } else {
      console.log('\n⚠️  PR Creation Partial Success:');
      console.log(`📋 Task: ${taskId}`);
      console.log(`🌿 Branch: ${result.branchName}`);
      console.log(`❌ PR Error: ${result.error}`);
      console.log('\nBranch created but PR failed. You can create it manually or fix the issue and retry.');
    }

  } catch (error) {
    console.error('❌ PR creation failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { createPRFromTask };