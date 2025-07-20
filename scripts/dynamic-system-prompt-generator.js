#!/usr/bin/env node

/**
 * Dynamic System Prompt Generator
 * Creates persona-aware, context-compressed system prompts for optimal agent performance
 */

import pg from 'pg';
import dotenv from 'dotenv';

const { Client } = pg;
dotenv.config();

class DynamicSystemPromptGenerator {
  constructor() {
    this.client = new Client({
      connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
      ssl: { rejectUnauthorized: false }
    });
  }

  async connect() {
    await this.client.connect();
  }

  async close() {
    await this.client.end();
  }

  async generateAgentSystemPrompt(taskId, personaId = null, options = {}) {
    const {
      includeArchitecturePatterns = true,
      includeBayViewContext = true,
      compressionLevel = 'high', // 'standard', 'high', 'maximum'
      responseFormat = 'production' // 'detailed', 'production'
    } = options;

    // 1. Get task context with enhanced information
    const taskContext = await this.getTaskContext(taskId);
    if (!taskContext) {
      throw new Error(`Task ${taskId} not found`);
    }

    // 2. Select or recommend persona
    const persona = personaId 
      ? await this.getPersonaById(personaId)
      : await this.recommendPersonaForTask(taskId);

    if (!persona) {
      throw new Error(`No suitable persona found for task ${taskId}`);
    }

    // 3. Get relevant architecture patterns
    const architectureContext = includeArchitecturePatterns 
      ? await this.getArchitectureContext(taskId, persona.required_patterns)
      : null;

    // 4. Get Bay View transformation context
    const bayViewContext = includeBayViewContext 
      ? await this.getBayViewContext()
      : null;

    // 5. Generate compressed, persona-aware system prompt
    return this.assembleSystemPrompt({
      taskContext,
      persona,
      architectureContext,
      bayViewContext,
      compressionLevel,
      responseFormat
    });
  }

  async getTaskContext(taskId) {
    const result = await this.client.query(`
      SELECT 
        t.*,
        p.name as project_name,
        p.project_code,
        p.phase,
        p.description as project_description,
        p.success_criteria as project_success_criteria,
        
        -- Related tasks for context
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
      LEFT JOIN project_mgmt.tasks rt ON p.id = rt.project_id AND rt.status IN ('To Do', 'In Progress', 'Done')
      WHERE t.id = $1
      GROUP BY t.id, p.id
    `, [taskId]);

    return result.rows[0] || null;
  }

  async getPersonaById(personaId) {
    const result = await this.client.query(`
      SELECT * FROM project_mgmt.agent_personas WHERE id = $1
    `, [personaId]);

    return result.rows[0] || null;
  }

  async recommendPersonaForTask(taskId) {
    const result = await this.client.query(`
      SELECT 
        persona_id,
        persona_name,
        display_name,
        domain_focus,
        expertise_level,
        match_score,
        pattern_compatibility,
        system_prompt_prefix,
        domain_assumptions,
        response_style
      FROM project_mgmt.v_persona_task_recommendations 
      WHERE task_id = $1 
        AND pattern_compatibility = true
      ORDER BY match_score DESC, expertise_level DESC
      LIMIT 1
    `, [taskId]);

    if (result.rows.length === 0) {
      return null;
    }

    // Get full persona details
    return await this.getPersonaById(result.rows[0].persona_id);
  }

  async getArchitectureContext(taskId, requiredPatterns = []) {
    const result = await this.client.query(`
      SELECT 
        arch.required_patterns,
        arch.implementation_guide,
        arch.consequences
      FROM project_mgmt.v_agent_architecture_context arch 
      WHERE arch.task_id = $1
    `, [taskId]);

    return result.rows[0] || null;
  }

  async getBayViewContext() {
    const result = await this.client.query(`
      SELECT * FROM project_mgmt.v_agent_briefing LIMIT 1
    `);

    return result.rows[0] || null;
  }

