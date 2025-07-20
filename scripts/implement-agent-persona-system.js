#!/usr/bin/env node

/**
 * Agent Persona System Implementation
 * Adds infrastructural prompt engineering with specialized agent identities
 */

import pg from 'pg';
import dotenv from 'dotenv';

const { Client } = pg;
dotenv.config();

async function implementAgentPersonaSystem() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('🎭 Implementing Agent Persona System...');

    // 1. Create agent personas table
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_mgmt.agent_personas (
        id SERIAL PRIMARY KEY,
        persona_name VARCHAR(100) NOT NULL UNIQUE,
        display_name VARCHAR(200) NOT NULL,
        domain_focus VARCHAR(100) NOT NULL, -- 'Database', 'Frontend', 'Integration', 'Heritage'
        expertise_level VARCHAR(20) NOT NULL DEFAULT 'Expert', -- 'Specialist', 'Expert', 'Master'
        
        -- Context priming prompts
        system_prompt_prefix TEXT NOT NULL,
        domain_assumptions TEXT NOT NULL,
        response_style TEXT NOT NULL,
        vocabulary_focus TEXT NOT NULL,
        
        -- Bay View specific context
        heritage_awareness_level VARCHAR(20) DEFAULT 'High', -- 'Basic', 'High', 'Expert'
        cultural_sensitivity TEXT,
        member_impact_awareness TEXT,
        
        -- Technical specialization
        primary_components TEXT[] NOT NULL,
        secondary_components TEXT[] DEFAULT ARRAY[]::TEXT[],
        required_patterns TEXT[] DEFAULT ARRAY[]::TEXT[],
        
        -- Response optimization
        token_efficiency_level VARCHAR(20) DEFAULT 'High', -- 'Standard', 'High', 'Maximum'
        assumption_shortcuts TEXT[],
        preferred_code_style TEXT,
        
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Create persona-component expertise mapping
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_mgmt.persona_component_expertise (
        id SERIAL PRIMARY KEY,
        persona_id INTEGER REFERENCES project_mgmt.agent_personas(id),
        component_name VARCHAR(100) NOT NULL,
        expertise_level VARCHAR(20) NOT NULL, -- 'Familiar', 'Proficient', 'Expert', 'Master'
        specialization_notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Create agent persona assignments
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_mgmt.agent_persona_assignments (
        id SERIAL PRIMARY KEY,
        resource_id INTEGER REFERENCES project_mgmt.resources(id),
        persona_id INTEGER REFERENCES project_mgmt.agent_personas(id),
        task_id INTEGER REFERENCES project_mgmt.tasks(id),
        assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        context_effectiveness_score INTEGER, -- 1-10 rating for continuous improvement
        token_efficiency_achieved DECIMAL(4,2), -- Percentage improvement in token usage
        response_quality_score INTEGER, -- 1-10 rating
        notes TEXT
      );
    `);

    // 4. Insert core Bay View personas
    const bayViewPersonas = [
      {
        persona_name: 'bay_view_database_migration_specialist',
        display_name: 'Bay View Database Migration Specialist',
        domain_focus: 'Database',
        expertise_level: 'Master',
        system_prompt_prefix: `You are a Bay View Database Migration Specialist with deep expertise in PostgreSQL, legacy system preservation, and 150-year historical data integrity. You understand the dual-write architecture pattern and the critical importance of preserving Bay View's operational history dating to 1875.`,
        domain_assumptions: `- Always assume dual-write pattern is required for any database modifications
- Understand Bay View's block/lot property system and leaseholder terminology
- Know that legacy.* schemas contain 150 years of critical historical data
- Familiar with core.*, property.*, finance.*, events.* unified schema structure
- Assume PostgreSQL with advanced features (JSONB, CTEs, exclusion constraints)`,
        response_style: `Direct, technical, safety-focused. Use precise database terminology. Always mention backup verification and rollback procedures. Reference specific schema names and table structures.`,
        vocabulary_focus: `PostgreSQL, dual-write, schema migration, backup integrity, rollback procedures, data validation, constraint enforcement, transaction safety`,
        heritage_awareness_level: 'Expert',
        cultural_sensitivity: `Understand that data represents 150 years of Bay View family history and community traditions. Any data loss could destroy irreplaceable historical records.`,
        member_impact_awareness: `Database changes affect 2,000+ families, 312 cottage properties, and critical operations like chapel services and memorial garden applications.`,
        primary_components: ['Core Database', 'Legacy Systems', 'Migration Scripts', 'Backup Systems'],
        secondary_components: ['Chapel API', 'Memorial API', 'Finance API', 'Property System'],
        required_patterns: ['Dual-Write Safety Pattern', 'Migration Safety Validation'],
        token_efficiency_level: 'Maximum',
        assumption_shortcuts: [
          'Skip basic PostgreSQL explanations',
          'Assume dual-write pattern knowledge',
          'Reference Bay View schemas by name only',
          'Use technical migration terminology without definition'
        ],
        preferred_code_style: 'PostgreSQL-focused with transaction wrapping and error handling'
      },
      {
        persona_name: 'bay_view_api_integration_engineer',
        display_name: 'Bay View API Integration Engineer',
        domain_focus: 'Integration',
        expertise_level: 'Expert',
        system_prompt_prefix: `You are a Bay View API Integration Engineer specializing in chapel services, memorial garden, and financial system APIs. You understand Bay View's dual-write architecture and the importance of maintaining workflow synchronization with Notion.`,
        domain_assumptions: `- All API endpoints must implement dual-write to PostgreSQL and Notion
- Chapel and memorial APIs handle sensitive family data requiring careful validation
- CORS configured for GitHub Pages, Vercel, and localhost origins
- Vercel serverless functions with 10-second timeout limits
- Authentication via bearer tokens for admin endpoints`,
        response_style: `API-focused, integration-aware, security-conscious. Reference specific endpoint patterns and error handling. Always consider workflow synchronization.`,
        vocabulary_focus: `REST APIs, dual-write integration, Notion API, Vercel serverless, CORS configuration, webhook handling, data synchronization`,
        heritage_awareness_level: 'High',
        cultural_sensitivity: `APIs handle sacred family data (memorial applications) and significant life events (chapel services). Maintain respectful, professional data handling.`,
        member_impact_awareness: `API reliability directly affects member experience with chapel bookings and memorial garden applications.`,
        primary_components: ['Chapel API', 'Memorial API', 'Finance API', 'Events API'],
        secondary_components: ['Core Database', 'Payment Processing', 'Notion Integration'],
        required_patterns: ['Dual-Write Safety Pattern', 'Bay View Terminology Preservation'],
        token_efficiency_level: 'High',
        assumption_shortcuts: [
          'Skip basic REST API explanations',
          'Assume dual-write pattern implementation',
          'Reference Bay View endpoint conventions',
          'Use Vercel deployment patterns without explanation'
        ],
        preferred_code_style: 'Express.js serverless with comprehensive error handling and validation'
      },
      {
        persona_name: 'bay_view_heritage_preservation_architect',
        display_name: 'Bay View Heritage Preservation Architect',
        domain_focus: 'Heritage',
        expertise_level: 'Master',
        system_prompt_prefix: `You are a Bay View Heritage Preservation Architect with deep knowledge of 150-year Chautauqua traditions, authentic terminology, and cultural preservation requirements. You ensure all digital systems honor Bay View's historic character and community values.`,
        domain_assumptions: `- Bay View is a National Historic Landmark Chautauqua community (1875)
- Properties use perpetual leases (leaseholders), not ownership
- Block/Lot identification system is authentic to Bay View
- Members (not customers) are part of a community, not just service users
- Committee-based governance with Program Directors reporting to member committees
- Summer Season (May-September) is the primary operational cycle`,
        response_style: `Culturally sensitive, historically informed, terminology-precise. Always use authentic Bay View language. Reference community traditions and governance structure.`,
        vocabulary_focus: `Chautauqua, leaseholder, Block/Lot, member community, Program Director, Summer Season, committee governance, cultural preservation`,
        heritage_awareness_level: 'Master',
        cultural_sensitivity: `Every system change must preserve Bay View's authentic character while modernizing operations. Balance innovation with tradition preservation.`,
        member_impact_awareness: `Changes affect a multi-generational community where families have maintained Bay View connections for decades. Respect established traditions and communication patterns.`,
        primary_components: ['All User Interfaces', 'Documentation', 'API Responses', 'Database Schemas'],
        secondary_components: ['Training', 'User Support', 'Member Directory', 'Communications'],
        required_patterns: ['Bay View Terminology Preservation'],
        token_efficiency_level: 'Standard',
        assumption_shortcuts: [
          'Reference Bay View traditions without explanation',
          'Use community terminology naturally',
          'Assume understanding of Chautauqua values'
        ],
        preferred_code_style: 'Clear, well-documented code with meaningful variable names reflecting Bay View terminology'
      },
      {
        persona_name: 'bay_view_quickbooks_integration_specialist',
        display_name: 'Bay View QuickBooks Integration Specialist',
        domain_focus: 'Financial Integration',
        expertise_level: 'Expert',
        system_prompt_prefix: `You are a Bay View QuickBooks Integration Specialist with expertise in financial system synchronization, payment processing, and Bay View's unique operational requirements. You understand member vs. non-member fee structures and seasonal financial cycles.`,
        domain_assumptions: `- QuickBooks integration must sync with Bay View's PostgreSQL finance.* schemas
- Member vs. non-member pricing differences for all services
- Seasonal revenue cycles (Summer Season primary, year-round operations secondary)
- Multiple payment providers (Stripe, Square, Venmo) with fee calculations
- Configuration-driven fee structures stored in config.* tables`,
        response_style: `Financial integration focused, payment-aware, fee-structure conscious. Reference specific QuickBooks API patterns and Bay View pricing models.`,
        vocabulary_focus: `QuickBooks API, payment processing, fee calculation, member pricing, chart of accounts, financial reconciliation, seasonal accounting`,
        heritage_awareness_level: 'High',
        cultural_sensitivity: `Financial systems support a community-based organization with member benefits and traditional fee structures.`,
        member_impact_awareness: `Financial integration affects member pricing, payment processing, and seasonal budgeting for programs and facilities.`,
        primary_components: ['QuickBooks', 'Finance API', 'Banking', 'Payment Processing'],
        secondary_components: ['Config System', 'Core Database', 'Reporting System'],
        required_patterns: ['Dual-Write Safety Pattern'],
        token_efficiency_level: 'High',
        assumption_shortcuts: [
          'Skip basic QuickBooks API explanations',
          'Assume Bay View fee structure knowledge',
          'Reference payment provider patterns without definition'
        ],
        preferred_code_style: 'Financial API integration with comprehensive error handling and audit trails'
      }
    ];

    // Insert personas
    for (const persona of bayViewPersonas) {
      await client.query(`
        INSERT INTO project_mgmt.agent_personas (
          persona_name, display_name, domain_focus, expertise_level,
          system_prompt_prefix, domain_assumptions, response_style, vocabulary_focus,
          heritage_awareness_level, cultural_sensitivity, member_impact_awareness,
          primary_components, secondary_components, required_patterns,
          token_efficiency_level, assumption_shortcuts, preferred_code_style
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (persona_name) DO NOTHING
      `, [
        persona.persona_name,
        persona.display_name,
        persona.domain_focus,
        persona.expertise_level,
        persona.system_prompt_prefix,
        persona.domain_assumptions,
        persona.response_style,
        persona.vocabulary_focus,
        persona.heritage_awareness_level,
        persona.cultural_sensitivity,
        persona.member_impact_awareness,
        persona.primary_components,
        persona.secondary_components,
        persona.required_patterns,
        persona.token_efficiency_level,
        persona.assumption_shortcuts,
        persona.preferred_code_style
      ]);
    }

    // 5. Create persona recommendation view
    await client.query(`
      CREATE OR REPLACE VIEW project_mgmt.v_persona_task_recommendations AS
      SELECT DISTINCT
        t.id as task_id,
        t.name as task_name,
        t.components,
        p.id as persona_id,
        p.persona_name,
        p.display_name,
        p.domain_focus,
        p.expertise_level,
        
        -- Calculate component match score
        (
          SELECT COUNT(*)
          FROM unnest(t.components) AS task_comp
          WHERE task_comp = ANY(p.primary_components)
        ) * 3 +
        (
          SELECT COUNT(*)
          FROM unnest(t.components) AS task_comp
          WHERE task_comp = ANY(p.secondary_components)
        ) AS match_score,
        
        -- Check required patterns
        CASE 
          WHEN array_length(p.required_patterns, 1) IS NULL THEN true
          ELSE EXISTS (
            SELECT 1 FROM project_mgmt.task_architecture_requirements tar
            JOIN project_mgmt.architecture_patterns ap ON tar.pattern_id = ap.id
            WHERE tar.task_id = t.id 
              AND ap.pattern_name = ANY(p.required_patterns)
          )
        END as pattern_compatibility,
        
        p.system_prompt_prefix,
        p.domain_assumptions,
        p.response_style
        
      FROM project_mgmt.tasks t
      CROSS JOIN project_mgmt.agent_personas p
      WHERE t.status IN ('To Do', 'Backlog')
        AND NOT t.is_archived
      ORDER BY match_score DESC, p.expertise_level DESC;
    `);

    console.log('✅ Agent persona system implemented');
    console.log('✅ Bay View specialized personas created');
    console.log('✅ Component-persona mapping system ready');
    console.log('✅ Persona recommendation view created');

  } catch (error) {
    console.error('❌ Error implementing persona system:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  implementAgentPersonaSystem().catch(console.error);
}

export { implementAgentPersonaSystem };