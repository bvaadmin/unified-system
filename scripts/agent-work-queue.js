#!/usr/bin/env node

/**
 * Autonomous Agent Work Queue Monitor
 * Queries PMD for high-priority tasks and enables agent self-assignment
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { DynamicSystemPromptGenerator } from './dynamic-system-prompt-generator.js';

const { Client } = pg;
dotenv.config();

class AgentWorkQueue {
  constructor() {
    this.client = new Client({
      connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
      ssl: { rejectUnauthorized: false }
    });
    this.promptGenerator = new DynamicSystemPromptGenerator();
  }

  async connect() {
    await this.client.connect();
    await this.promptGenerator.connect();
    console.log('🤖 Agent Work Queue Monitor connected to PMD');
  }

  async getNextTask(agentCapabilities = []) {
    // Get highest priority unassigned task that matches agent capabilities
    const query = `
      SELECT 
        t.id,
        t.project_id,
        t.name as task_name,
        t.priority,
        t.task_type,
        t.status,
        t.components,
        t.estimated_hours,
        t.acceptance_criteria,
        p.name as project_name,
        p.project_code,
        p.phase,
        p.description as project_description,
        -- Context for decision making
        CASE 
          WHEN t.priority = 'P0-Critical' THEN 1
          WHEN t.priority = 'P1-High' THEN 2  
          WHEN t.priority = 'P2-Medium' THEN 3
          WHEN t.priority = 'P3-Low' THEN 4
          ELSE 5
        END as priority_rank,
        -- Dependencies check
        COALESCE(
          array_agg(DISTINCT bt.title) FILTER (WHERE bt.id IS NOT NULL),
          ARRAY[]::text[]
        ) as blocking_issues
      FROM project_mgmt.tasks t
      JOIN project_mgmt.projects p ON t.project_id = p.id
      LEFT JOIN project_mgmt.blocker_relationships br ON t.id = br.blocked_task_id
      LEFT JOIN project_mgmt.blockers bt ON br.blocker_id = bt.id AND bt.status = 'Active'
      WHERE t.assignee_id IS NULL 
        AND t.status IN ('To Do', 'Backlog')
        AND NOT t.is_archived
        AND NOT p.is_archived
        AND p.status IN ('Active', 'Planning')
        ${agentCapabilities.length > 0 ? 
          `AND (${agentCapabilities.map((cap, i) => `$${i + 1} = ANY(t.components)`).join(' OR ')})` 
          : ''}
      GROUP BY t.id, p.id
      HAVING COUNT(bt.id) FILTER (WHERE bt.status = 'Active') = 0  -- No active blockers
      ORDER BY priority_rank ASC, t.created_at ASC
      LIMIT 1
    `;

    const params = agentCapabilities.length > 0 ? agentCapabilities : [];
    const result = await this.client.query(query, params);
    
    return result.rows[0] || null;
  }

  async assignTaskToAgent(taskId, agentId, agentName = 'Claude Code Agent') {
    // Validate assignment constraints first
    await this.validateTaskAssignment(taskId, agentId);
    
    // Get or create agent resource
    let agentResourceId = agentId;
    
    if (typeof agentId === 'string') {
      const agentResult = await this.client.query(
        'SELECT id FROM project_mgmt.resources WHERE email = $1 OR name = $1',
        [agentId]
      );
      
      if (agentResult.rows.length === 0) {
        // Create agent resource
        const newAgent = await this.client.query(
          'INSERT INTO project_mgmt.resources (name, email, resource_type, is_active) VALUES ($1, $2, $3, $4) RETURNING id',
          [agentName, `${agentId}@ai.agent`, 'External', true]
        );
        agentResourceId = newAgent.rows[0].id;
      } else {
        agentResourceId = agentResult.rows[0].id;
      }
    }

    // Assign task
    const result = await this.client.query(`
      UPDATE project_mgmt.tasks 
      SET assignee_id = $1, status = 'To Do', updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [agentResourceId, taskId]);

    return result.rows[0];
  }

  async validateTaskAssignment(taskId, agentId) {
    // Check agent workload
    const workloadResult = await this.client.query(`
      SELECT COUNT(*) as active_tasks
      FROM project_mgmt.tasks t
      JOIN project_mgmt.resources r ON t.assignee_id = r.id
      WHERE (r.id::text = $1 OR r.email = $1 OR r.name = $1)
        AND t.status IN ('To Do', 'In Progress')
    `, [agentId]);

    const activeCount = parseInt(workloadResult.rows[0].active_tasks);
    if (activeCount >= 2) { // Max concurrent tasks
      throw new Error(`Agent ${agentId} at capacity (${activeCount}/2 tasks)`);
    }

    // Check task constraints
    const taskResult = await this.client.query(`
      SELECT t.*, p.phase, p.status as project_status
      FROM project_mgmt.tasks t
      JOIN project_mgmt.projects p ON t.project_id = p.id
      WHERE t.id = $1
    `, [taskId]);

    if (taskResult.rows.length === 0) {
      throw new Error(`Task ${taskId} not found`);
    }

    const task = taskResult.rows[0];

    // Validate task is assignable
    if (task.status === 'Done' || task.status === 'Archived') {
      throw new Error(`Task ${taskId} is ${task.status} and cannot be assigned`);
    }

    if (task.project_status === 'Archived' || task.project_status === 'Cancelled') {
      throw new Error(`Task ${taskId} belongs to ${task.project_status} project`);
    }

    // Check for active blockers
    const blockerResult = await this.client.query(`
      SELECT COUNT(*) as blocker_count
      FROM project_mgmt.blocker_relationships br
      JOIN project_mgmt.blockers b ON br.blocker_id = b.id
      WHERE br.blocked_task_id = $1 AND b.status = 'Active'
    `, [taskId]);

    if (parseInt(blockerResult.rows[0].blocker_count) > 0) {
      throw new Error(`Task ${taskId} has active blockers and cannot be assigned`);
    }

    console.log(`✅ Task ${taskId} assignment validation passed`);
  }

  async updateTaskProgress(taskId, status, progress = null, notes = null) {
    const updateFields = ['status = $2', 'updated_at = CURRENT_TIMESTAMP'];
    const params = [taskId, status];
    let paramCount = 2;

    if (progress !== null) {
      updateFields.push(`progress = $${++paramCount}`);
      params.push(progress);
    }

    if (notes) {
      updateFields.push(`notes = $${++paramCount}`);
      params.push(notes);
    }

    const result = await this.client.query(`
      UPDATE project_mgmt.tasks 
      SET ${updateFields.join(', ')}
      WHERE id = $1
      RETURNING *
    `, params);

    return result.rows[0];
  }

  async getTaskContext(taskId) {
    // Get comprehensive context for a task to help with implementation
    const result = await this.client.query(`
      SELECT 
        t.*,
        p.name as project_name,
        p.project_code,
        p.phase,
        p.description as project_description,
        p.success_criteria as project_success_criteria,
        -- Related tasks in same project
        json_agg(DISTINCT 
          jsonb_build_object(
            'id', rt.id,
            'name', rt.name,
            'status', rt.status,
            'priority', rt.priority
          )
        ) FILTER (WHERE rt.id IS NOT NULL AND rt.id != t.id) as related_tasks,
        -- Project milestones
        json_agg(DISTINCT 
          jsonb_build_object(
            'name', m.name,
            'due_date', m.due_date,
            'status', m.status
          )
        ) FILTER (WHERE m.id IS NOT NULL) as project_milestones
      FROM project_mgmt.tasks t
      JOIN project_mgmt.projects p ON t.project_id = p.id
      LEFT JOIN project_mgmt.tasks rt ON p.id = rt.project_id
      LEFT JOIN project_mgmt.milestones m ON p.id = m.project_id
      WHERE t.id = $1
      GROUP BY t.id, p.id
    `, [taskId]);

    return result.rows[0];
  }

  async getAgentCapabilities(agentId) {
    // Analyze what components/technologies an agent has worked with
    const result = await this.client.query(`
      SELECT 
        UNNEST(t.components) as component,
        COUNT(*) as experience_count,
        AVG(CASE WHEN t.status = 'Done' THEN 1.0 ELSE 0.0 END) as success_rate
      FROM project_mgmt.tasks t
      JOIN project_mgmt.resources r ON t.assignee_id = r.id
      WHERE r.id::text = $1 OR r.email = $1 OR r.name = $1
      GROUP BY component
      HAVING COUNT(*) >= 2  -- At least 2 tasks with this component
      ORDER BY success_rate DESC, experience_count DESC
    `, [agentId]);

    return result.rows.map(row => row.component);
  }

  async monitorWorkQueue(options = {}) {
    const {
      agentId = 'claude-code-agent',
      autoAssign = false,
      capabilities = ['API', 'Backend', 'Frontend', 'Database'],
      maxTasks = 1
    } = options;

    console.log(`\n🔍 Monitoring work queue for agent: ${agentId}`);
    console.log(`📋 Agent capabilities: ${capabilities.join(', ')}`);
    console.log(`⚙️  Auto-assign: ${autoAssign ? 'Enabled' : 'Disabled'}\n`);

    // Get current agent workload
    const currentTasks = await this.client.query(`
      SELECT COUNT(*) as active_tasks
      FROM project_mgmt.tasks t
      JOIN project_mgmt.resources r ON t.assignee_id = r.id
      WHERE (r.id::text = $1 OR r.email = $1 OR r.name = $1)
        AND t.status IN ('To Do', 'In Progress')
    `, [agentId]);

    const activeTaskCount = parseInt(currentTasks.rows[0].active_tasks);
    console.log(`📊 Current active tasks: ${activeTaskCount}/${maxTasks}`);

    if (activeTaskCount >= maxTasks) {
      console.log('⏸️  Agent at capacity. No new tasks assigned.');
      return null;
    }

    // Find next suitable task
    const nextTask = await this.getNextTask(capabilities);
    
    if (!nextTask) {
      console.log('✅ No suitable tasks found in work queue.');
      return null;
    }

    console.log('\n🎯 Next Available Task:');
    console.log(`   ID: ${nextTask.id}`);
    console.log(`   Project: ${nextTask.project_code} - ${nextTask.project_name}`);
    console.log(`   Task: ${nextTask.task_name}`);
    console.log(`   Priority: ${nextTask.priority}`);
    console.log(`   Type: ${nextTask.task_type}`);
    console.log(`   Components: ${nextTask.components.join(', ')}`);
    console.log(`   Estimated Hours: ${nextTask.estimated_hours}`);
    
    if (nextTask.blocking_issues.length > 0) {
      console.log(`   ⚠️  Blockers: ${nextTask.blocking_issues.join(', ')}`);
    }

    if (autoAssign) {
      console.log(`\n🤖 Auto-assigning task ${nextTask.id} to ${agentId}...`);
      
      try {
        const assignedTask = await this.assignTaskToAgent(nextTask.id, agentId);
        console.log(`✅ Task assigned successfully!`);
        console.log(`   Status: ${assignedTask.status}`);
        console.log(`   Updated: ${assignedTask.updated_at}`);
        
        return assignedTask;
      } catch (error) {
        console.error(`❌ Failed to assign task: ${error.message}`);
        return null;
      }
    }

    return nextTask;
  }

  async generateImplementationPlan(taskId, personaId = null, options = {}) {
    // Generate persona-aware system prompt for maximum context compression
    const systemPrompt = await this.promptGenerator.generateAgentSystemPrompt(
      taskId, 
      personaId, 
      { 
        compressionLevel: 'maximum', 
        responseFormat: 'production',
        ...options 
      }
    );

    // Get persona recommendations for task
    const personaRecommendations = await this.promptGenerator.generatePersonaRecommendations(taskId);

    // Enhanced query with architecture and transformation context (for backward compatibility)
    const enhancedContext = await this.client.query(`
      SELECT 
        t.*,
        p.name as project_name,
        p.project_code,
        p.phase,
        p.description as project_description,
        p.success_criteria as project_success_criteria,
        
        -- Architecture context
        arch.required_patterns,
        arch.implementation_guide as architecture_guide,
        arch.consequences as architecture_consequences,
        
        -- Transformation briefing
        brief.heritage,
        brief.scope,
        brief.mission,
        brief.constraints,
        brief.member_impact,
        
        -- Related tasks
        json_agg(DISTINCT 
          jsonb_build_object(
            'id', rt.id,
            'name', rt.name,
            'status', rt.status,
            'priority', rt.priority
          )
        ) FILTER (WHERE rt.id IS NOT NULL AND rt.id != t.id) as related_tasks
        
      FROM project_mgmt.tasks t
      JOIN project_mgmt.projects p ON t.project_id = p.id
      LEFT JOIN project_mgmt.v_agent_architecture_context arch ON t.id = arch.task_id
      LEFT JOIN project_mgmt.v_agent_briefing brief ON true
      LEFT JOIN project_mgmt.tasks rt ON p.id = rt.project_id
      WHERE t.id = $1
      GROUP BY t.id, p.id, arch.required_patterns, arch.implementation_guide, 
               arch.consequences, brief.heritage, brief.scope, brief.mission, 
               brief.constraints, brief.member_impact
    `, [taskId]);
    
    if (enhancedContext.rows.length === 0) {
      throw new Error(`Task ${taskId} not found`);
    }

    const context = enhancedContext.rows[0];

    // Generate comprehensive implementation context with persona awareness
    return {
      // NEW: Persona-optimized system prompt
      systemPrompt,
      personaRecommendations,
      
      // Enhanced task context
      task: {
        id: context.id,
        name: context.name,
        priority: context.priority,
        type: context.task_type,
        components: context.components,
        acceptanceCriteria: context.acceptance_criteria,
        estimatedHours: context.estimated_hours
      },
      project: {
        code: context.project_code,
        name: context.project_name,
        phase: context.phase,
        description: context.project_description,
        successCriteria: context.project_success_criteria
      },
      architecture: {
        requiredPatterns: context.required_patterns || [],
        implementationGuide: context.architecture_guide || '',
        consequences: context.architecture_consequences || ''
      },
      bayViewContext: {
        heritage: context.heritage || '',
        scope: context.scope || '',
        mission: context.mission || '',
        constraints: context.constraints || '',
        memberImpact: context.member_impact || ''
      },
      context: {
        relatedTasks: context.related_tasks || [],
        suggestedApproach: this.generateApproachSuggestions(context)
      }
    };
  }

  generateApproachSuggestions(context) {
    const suggestions = [];
    
    // Based on task type
    switch (context.task_type) {
      case 'Feature':
        suggestions.push('Implement feature with tests and documentation');
        suggestions.push('Follow existing code patterns in the project');
        break;
      case 'Bug':
        suggestions.push('Identify root cause before implementing fix');
        suggestions.push('Add regression tests to prevent recurrence');
        break;
      case 'Configuration':
        suggestions.push('Update configuration with backward compatibility');
        suggestions.push('Document configuration changes');
        break;
      case 'Migration':
        suggestions.push('Implement data validation and rollback procedures');
        suggestions.push('Test migration with sample data first');
        break;
    }

    // Based on components
    if (context.components.includes('API')) {
      suggestions.push('Follow RESTful API design principles');
      suggestions.push('Include proper error handling and validation');
    }
    
    if (context.components.includes('Database')) {
      suggestions.push('Use migrations for schema changes');
      suggestions.push('Consider performance implications of queries');
    }

    return suggestions;
  }

  async close() {
    await this.client.end();
    await this.promptGenerator.close();
    console.log('🔌 Agent Work Queue Monitor disconnected');
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'monitor';
  
  const workQueue = new AgentWorkQueue();
  
  try {
    await workQueue.connect();
    
    switch (command) {
      case 'monitor':
        await workQueue.monitorWorkQueue({
          autoAssign: args.includes('--auto-assign'),
          agentId: args.find(arg => arg.startsWith('--agent='))?.split('=')[1] || 'claude-code-agent',
          capabilities: args.find(arg => arg.startsWith('--capabilities='))?.split('=')[1]?.split(',') || ['API', 'Backend']
        });
        break;
        
      case 'next':
        const nextTask = await workQueue.getNextTask(['API', 'Backend', 'Frontend']);
        if (nextTask) {
          console.log('📋 Next Task:', JSON.stringify(nextTask, null, 2));
        } else {
          console.log('✅ No tasks available');
        }
        break;
        
      case 'assign':
        const taskId = parseInt(args[1]);
        const agentId = args[2] || 'claude-code-agent';
        if (!taskId) {
          console.error('❌ Usage: assign <task_id> [agent_id]');
          process.exit(1);
        }
        const assigned = await workQueue.assignTaskToAgent(taskId, agentId);
        console.log('✅ Task assigned:', assigned.name);
        break;
        
      case 'plan':
        const planTaskId = parseInt(args[1]);
        const planPersonaId = args[2] ? parseInt(args[2]) : null;
        if (!planTaskId) {
          console.error('❌ Usage: plan <task_id> [persona_id]');
          process.exit(1);
        }
        const plan = await workQueue.generateImplementationPlan(planTaskId, planPersonaId);
        
        console.log('🎭 PERSONA-AWARE IMPLEMENTATION PLAN\n');
        console.log('📋 SYSTEM PROMPT:');
        console.log(plan.systemPrompt);
        console.log('\n🎯 PERSONA RECOMMENDATIONS:');
        plan.personaRecommendations.forEach((rec, i) => {
          console.log(`${i + 1}. ${rec.display_name} (Score: ${rec.match_score})`);
        });
        console.log('\n📊 TASK CONTEXT:');
        console.log(JSON.stringify(plan.task, null, 2));
        break;
        
      default:
        console.log(`
🤖 Agent Work Queue Commands:

  monitor [--auto-assign] [--agent=id] [--capabilities=api,db]
    Monitor work queue and optionally auto-assign tasks
    
  next
    Show next available task
    
  assign <task_id> [agent_id]
    Assign specific task to agent
    
  plan <task_id>
    Generate implementation plan for task
    
Examples:
  node agent-work-queue.js monitor --auto-assign --agent=claude-ai
  node agent-work-queue.js assign 1 claude-code-agent
  node agent-work-queue.js plan 1
        `);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await workQueue.close();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { AgentWorkQueue };