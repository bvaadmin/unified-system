#!/usr/bin/env node

/**
 * Add Missing Roadmap Projects to PMD
 * Adds historical and future projects without duplicating existing data
 */

import pg from 'pg';
import dotenv from 'dotenv';

const { Client } = pg;
dotenv.config();

async function addMissingProjects() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('🚀 Adding missing roadmap projects to PMD...\n');

    // Get resource IDs for assignments
    const resources = await client.query('SELECT id, name, email FROM project_mgmt.resources');
    const resourceMap = {};
    resources.rows.forEach(r => {
      resourceMap[r.name] = r.id;
      resourceMap[r.email] = r.id;
    });

    console.log('✅ Resource mapping ready:', Object.keys(resourceMap).length, 'people');

    // ========================================
    // HISTORICAL PROJECTS (COMPLETED)
    // ========================================
    console.log('\n📚 Adding historical foundation projects...');
    
    // Phase 1: Foundation (COMPLETED)
    const phase1Project = await client.query(`
      INSERT INTO project_mgmt.projects (
        name, status, health, priority, phase, project_type, related_systems,
        start_date, end_date, owner_id, created_by,
        description, success_criteria, budget, actual_spend
      ) VALUES (
        'Phase 1: Foundation & Migration Architecture',
        'Completed', '🟢 Green', 'P0-Critical', 'Phase 1-Foundation',
        ARRAY['Backend', 'Database', 'Architecture'], 
        ARRAY['Core Database', 'Migration System', 'Chapel', 'Memorial'],
        '2025-01-01', '2025-03-31',
        $1, $2,
        'Build foundational database architecture with dual-write safety for zero-loss migration from legacy systems',
        'Dual-write system operational, chapel and memorial APIs live, zero data loss during transition',
        85000, 82000
      ) RETURNING id, project_code
    `, [resourceMap['You'], resourceMap['You']]);

    console.log('Created historical project:', phase1Project.rows[0].project_code);

    // Phase 2A: Property & Financial (COMPLETED)
    const phase2AProject = await client.query(`
      INSERT INTO project_mgmt.projects (
        name, status, health, priority, phase, project_type, related_systems,
        start_date, end_date, owner_id, created_by,
        description, success_criteria, budget, actual_spend
      ) VALUES (
        'Phase 2A: Property System & Financial Framework',
        'Completed', '🟢 Green', 'P0-Critical', 'Phase 2A-Property',
        ARRAY['Backend', 'Database', 'API'], 
        ARRAY['Property System', 'Finance', 'Core Database'],
        '2025-04-01', '2025-05-31',
        $1, $2,
        'Implement authentic Bay View Block/Lot property system with leaseholding and comprehensive financial framework',
        'All 312 cottage lots trackable, assessment system operational, payment processing integrated',
        65000, 61000
      ) RETURNING id, project_code
    `, [resourceMap['Marcus Chen'], resourceMap['You']]);

    console.log('Created historical project:', phase2AProject.rows[0].project_code);

    // Phase 2B: Events & Programs (COMPLETED)
    const phase2BProject = await client.query(`
      INSERT INTO project_mgmt.projects (
        name, status, health, priority, phase, project_type, related_systems,
        start_date, end_date, owner_id, created_by,
        description, success_criteria, budget, actual_spend
      ) VALUES (
        'Phase 2B: Events & Program Management',
        'Completed', '🟢 Green', 'P1-High', 'Phase 2B-Events',
        ARRAY['Backend', 'API', 'Frontend'], 
        ARRAY['Events', 'Programs', 'Registration'],
        '2025-05-01', '2025-06-15',
        $1, $2,
        'Complete event booking system with facility management, program registration, and conflict prevention',
        'Summer 2025 programs bookable, facility conflicts eliminated, registration system operational',
        45000, 43000
      ) RETURNING id, project_code
    `, [resourceMap['Jessica Park'], resourceMap['You']]);

    console.log('Created historical project:', phase2BProject.rows[0].project_code);

    // Phase 2C: Communications (COMPLETED)
    const phase2CProject = await client.query(`
      INSERT INTO project_mgmt.projects (
        name, status, health, priority, phase, project_type, related_systems,
        start_date, end_date, owner_id, created_by,
        description, success_criteria, budget, actual_spend
      ) VALUES (
        'Phase 2C: Communications & Member Directory',
        'Completed', '🟢 Green', 'P2-Medium', 'Phase 2C-Communications',
        ARRAY['Backend', 'API', 'Integration'], 
        ARRAY['Communications', 'Member Directory', 'Notifications'],
        '2025-06-01', '2025-07-01',
        $1, $2,
        'Build comprehensive communication system with member directory, notifications, and announcement management',
        'Member directory live, notification system operational, email integration complete',
        35000, 34000
      ) RETURNING id, project_code
    `, [resourceMap['Sarah Mitchell'], resourceMap['You']]);

    console.log('Created historical project:', phase2CProject.rows[0].project_code);

    // Phase 2D: Governance (COMPLETED)
    const phase2DProject = await client.query(`
      INSERT INTO project_mgmt.projects (
        name, status, health, priority, phase, project_type, related_systems,
        start_date, end_date, owner_id, created_by,
        description, success_criteria, budget, actual_spend
      ) VALUES (
        'Phase 2D: Program Governance & Payment Integration',
        'Completed', '🟢 Green', 'P1-High', 'Phase 2D-Governance',
        ARRAY['Backend', 'Integration', 'Configuration'], 
        ARRAY['Program Governance', 'Payment Processing', 'Configuration'],
        '2025-06-15', '2025-07-15',
        $1, $2,
        'Implement program director oversight system with payment provider integration and runtime configuration',
        'All programs have director oversight, payment processing operational, configuration system live',
        40000, 38000
      ) RETURNING id, project_code
    `, [resourceMap['Marcus Chen'], resourceMap['You']]);

    console.log('Created historical project:', phase2DProject.rows[0].project_code);

    // ========================================
    // FUTURE PROJECTS
    // ========================================
    console.log('\n📱 Adding future roadmap projects...');
    
    // Mobile App Development (Winter 2025-26)
    const mobileProject = await client.query(`
      INSERT INTO project_mgmt.projects (
        name, status, health, priority, phase, project_type, related_systems,
        start_date, end_date, owner_id, created_by,
        description, success_criteria, budget
      ) VALUES (
        'Mobile App Development - iOS & Android',
        'Planning', '🟢 Green', 'P2-Medium', 'Phase 6-Mobile',
        ARRAY['Mobile', 'Frontend', 'API'], 
        ARRAY['Mobile Apps', 'Push Notifications', 'Offline Sync'],
        '2025-12-01', '2026-03-31',
        $1, $2,
        'Native mobile apps for iOS and Android with offline capability, push notifications, and full feature parity',
        'Apps published to stores, 80%+ member adoption, offline mode functional, push notifications operational',
        120000
      ) RETURNING id, project_code
    `, [resourceMap['Jessica Park'], resourceMap['You']]);

    console.log('Created future project:', mobileProject.rows[0].project_code);

    // Historical Data Import (Winter 2025-26)
    const historicalProject = await client.query(`
      INSERT INTO project_mgmt.projects (
        name, status, health, priority, phase, project_type, related_systems,
        start_date, end_date, owner_id, created_by,
        description, success_criteria, budget
      ) VALUES (
        'Historical Data Import - 5 Year Archive',
        'Planning', '🟢 Green', 'P3-Low', 'Phase 7-Historical',
        ARRAY['Migration', 'Data', 'Backend'], 
        ARRAY['Legacy Systems', 'Core Database', 'Archives'],
        '2025-12-01', '2026-02-28',
        $1, $2,
        'Import 5 years of historical member data, cottage ownership history, financial records, and program archives',
        'All historical data accessible, trend analysis possible, complete member history available',
        35000
      ) RETURNING id, project_code
    `, [resourceMap['Robert Torres'], resourceMap['You']]);

    console.log('Created future project:', historicalProject.rows[0].project_code);

    // 2026 Season Preparation (Spring 2026)
    const season2026Project = await client.query(`
      INSERT INTO project_mgmt.projects (
        name, status, health, priority, phase, project_type, related_systems,
        start_date, end_date, owner_id, created_by,
        description, success_criteria, budget
      ) VALUES (
        '2026 Season - Full Digital Operations',
        'Planning', '🟢 Green', 'P1-High', 'Phase 8-Digital',
        ARRAY['Operations', 'Frontend', 'Mobile'], 
        ARRAY['Portal', 'Mobile Apps', 'Payment Processing', 'Analytics'],
        '2026-04-01', '2026-05-31',
        $1, $2,
        'Complete transition to digital-first operations with paperless office, mobile-first experience, and real-time analytics',
        'All registrations online, all payments digital, paperless office operational, real-time dashboards live',
        25000
      ) RETURNING id, project_code
    `, [resourceMap['Sarah Mitchell'], resourceMap['You']]);

    console.log('Created future project:', season2026Project.rows[0].project_code);

    // ========================================
    // SUMMARY REPORT
    // ========================================
    console.log('\n🎉 Missing roadmap projects added successfully!\\n');

    // Show final summary
    const summary = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM project_mgmt.projects WHERE NOT is_archived) as total_projects,
        (SELECT COUNT(*) FROM project_mgmt.projects WHERE status = 'Active') as active_projects,
        (SELECT COUNT(*) FROM project_mgmt.projects WHERE status = 'Completed') as completed_projects,
        (SELECT COUNT(*) FROM project_mgmt.tasks WHERE NOT is_archived) as total_tasks,
        (SELECT COUNT(*) FROM project_mgmt.milestones) as total_milestones,
        (SELECT COUNT(*) FROM project_mgmt.blockers WHERE status = 'Active') as active_blockers,
        (SELECT COUNT(*) FROM project_mgmt.sprints) as total_sprints
    `);

    console.log('📊 Updated Database Summary:');
    const stats = summary.rows[0];
    console.log(`• Projects: ${stats.total_projects} total (${stats.completed_projects} completed, ${stats.active_projects} active)`);
    console.log(`• Tasks: ${stats.total_tasks} total`);
    console.log(`• Milestones: ${stats.total_milestones}`);
    console.log(`• Blockers: ${stats.active_blockers} active`);
    console.log(`• Sprints: ${stats.total_sprints}`);

    // Show project breakdown by phase  
    const projectBreakdown = await client.query(`
      SELECT phase, COUNT(*) as count, status
      FROM project_mgmt.projects
      WHERE NOT is_archived
      GROUP BY phase, status
      ORDER BY phase
    `);

    console.log('\\n📈 Complete Project Roadmap by Phase:');
    projectBreakdown.rows.forEach(row => {
      console.log(`   ${row.phase}: ${row.count} projects (${row.status})`);
    });

    console.log('\\n✅ PMD now represents the complete Bay View roadmap:');
    console.log('📚 Historical foundation work (Phase 1 & 2) - COMPLETED');
    console.log('🚀 Current deployment project (August 2025) - ACTIVE');
    console.log('📊 Analytics & reporting (Fall 2025) - PLANNING');
    console.log('👤 Member portal enhancement (Fall 2025) - PLANNING');
    console.log('💰 Financial integration (Winter 2025-26) - PLANNING');
    console.log('📱 Mobile app development (Winter 2025-26) - PLANNING');
    console.log('📚 Historical data import (Winter 2025-26) - PLANNING');
    console.log('🌟 2026 season preparation (Spring 2026) - PLANNING');

  } catch (error) {
    console.error('❌ Error adding missing projects:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run if called directly
addMissingProjects()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

export { addMissingProjects };