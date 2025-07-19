#!/usr/bin/env node

/**
 * Real-Time Constraint Monitoring System
 * Continuously monitors for constraint violations and agent behavior
 */

import pg from 'pg';
import { execSync } from 'child_process';
import { ConstraintValidator } from './validate-constraints.js';
import dotenv from 'dotenv';

const { Client } = pg;
dotenv.config();

class ConstraintMonitor {
  constructor(options = {}) {
    this.monitorInterval = options.monitorInterval || 60000; // 1 minute
    this.alertThreshold = options.alertThreshold || 3; // violations before alert
    this.isRunning = false;
    this.violationHistory = [];
    this.monitoringTimer = null;
  }

  async start() {
    console.log('🔍 Starting constraint monitoring system...');
    this.isRunning = true;

    // Initial validation
    await this.performMonitoringCycle();

    // Set up periodic monitoring
    this.monitoringTimer = setInterval(() => {
      this.performMonitoringCycle().catch(error => {
        console.error('❌ Error in monitoring cycle:', error.message);
      });
    }, this.monitorInterval);

    console.log(`✅ Constraint monitor started (interval: ${this.monitorInterval / 1000}s)`);
  }

  async stop() {
    this.isRunning = false;
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }
    console.log('🛑 Constraint monitor stopped');
  }

  async performMonitoringCycle() {
    const timestamp = new Date().toISOString();
    console.log(`\n🔍 [${timestamp}] Running constraint monitoring cycle...`);

    try {
      // 1. Code constraint validation
      const validator = new ConstraintValidator();
      const codeValidation = await validator.validateAll();

      // 2. Database constraint monitoring
      const dbViolations = await this.monitorDatabaseConstraints();

      // 3. Agent behavior monitoring
      const agentViolations = await this.monitorAgentBehavior();

      // 4. System health checks
      const systemViolations = await this.monitorSystemHealth();

      // Combine all violations
      const allViolations = [
        ...codeValidation.violations,
        ...dbViolations,
        ...agentViolations,
        ...systemViolations
      ];

      // Record violations
      if (allViolations.length > 0) {
        this.recordViolations(allViolations);
        
        if (allViolations.length >= this.alertThreshold) {
          await this.triggerAlert(allViolations);
        }
      }

      console.log(`✅ Monitoring cycle complete: ${allViolations.length} violations found`);

    } catch (error) {
      console.error('❌ Error in monitoring cycle:', error.message);
      await this.recordSystemError(error);
    }
  }

  async monitorDatabaseConstraints() {
    const violations = [];
    const client = new Client({
      connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
      ssl: { rejectUnauthorized: false }
    });

    try {
      await client.connect();

      // Check for orphaned tasks (no valid project)
      const orphanedTasks = await client.query(`
        SELECT COUNT(*) as count
        FROM project_mgmt.tasks t
        LEFT JOIN project_mgmt.projects p ON t.project_id = p.id
        WHERE p.id IS NULL OR p.is_archived = true
      `);

      if (parseInt(orphanedTasks.rows[0].count) > 0) {
        violations.push({
          type: 'ORPHANED_TASKS',
          message: `${orphanedTasks.rows[0].count} tasks reference archived/missing projects`,
          severity: 'error'
        });
      }

      // Check for overallocated agents
      const overallocatedAgents = await client.query(`
        SELECT r.name, COUNT(*) as task_count
        FROM project_mgmt.tasks t
        JOIN project_mgmt.resources r ON t.assignee_id = r.id
        WHERE t.status IN ('To Do', 'In Progress')
          AND r.role = 'AI Agent'
        GROUP BY r.id, r.name
        HAVING COUNT(*) > 2
      `);

      for (const agent of overallocatedAgents.rows) {
        violations.push({
          type: 'AGENT_OVERALLOCATION',
          message: `Agent ${agent.name} has ${agent.task_count} active tasks (max: 2)`,
          severity: 'warning'
        });
      }

      // Check for blocked tasks assigned to agents
      const blockedAssignedTasks = await client.query(`
        SELECT t.id, t.name, r.name as agent_name
        FROM project_mgmt.tasks t
        JOIN project_mgmt.resources r ON t.assignee_id = r.id
        JOIN project_mgmt.blocker_relationships br ON t.id = br.blocked_task_id
        JOIN project_mgmt.blockers b ON br.blocker_id = b.id
        WHERE b.status = 'Active'
          AND t.status IN ('To Do', 'In Progress')
          AND r.role = 'AI Agent'
      `);

      for (const task of blockedAssignedTasks.rows) {
        violations.push({
          type: 'BLOCKED_TASK_ASSIGNED',
          message: `Task ${task.id} (${task.name}) assigned to ${task.agent_name} but has active blockers`,
          severity: 'error'
        });
      }

      // Check for stale in-progress tasks
      const staleTasks = await client.query(`
        SELECT t.id, t.name, r.name as agent_name, t.updated_at
        FROM project_mgmt.tasks t
        JOIN project_mgmt.resources r ON t.assignee_id = r.id
        WHERE t.status = 'In Progress'
          AND t.updated_at < NOW() - INTERVAL '24 hours'
          AND r.role = 'AI Agent'
      `);

      for (const task of staleTasks.rows) {
        violations.push({
          type: 'STALE_TASK',
          message: `Task ${task.id} (${task.name}) in progress for >24h without update`,
          severity: 'warning'
        });
      }

    } finally {
      await client.end();
    }

    return violations;
  }

  async monitorAgentBehavior() {
    const violations = [];

    try {
      // Check recent Git activity for patterns
      const recentCommits = execSync('git log --oneline --since="1 hour ago" --author="Claude"', { encoding: 'utf8' });
      
      if (recentCommits.trim()) {
        const commitLines = recentCommits.trim().split('\n');
        
        // Check for excessive commit frequency
        if (commitLines.length > 10) {
          violations.push({
            type: 'EXCESSIVE_COMMITS',
            message: `${commitLines.length} commits in last hour - possible unstable development`,
            severity: 'warning'
          });
        }

        // Check commit message patterns
        for (const commit of commitLines) {
          if (!commit.includes(':')) {
            violations.push({
              type: 'INVALID_COMMIT_FORMAT',
              message: `Commit "${commit}" doesn't follow "Type: Description" format`,
              severity: 'warning'
            });
          }
        }
      }

      // Check for uncommented code changes
      const uncommentedChanges = execSync('git diff --cached', { encoding: 'utf8' });
      if (uncommentedChanges.includes('console.log') && !uncommentedChanges.includes('// DEBUG')) {
        violations.push({
          type: 'DEBUG_CODE_UNCOMMITTED',
          message: 'Staged changes contain console.log without DEBUG comment',
          severity: 'warning'
        });
      }

    } catch (error) {
      // Git commands might fail in certain environments, that's OK
      console.warn('Warning: Could not check Git activity:', error.message);
    }

    return violations;
  }

  async monitorSystemHealth() {
    const violations = [];

    try {
      // Check database connectivity
      const client = new Client({
        connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
        ssl: { rejectUnauthorized: false }
      });

      const startTime = Date.now();
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      const responseTime = Date.now() - startTime;

      if (responseTime > 5000) { // 5 seconds
        violations.push({
          type: 'SLOW_DATABASE',
          message: `Database response time: ${responseTime}ms (>5000ms threshold)`,
          severity: 'warning'
        });
      }

      // Check environment variables
      const requiredEnvVars = ['DATABASE_URL', 'NOTION_API_KEY', 'ADMIN_TOKEN'];
      for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
          violations.push({
            type: 'MISSING_ENV_VAR',
            message: `Required environment variable ${envVar} not set`,
            severity: 'error'
          });
        }
      }

      // Check disk space (if available)
      try {
        const diskUsage = execSync('df -h .', { encoding: 'utf8' });
        const usageMatch = diskUsage.match(/(\d+)%/);
        if (usageMatch && parseInt(usageMatch[1]) > 90) {
          violations.push({
            type: 'LOW_DISK_SPACE',
            message: `Disk usage at ${usageMatch[1]}% (>90% threshold)`,
            severity: 'warning'
          });
        }
      } catch (error) {
        // Disk check might not be available, that's OK
      }

    } catch (error) {
      violations.push({
        type: 'SYSTEM_HEALTH_CHECK_FAILED',
        message: `System health check failed: ${error.message}`,
        severity: 'error'
      });
    }

    return violations;
  }

  recordViolations(violations) {
    const timestamp = new Date().toISOString();
    
    for (const violation of violations) {
      this.violationHistory.push({
        ...violation,
        timestamp
      });
    }

    // Keep only last 100 violations
    if (this.violationHistory.length > 100) {
      this.violationHistory = this.violationHistory.slice(-100);
    }

    console.log(`📝 Recorded ${violations.length} violations`);
  }

  async recordSystemError(error) {
    const timestamp = new Date().toISOString();
    console.error(`📝 [${timestamp}] System error recorded: ${error.message}`);
    
    // Could also log to PMD or external monitoring system
    this.violationHistory.push({
      type: 'SYSTEM_ERROR',
      message: error.message,
      severity: 'error',
      timestamp
    });
  }

  async triggerAlert(violations) {
    console.log(`🚨 ALERT: ${violations.length} constraint violations detected!`);
    
    const criticalViolations = violations.filter(v => v.severity === 'error');
    const warnings = violations.filter(v => v.severity === 'warning');

    console.log(`❌ Critical: ${criticalViolations.length}`);
    console.log(`⚠️  Warnings: ${warnings.length}`);

    // Log to console (could also send to Slack, email, etc.)
    console.log('\n🚨 CONSTRAINT VIOLATIONS:');
    violations.forEach(v => {
      const icon = v.severity === 'error' ? '❌' : '⚠️';
      console.log(`${icon} [${v.type}] ${v.message}`);
    });

    // Could implement additional alerting here:
    // - Send to Slack webhook
    // - Email notifications
    // - Update PMD with blocker
    // - Create GitHub issue
  }

  getViolationSummary() {
    const recent = this.violationHistory.filter(v => 
      new Date() - new Date(v.timestamp) < 3600000 // Last hour
    );

    const typeCount = {};
    recent.forEach(v => {
      typeCount[v.type] = (typeCount[v.type] || 0) + 1;
    });

    return {
      totalViolations: this.violationHistory.length,
      recentViolations: recent.length,
      violationsByType: typeCount
    };
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'start';

  const monitor = new ConstraintMonitor({
    monitorInterval: parseInt(args.find(arg => arg.startsWith('--interval='))?.split('=')[1]) * 1000 || 60000,
    alertThreshold: parseInt(args.find(arg => arg.startsWith('--threshold='))?.split('=')[1]) || 3
  });

  try {
    switch (command) {
      case 'start':
        await monitor.start();
        
        // Keep running until interrupted
        process.on('SIGINT', async () => {
          console.log('\n🛑 Received interrupt signal');
          await monitor.stop();
          process.exit(0);
        });
        
        // Keep process alive
        setInterval(() => {}, 1000);
        break;

      case 'check':
        await monitor.performMonitoringCycle();
        const summary = monitor.getViolationSummary();
        console.log('\n📊 Violation Summary:', summary);
        break;

      default:
        console.log(`
🔍 Constraint Monitor Commands:

  start [--interval=seconds] [--threshold=count]
    Start continuous constraint monitoring
    
  check
    Run one monitoring cycle and show summary

Options:
  --interval=N    Monitoring interval in seconds (default: 60)
  --threshold=N   Alert threshold for violations (default: 3)

Examples:
  node constraint-monitor.js start --interval=30 --threshold=5
  node constraint-monitor.js check
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

export { ConstraintMonitor };