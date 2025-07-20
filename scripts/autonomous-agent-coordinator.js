#!/usr/bin/env node

/**
 * Autonomous Agent Coordinator
 * Orchestrates the complete autonomous development workflow
 */

import { AgentWorkQueue } from './agent-work-queue.js';
import { createPRFromTask } from './create-pr-from-task.js';
import { reviewPullRequest } from './claude-review-pr.js';
import { updatePMDFromPR } from './update-pmd-from-pr.js';
import pg from 'pg';
import dotenv from 'dotenv';

const { Client } = pg;
dotenv.config();

class AutonomousAgentCoordinator {
  constructor(options = {}) {
    this.agentId = options.agentId || 'claude-autonomous-agent';
    this.maxConcurrentTasks = options.maxConcurrentTasks || 2;
    this.capabilities = options.capabilities || ['API', 'Backend', 'Frontend', 'Database'];
    this.autoCreatePRs = options.autoCreatePRs || false;
    this.monitorInterval = options.monitorInterval || 300000; // 5 minutes
    
    this.workQueue = new AgentWorkQueue();
    this.isRunning = false;
    this.monitoringTimer = null;
  }

  async start() {
    console.log(`🤖 Starting Autonomous Agent Coordinator: ${this.agentId}`);
    console.log(`⚙️  Max concurrent tasks: ${this.maxConcurrentTasks}`);
    console.log(`🎯 Capabilities: ${this.capabilities.join(', ')}`);
    console.log(`🔄 Monitor interval: ${this.monitorInterval / 1000}s`);
    console.log(`📝 Auto-create PRs: ${this.autoCreatePRs ? 'Enabled' : 'Disabled'}\n`);

    this.isRunning = true;
    await this.workQueue.connect();

    // Start monitoring loop
    this.monitoringTimer = setInterval(() => {
      this.monitorWorkQueue().catch(error => {
        console.error('❌ Error in monitoring loop:', error.message);
      });
    }, this.monitorInterval);

    // Initial scan
    await this.monitorWorkQueue();

    console.log('✅ Autonomous agent coordinator started successfully');
  }

  async stop() {
    console.log('🛑 Stopping autonomous agent coordinator...');
    this.isRunning = false;
    
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }
    