  assembleSystemPrompt({
    taskContext,
    persona,
    architectureContext,
    bayViewContext,
    compressionLevel,
    responseFormat
  }) {
    const sections = [];

    // 1. Persona identity and specialization
    sections.push(`# Agent Identity
${persona.system_prompt_prefix}

## Domain Expertise
- **Focus**: ${persona.domain_focus}
- **Level**: ${persona.expertise_level}
- **Primary Components**: ${persona.primary_components.join(', ')}
${persona.secondary_components.length > 0 ? `- **Secondary Components**: ${persona.secondary_components.join(', ')}` : ''}`);

    // 2. Task-specific context (compressed based on persona assumptions)
    if (compressionLevel === 'maximum' && persona.assumption_shortcuts.length > 0) {
      sections.push(`## Current Task
**${taskContext.name}** (${taskContext.priority})
- Components: ${taskContext.components.join(', ')}
- Estimated: ${taskContext.estimated_hours}h
- Acceptance: ${taskContext.acceptance_criteria}`);
    } else {
      sections.push(`## Current Task
**Task**: ${taskContext.name}
**Priority**: ${taskContext.priority}
**Type**: ${taskContext.task_type}
**Project**: ${taskContext.project_code} - ${taskContext.project_name}
**Components**: ${taskContext.components.join(', ')}
**Estimated Hours**: ${taskContext.estimated_hours}
**Acceptance Criteria**: ${taskContext.acceptance_criteria}`);
    }

    // 3. Domain assumptions (for token efficiency)
    if (persona.domain_assumptions && compressionLevel !== 'standard') {
      sections.push(`## Assumed Knowledge
${persona.domain_assumptions}`);
    }

    // 4. Architecture patterns (compressed for specialists)
    if (architectureContext && architectureContext.required_patterns) {
      if (compressionLevel === 'maximum' && persona.required_patterns.length > 0) {
        sections.push(`## Required Patterns
- ${architectureContext.required_patterns.join(', ')}
- Implementation guides available in your domain expertise`);
      } else {
        sections.push(`## Architecture Requirements
**Required Patterns**: ${architectureContext.required_patterns.join(', ')}

**Implementation Guide**:
${architectureContext.implementation_guide}

**Violation Consequences**: ${architectureContext.consequences}`);
      }
    }

    // 5. Bay View context (heritage-aware, compressed for specialists)
    if (bayViewContext) {
      if (persona.heritage_awareness_level === 'Master' && compressionLevel === 'maximum') {
        sections.push(`## Bay View Context
${bayViewContext.heritage} | ${bayViewContext.scope} | ${bayViewContext.mission}`);
      } else {
        sections.push(`## Bay View Context
${bayViewContext.heritage}
${bayViewContext.scope}
${bayViewContext.mission}
${bayViewContext.constraints}
${bayViewContext.member_impact}`);
      }
    }

    // 6. Cultural sensitivity (persona-specific)
    if (persona.cultural_sensitivity) {
      sections.push(`## Cultural Sensitivity
${persona.cultural_sensitivity}`);
    }

    // 7. Response guidelines (persona-optimized)
    sections.push(`## Response Style
${persona.response_style}

**Vocabulary Focus**: ${persona.vocabulary_focus}
**Token Efficiency**: ${persona.token_efficiency_level}
**Code Style**: ${persona.preferred_code_style}`);

    // 8. Efficiency shortcuts for maximum compression
    if (compressionLevel === 'maximum' && persona.assumption_shortcuts.length > 0) {
      sections.push(`## Efficiency Shortcuts
${persona.assumption_shortcuts.map(shortcut => `- ${shortcut}`).join('\n')}`);
    }

    return sections.join('\n\n');
  }

  async generatePersonaRecommendations(taskId) {
    const result = await this.client.query(`
      SELECT 
        persona_id,
        persona_name,
        display_name,
        domain_focus,
        expertise_level,
        match_score,
        pattern_compatibility
      FROM project_mgmt.v_persona_task_recommendations 
      WHERE task_id = $1 
      ORDER BY match_score DESC, expertise_level DESC
      LIMIT 5
    `, [taskId]);

    return result.rows;
  }

  async trackPromptEffectiveness(taskId, personaId, metrics) {
    const {
      tokenEfficiencyAchieved,
      responseQualityScore,
      contextEffectivenessScore,
      notes
    } = metrics;

    await this.client.query(`
      INSERT INTO project_mgmt.agent_persona_assignments (
        task_id, persona_id, resource_id, token_efficiency_achieved, 
        response_quality_score, context_effectiveness_score, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      taskId, 
      personaId, 
      11, // Claude agent resource ID
      tokenEfficiencyAchieved,
      responseQualityScore,
      contextEffectivenessScore,
      notes
    ]);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  
  const generator = new DynamicSystemPromptGenerator();
  
  try {
    await generator.connect();
    
    switch (command) {
      case 'generate':
        const taskId = parseInt(args[1]);
        const personaId = args[2] ? parseInt(args[2]) : null;
        
        if (!taskId) {
          console.error('❌ Usage: generate <task_id> [persona_id]');
          process.exit(1);
        }
        
        const systemPrompt = await generator.generateAgentSystemPrompt(taskId, personaId, {
          compressionLevel: args.includes('--max-compression') ? 'maximum' : 'high'
        });
        
        console.log('🎭 Generated System Prompt:\n');
        console.log(systemPrompt);
        break;
        
      case 'recommend':
        const recTaskId = parseInt(args[1]);
        if (!recTaskId) {
          console.error('❌ Usage: recommend <task_id>');
          process.exit(1);
        }
        
        const recommendations = await generator.generatePersonaRecommendations(recTaskId);
        console.log('🎯 Persona Recommendations:\n');
        recommendations.forEach((rec, i) => {
          console.log(`${i + 1}. ${rec.display_name} (${rec.domain_focus})`);
          console.log(`   Match Score: ${rec.match_score}/10`);
          console.log(`   Expertise: ${rec.expertise_level}`);
          console.log(`   Pattern Compatible: ${rec.pattern_compatibility}\n`);
        });
        break;
        
      case 'test':
        // Test with Task 24 (cottage leaseholders import)
        console.log('🧪 Testing persona-aware prompt generation...\n');
        
        const testPrompt = await generator.generateAgentSystemPrompt(24, null, {
          compressionLevel: 'maximum',
          responseFormat: 'production'
        });
        
        console.log('📋 Task 24 System Prompt (Maximum Compression):\n');
        console.log(testPrompt);
        break;
        
      default:
        console.log(`
🎭 Dynamic System Prompt Generator

Commands:
  generate <task_id> [persona_id] [--max-compression]
    Generate persona-aware system prompt for task
    
  recommend <task_id>
    Show persona recommendations for task
    
  test
    Test prompt generation with sample task
    
Examples:
  node dynamic-system-prompt-generator.js generate 24
  node dynamic-system-prompt-generator.js recommend 28
  node dynamic-system-prompt-generator.js test
        `);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await generator.close();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { DynamicSystemPromptGenerator };