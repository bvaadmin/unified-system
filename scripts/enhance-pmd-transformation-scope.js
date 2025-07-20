#!/usr/bin/env node

/**
 * Enhanced PMD Transformation Scope
 * Adds broader digital transformation context and historical perspective
 */

import pg from 'pg';
import dotenv from 'dotenv';

const { Client } = pg;
dotenv.config();

async function enhancePMDTransformationScope() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('🌟 Enhancing PMD with transformation scope...');

    // 1. Add transformation context table
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_mgmt.transformation_context (
        id SERIAL PRIMARY KEY,
        context_type VARCHAR(50) NOT NULL, -- 'Heritage', 'Scope', 'Mission', 'Innovation'
        title VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        business_impact TEXT NOT NULL,
        stakeholder_value TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Insert Bay View transformation context
    const contexts = [
      {
        type: 'Heritage',
        title: 'Bay View Association: 150-Year Digital Preservation Mission',
        description: 'Founded in 1875, Bay View is a National Historic Landmark Chautauqua community in Petoskey, Michigan. This digital transformation preserves 150 years of operational history while modernizing for the next century.',
        business_impact: 'Ensures cultural preservation, operational efficiency, and member engagement for 2,000+ families across 312 cottage properties and year-round programming.',
        stakeholder_value: 'Members gain modern digital services while preserving authentic Bay View traditions. Staff gain efficient tools. History is preserved digitally for future generations.'
      },
      {
        type: 'Scope',
        title: '$925K Digital Transformation Roadmap (18 Months)',
        description: 'Comprehensive modernization spanning 12 major projects: Foundation (Phases 1-2D), Analytics, Mobile Apps, Historical Archives, and 2026 Season Preparation.',
        business_impact: 'Complete digital infrastructure overhaul affecting every aspect of Bay View operations: chapel services, memorial garden, property management, financial systems, event coordination, and member communications.',
        stakeholder_value: 'Unified member experience, efficient staff operations, preserved historical records, modern communication channels, enhanced program management.'
      }
    ];

    // Insert transformation contexts
    for (const context of contexts) {
      await client.query(`
        INSERT INTO project_mgmt.transformation_context 
        (context_type, title, description, business_impact, stakeholder_value)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING
      `, [
        context.type,
        context.title,
        context.description,
        context.business_impact,
        context.stakeholder_value
      ]);
    }

    // 3. Create agent briefing view
    await client.query(`
      CREATE OR REPLACE VIEW project_mgmt.v_agent_briefing AS
      SELECT 
        '🏛️ HERITAGE: 150-year National Historic Landmark Chautauqua community' as heritage,
        '💰 SCOPE: $925K, 18-month digital transformation across 12 projects' as scope,
        '🎯 MISSION: Modernize operations while preserving authentic Bay View culture' as mission,
        '⚠️ CONSTRAINTS: Dual-write pattern required, Bay View terminology mandatory, migration safety protocols essential' as constraints,
        '👥 MEMBERS: 2,000+ families, 312 cottage properties, traditional leaseholder system (not ownership)' as member_impact;
    `);

    console.log('✅ Transformation context added to PMD');
    console.log('✅ Agent briefing view created');

  } catch (error) {
    console.error('❌ Error enhancing PMD transformation scope:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  enhancePMDTransformationScope().catch(console.error);
}

export { enhancePMDTransformationScope };