    await this.workQueue.close();
    console.log('✅ Autonomous agent coordinator stopped');
  }

  async monitorWorkQueue() {
    if (!this.isRunning) return;

    try {
      console.log('\n🔍 Monitoring work queue...');

      // Check current workload
      const currentWorkload = await this.getCurrentWorkload();
      console.log(`📊 Current workload: ${currentWorkload}/${this.maxConcurrentTasks} tasks`);

      if (currentWorkload >= this.maxConcurrentTasks) {
        console.log('⏸️  At capacity, monitoring existing tasks');
        await this.monitorActiveTasks();
        return;
      }

      // Look for new tasks to assign
      const availableSlots = this.maxConcurrentTasks - currentWorkload;
      console.log(`🎯 Looking for ${availableSlots} new tasks...`);

      for (let i = 0; i < availableSlots; i++) {
        const nextTask = await this.workQueue.getNextTask(this.capabilities);
        
        if (!nextTask) {
          console.log('✅ No suitable tasks available');
          break;
        }

        console.log(`\n🎯 Found task: ${nextTask.task_name} (Priority: ${nextTask.priority})`);
        
        // Auto-assign task
        const assignedTask = await this.workQueue.assignTaskToAgent(nextTask.id, this.agentId);
        console.log(`✅ Assigned task ${assignedTask.id} to ${this.agentId}`);

        // Optionally create PR for the task
        if (this.autoCreatePRs) {
          try {
            console.log(`📝 Creating PR for task ${assignedTask.id}...`);
            const prResult = await createPRFromTask(assignedTask.id, {
              agentId: this.agentId,
              autoCommit: false
            });
            
            if (prResult.success) {
              console.log(`✅ PR created: ${prResult.prUrl}`);
            } else {
              console.log(`⚠️  PR creation failed: ${prResult.error}`);
            }
          } catch (prError) {
            console.error(`❌ Error creating PR: ${prError.message}`);
          }
        }
      }

    } catch (error) {
      console.error('❌ Error monitoring work queue:', error.message);
    }
  }

  async getCurrentWorkload() {
    const client = new Client({
      connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
      ssl: { rejectUnauthorized: false }
    });

    try {
      await client.connect();
      
      const result = await client.query(`
        SELECT COUNT(*) as active_tasks
        FROM project_mgmt.tasks t
        JOIN project_mgmt.resources r ON t.assignee_id = r.id
        WHERE (r.name = $1 OR r.email LIKE $2)
          AND t.status IN ('To Do', 'In Progress')
      `, [this.agentId, `%${this.agentId}%`]);

      return parseInt(result.rows[0].active_tasks);
    } finally {
      await client.end();
    }
  }

  async monitorActiveTasks() {
    const client = new Client({
      connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
      ssl: { rejectUnauthorized: false }
    });

    try {
      await client.connect();
      
      const result = await client.query(`
        SELECT t.id, t.name, t.status, t.progress, t.updated_at,
               p.project_code, p.name as project_name
        FROM project_mgmt.tasks t
        JOIN project_mgmt.projects p ON t.project_id = p.id
        JOIN project_mgmt.resources r ON t.assignee_id = r.id
        WHERE (r.name = $1 OR r.email LIKE $2)
          AND t.status IN ('To Do', 'In Progress')
        ORDER BY t.priority, t.updated_at
      `, [this.agentId, `%${this.agentId}%`]);

      if (result.rows.length > 0) {
        console.log('\n📋 Active Tasks:');
        result.rows.forEach((task, i) => {
          console.log(`${i + 1}. [${task.project_code}] ${task.name}`);
          console.log(`   Status: ${task.status} | Progress: ${task.progress || 0}%`);
          console.log(`   Updated: ${task.updated_at}`);
        });
      }
    } finally {
      await client.end();
    }
  }

  async generateWorkSummary() {
    const client = new Client({
      connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
      ssl: { rejectUnauthorized: false }
    });

    try {
      await client.connect();
      
      // Get agent statistics
      const stats = await client.query(`
        SELECT 
          COUNT(*) FILTER (WHERE t.status = 'Done') as completed_tasks,
          COUNT(*) FILTER (WHERE t.status = 'In Progress') as in_progress_tasks,
          COUNT(*) FILTER (WHERE t.status = 'To Do') as todo_tasks,
          SUM(t.estimated_hours) FILTER (WHERE t.status = 'Done') as completed_hours,
          SUM(t.estimated_hours) FILTER (WHERE t.status IN ('To Do', 'In Progress')) as remaining_hours,
          COUNT(DISTINCT t.project_id) as projects_involved
        FROM project_mgmt.tasks t
        JOIN project_mgmt.resources r ON t.assignee_id = r.id
        WHERE r.name = $1 OR r.email LIKE $2
      `, [this.agentId, `%${this.agentId}%`]);

      const summary = stats.rows[0];
      
      console.log('\n📊 Agent Work Summary:');
      console.log(`✅ Completed: ${summary.completed_tasks} tasks (${summary.completed_hours || 0} hours)`);
      console.log(`🚧 In Progress: ${summary.in_progress_tasks} tasks`);
      console.log(`📋 To Do: ${summary.todo_tasks} tasks`);
      console.log(`⏱️  Remaining: ${summary.remaining_hours || 0} estimated hours`);
      console.log(`🏗️  Projects: ${summary.projects_involved} involved`);

      return summary;
    } finally {
      await client.end();
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'start';
  
  const coordinator = new AutonomousAgentCoordinator({
    agentId: args.find(arg => arg.startsWith('--agent='))?.split('=')[1] || 'claude-autonomous-agent',
    maxConcurrentTasks: parseInt(args.find(arg => arg.startsWith('--max-tasks='))?.split('=')[1]) || 2,
    capabilities: args.find(arg => arg.startsWith('--capabilities='))?.split('=')[1]?.split(',') || ['API', 'Backend'],
    autoCreatePRs: args.includes('--auto-pr'),
    monitorInterval: parseInt(args.find(arg => arg.startsWith('--interval='))?.split('=')[1]) * 1000 || 300000
  });

  try {
    switch (command) {
      case 'start':
        await coordinator.start();
        
        // Keep running until interrupted
        process.on('SIGINT', async () => {
          console.log('\n\n🛑 Received interrupt signal');
          await coordinator.stop();
          process.exit(0);
        });
        
        // Keep process alive
        setInterval(() => {}, 1000);
        break;
        
      case 'summary':
        await coordinator.workQueue.connect();
        await coordinator.generateWorkSummary();
        await coordinator.workQueue.close();
        break;
        
      case 'monitor':
        await coordinator.start();
        await coordinator.monitorWorkQueue();
        await coordinator.stop();
        break;
        
      default:
        console.log(`
🤖 Autonomous Agent Coordinator Commands:

  start [options]
    Start continuous monitoring and task assignment
    
  monitor [options]  
    Run one monitoring cycle and exit
    
  summary [options]
    Show agent work summary and statistics

Options:
  --agent=name              Agent identifier (default: claude-autonomous-agent)
  --max-tasks=N             Maximum concurrent tasks (default: 2)
  --capabilities=api,db     Comma-separated capabilities (default: API,Backend)
  --auto-pr                 Automatically create PRs for assigned tasks
  --interval=seconds        Monitoring interval in seconds (default: 300)

Examples:
  node autonomous-agent-coordinator.js start --auto-pr --max-tasks=3
  node autonomous-agent-coordinator.js monitor --agent=claude-dev --capabilities=Frontend,API
  node autonomous-agent-coordinator.js summary --agent=claude-autonomous-agent
        `);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { AutonomousAgentCoordinator };