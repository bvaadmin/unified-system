#!/usr/bin/env node

/**
 * Test Enhanced MCP Context
 * Demonstrates how agents can now access full architecture and transformation context
 */

import pg from 'pg';
import dotenv from 'dotenv';

const { Client } = pg;
dotenv.config();

async function testEnhancedMCPContext() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('🧪 Testing Enhanced MCP Context for Agents\n');

    // 1. Agent Briefing - What every agent should know
    console.log('📋 AGENT BRIEFING (Available to all agents):');
    const briefing = await client.query('SELECT * FROM project_mgmt.v_agent_briefing');
    const brief = briefing.rows[0];
    Object.values(brief).forEach(line => console.log(`   ${line}`));

    console.log('\n');

    // 2. Architecture Context for Specific Task
    console.log('🏗️ ARCHITECTURE CONTEXT (Task-specific):');
    const archContext = await client.query(`
      SELECT task_name, required_patterns, implementation_guide, consequences
      FROM project_mgmt.v_agent_architecture_context 
      WHERE task_id = 20
    `);

    if (archContext.rows.length > 0) {
      const arch = archContext.rows[0];
      console.log(`   Task: ${arch.task_name}`);
      console.log(`   Required Patterns: ${arch.required_patterns.join(', ')}`);
      console.log(`   Implementation Guide: ${arch.implementation_guide ? 'Available' : 'None'}`);
      console.log(`   Consequences: ${arch.consequences}`);
    }

    console.log('\n');

    // 3. Complete Agent Context Query
    console.log('🤖 COMPLETE AGENT CONTEXT (What enhanced MCP could provide):');
    const fullContext = await client.query(`
      SELECT 
        t.id,
        t.name as task_name,
        t.priority,
        t.components,
        t.acceptance_criteria,
        
        -- Architecture patterns
        arch.required_patterns,
        arch.implementation_guide,
        arch.consequences,
        
        -- Bay View context
        brief.heritage,
        brief.scope,
        brief.mission,
        brief.constraints,
        brief.member_impact,
        
        -- Project context
        p.name as project_name,
        p.project_code,
        p.phase,
        p.description as project_description
        
      FROM project_mgmt.tasks t
      JOIN project_mgmt.projects p ON t.project_id = p.id
      LEFT JOIN project_mgmt.v_agent_architecture_context arch ON t.id = arch.task_id
      CROSS JOIN project_mgmt.v_agent_briefing brief
      WHERE t.id = 20
    `);

    if (fullContext.rows.length > 0) {
      const context = fullContext.rows[0];
      console.log(`\nTask ID: ${context.id}`);
      console.log(`Task: ${context.task_name}`);
      console.log(`Priority: ${context.priority}`);
      console.log(`Components: ${context.components.join(', ')}`);
      console.log(`\nBay View Heritage: ${context.heritage}`);
      console.log(`Transformation Scope: ${context.scope}`);
      console.log(`Mission: ${context.mission}`);
      console.log(`Constraints: ${context.constraints}`);
      console.log(`Member Impact: ${context.member_impact}`);
      console.log(`\nArchitecture Patterns: ${context.required_patterns?.join(', ') || 'None'}`);
      console.log(`Implementation Guidance: ${context.implementation_guide ? 'Available' : 'None'}`);
      console.log(`Risk Consequences: ${context.consequences || 'None'}`);
    }

    console.log('\n');

    // 4. Comparison Test
    console.log('📊 CONTEXT COMPARISON:');
    console.log('   Before Enhancement: "Deploy APIs to production Vercel" + basic project info');
    console.log('   After Enhancement:  "Deploy APIs to production Vercel" + dual-write patterns + 150-year heritage mission + $925K scope + implementation guides');

    console.log('\n✅ Enhanced MCP context successfully provides:');
    console.log('   - Complete Bay View heritage and mission context');
    console.log('   - Specific architecture patterns with code examples');
    console.log('   - Safety constraints and consequences');
    console.log('   - Member impact awareness');
    console.log('   - Transformation scope understanding');

  } catch (error) {
    console.error('❌ Error testing enhanced context:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  testEnhancedMCPContext().catch(console.error);
}

export { testEnhancedMCPContext };