#!/usr/bin/env node

/**
 * Expand PMD with Complete Bay View Roadmap
 * Adds missing historical and future projects to represent the full roadmap
 */

import pg from 'pg';
import dotenv from 'dotenv';

const { Client } = pg;
dotenv.config();

async function expandCompleteRoadmap() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('🚀 Expanding PMD with complete Bay View roadmap...\n');

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
    console.log('\n📚 Creating historical foundation projects...');
    
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

    const phase1Id = phase1Project.rows[0].id;
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

    const phase2AId = phase2AProject.rows[0].id;
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

    const phase2BId = phase2BProject.rows[0].id;
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

    const phase2CId = phase2CProject.rows[0].id;
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

    const phase2DId = phase2DProject.rows[0].id;
    console.log('Created historical project:', phase2DProject.rows[0].project_code);

    // ========================================
    // FUTURE PROJECTS
    // ========================================
    console.log('\n📱 Creating future roadmap projects...');
    
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

    const mobileId = mobileProject.rows[0].id;
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

    const historicalId = historicalProject.rows[0].id;
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

    const season2026Id = season2026Project.rows[0].id;
    console.log('Created future project:', season2026Project.rows[0].project_code);

    // ========================================
    // ADD HISTORICAL MILESTONES
    // ========================================
    console.log('\n🏁 Adding historical milestones...');

    // Phase 1 milestones
    await client.query(`
      INSERT INTO project_mgmt.milestones (
        project_id, name, due_date, status, impact_if_missed,
        owner_id, completion_criteria, system_components
      ) VALUES
      ($1, 'Database Architecture Complete', '2025-02-15', 'Complete', 'Critical-System Down',
       $2, 'All core schemas designed, dual-write pattern implemented, migration safety verified',
       ARRAY['Core Database', 'Migration System']),
      ($1, 'Chapel API Deployed', '2025-03-01', 'Complete', 'High-Feature Delay',
       $3, 'Chapel booking system operational, Notion integration working, forms processing',
       ARRAY['Chapel API', 'Notion Integration']),
      ($1, 'Memorial Garden API Live', '2025-03-15', 'Complete', 'Medium-Performance',
       $2, 'Memorial applications processing, dual storage working, workflow operational',
       ARRAY['Memorial API', 'Workflow System'])
    `, [phase1Id, resourceMap['Marcus Chen'], resourceMap['You']]);

    // Phase 2A milestones
    await client.query(`
      INSERT INTO project_mgmt.milestones (
        project_id, name, due_date, status, impact_if_missed,
        owner_id, completion_criteria, system_components
      ) VALUES
      ($1, 'Property System Operational', '2025-04-30', 'Complete', 'Critical-System Down',
       $2, 'All 312 cottage lots trackable, Block/Lot system authentic, leaseholder management',
       ARRAY['Property System', 'Core Database']),
      ($1, 'Financial Framework Complete', '2025-05-15', 'Complete', 'High-Feature Delay',
       $3, 'Assessment tracking, payment processing, account management operational',
       ARRAY['Finance API', 'Payment Processing'])
    `, [phase2AId, resourceMap['Marcus Chen'], resourceMap['You']]);

    // ========================================
    // ADD MOBILE APP TASKS
    // ========================================
    console.log('\n📱 Adding mobile app development tasks...');

    const mobileAppTasks = [
      {
        name: 'Design mobile app architecture and API strategy',
        priority: 'P0-Critical',
        type: 'Feature',
        components: ['Mobile Apps', 'API Design'],
        status: 'Backlog',
        hours: 40,
        assignee: null
      },
      {
        name: 'Set up React Native development environment',
        priority: 'P1-High',
        type: 'Configuration',
        components: ['Mobile Apps', 'Development'],
        status: 'Backlog',
        hours: 16,
        assignee: null
      },
      {
        name: 'Build iOS native app with core features',
        priority: 'P1-High',
        type: 'Feature',
        components: ['iOS App', 'Mobile Apps'],
        status: 'Backlog',
        hours: 120,
        assignee: 'Jessica Park'
      },
      {
        name: 'Build Android native app with core features',
        priority: 'P1-High',
        type: 'Feature',
        components: ['Android App', 'Mobile Apps'],
        status: 'Backlog',
        hours: 120,
        assignee: null
      },
      {
        name: 'Implement push notification system',
        priority: 'P2-Medium',
        type: 'Feature',
        components: ['Push Notifications', 'Mobile Apps'],
        status: 'Backlog',
        hours: 48,
        assignee: null
      },
      {
        name: 'Add offline data synchronization',
        priority: 'P2-Medium',
        type: 'Feature',
        components: ['Offline Sync', 'Mobile Apps'],
        status: 'Backlog',
        hours: 64,
        assignee: null
      },
      {
        name: 'App Store and Play Store submission',
        priority: 'P1-High',
        type: 'Configuration',
        components: ['App Stores', 'Mobile Apps'],
        status: 'Backlog',
        hours: 24,
        assignee: null
      }
    ];

    for (const task of mobileAppTasks) {
      await client.query(`
        INSERT INTO project_mgmt.tasks (
          project_id, name, priority, task_type, components,
          status, estimated_hours, assignee_id, created_by,
          acceptance_criteria
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        mobileId, task.name, task.priority, task.type, task.components,
        task.status, task.hours,
        task.assignee ? resourceMap[task.assignee] : null,
        resourceMap['You'],
        'Feature works reliably on both platforms, app store guidelines met, user testing passed'
      ]);
    }

    // ========================================
    // ADD HISTORICAL DATA IMPORT TASKS
    // ========================================
    console.log('\n📚 Adding historical data import tasks...');

    const historicalTasks = [
      {
        name: 'Design data migration strategy for legacy systems',
        priority: 'P0-Critical',
        type: 'Migration',
        components: ['Legacy Systems', 'Data Migration'],
        status: 'Backlog',
        hours: 32,
        assignee: 'Robert Torres'
      },
      {
        name: 'Extract 5 years of member data from archives',
        priority: 'P1-High',
        type: 'Migration',
        components: ['Legacy Systems', 'Core Database'],
        status: 'Backlog',
        hours: 80,
        assignee: null
      },
      {
        name: 'Import cottage ownership history records',
        priority: 'P1-High',
        type: 'Migration',
        components: ['Property System', 'Archives'],
        status: 'Backlog',
        hours: 60,
        assignee: null
      },
      {
        name: 'Import historical financial records and assessments',
        priority: 'P2-Medium',
        type: 'Migration',
        components: ['Finance', 'Archives'],
        status: 'Backlog',
        hours: 72,
        assignee: null
      },
      {
        name: 'Import program attendance archives',
        priority: 'P3-Low',
        type: 'Migration',
        components: ['Events', 'Archives'],
        status: 'Backlog',
        hours: 48,
        assignee: null
      }
    ];

    for (const task of historicalTasks) {
      await client.query(`
        INSERT INTO project_mgmt.tasks (
          project_id, name, priority, task_type, components,
          status, estimated_hours, assignee_id, created_by,
          acceptance_criteria
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        historicalId, task.name, task.priority, task.type, task.components,
        task.status, task.hours,
        task.assignee ? resourceMap[task.assignee] : null,
        resourceMap['You'],
        'Data imported correctly, integrity verified, accessible through current system'
      ]);
    }

    // ========================================
    // ADD 2026 SEASON PREPARATION TASKS
    // ========================================
    console.log('\n🌟 Adding 2026 season preparation tasks...');

    const season2026Tasks = [
      {
        name: 'Transition all registration forms to online-only',
        priority: 'P0-Critical',
        type: 'Feature',
        components: ['Portal', 'Registration'],
        status: 'Backlog',
        hours: 40,
        assignee: 'Sarah Mitchell'
      },
      {
        name: 'Enable all payment processing to be digital',
        priority: 'P0-Critical',
        type: 'Feature',
        components: ['Payment Processing', 'Portal'],
        status: 'Backlog',
        hours: 32,
        assignee: null
      },
      {
        name: 'Complete paperless office transition',
        priority: 'P1-High',
        type: 'Feature',
        components: ['Document Management', 'Operations'],
        status: 'Backlog',
        hours: 48,
        assignee: null
      },
      {
        name: 'Deploy real-time analytics dashboards',
        priority: 'P1-High',
        type: 'Feature',
        components: ['Analytics', 'Dashboard'],
        status: 'Backlog',
        hours: 56,
        assignee: null
      },
      {
        name: 'Optimize all systems for mobile-first experience',
        priority: 'P2-Medium',
        type: 'Feature',
        components: ['Mobile Apps', 'Portal'],
        status: 'Backlog',
        hours: 64,
        assignee: 'Jessica Park'
      }
    ];

    for (const task of season2026Tasks) {
      await client.query(`
        INSERT INTO project_mgmt.tasks (
          project_id, name, priority, task_type, components,
          status, estimated_hours, assignee_id, created_by,
          acceptance_criteria
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        season2026Id, task.name, task.priority, task.type, task.components,
        task.status, task.hours,
        task.assignee ? resourceMap[task.assignee] : null,
        resourceMap['You'],
        'System ready for 2026 season, all digital workflows operational, mobile experience optimized'
      ]);
    }

    // ========================================
    // ADD GRANULAR AUGUST DEPLOYMENT TASKS
    // ========================================
    console.log('\n📅 Adding granular August deployment weekly tasks...');

    // Get the existing deployment project
    const deploymentProject = await client.query(`
      SELECT id FROM project_mgmt.projects 
      WHERE name LIKE '%Bay View System Launch%'
    `);
    
    if (deploymentProject.rows.length > 0) {
      const deploymentId = deploymentProject.rows[0].id;

      // Create specific weekly sprints
      const weekSprints = [
        {
          number: 'S2025-07-W2',
          name: 'Week 2: Data Migration (July 29 - August 4)',
          start: '2025-07-29',
          end: '2025-08-04',
          goals: 'Complete migration of all legacy data to production system',
          focus: ['Data Migration', 'Legacy Export', 'Verification']
        },
        {
          number: 'S2025-08-W1',
          name: 'Week 3: Soft Launch (August 5-11)',
          start: '2025-08-05',
          end: '2025-08-11',
          goals: 'Staff training and pilot member testing with parallel processing',
          focus: ['Training', 'Pilot Testing', 'Issue Resolution']
        },
        {
          number: 'S2025-08-W2',
          name: 'Week 4: Full Launch (August 12-18)',
          start: '2025-08-12',
          end: '2025-08-18',
          goals: 'Public launch with all members, switch to primary system',
          focus: ['Public Launch', 'Primary Switch', 'Support']
        },
        {
          number: 'S2025-08-W3',
          name: 'Week 5: Stabilization (August 19-25)',
          start: '2025-08-19',
          end: '2025-08-25',
          goals: 'Monitor performance, address feedback, optimize operations',
          focus: ['Monitoring', 'Optimization', 'Board Reporting']
        }
      ];

      for (const sprint of weekSprints) {
        const sprintResult = await client.query(`
          INSERT INTO project_mgmt.sprints (
            sprint_number, name, project_id, start_date, end_date,
            sprint_goals, focus_areas, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
        `, [
          sprint.number, sprint.name, deploymentId,
          sprint.start, sprint.end, sprint.goals, sprint.focus, 'Planning'
        ]);

        console.log(`Created sprint: ${sprint.name}`);
      }

      // Add more granular tasks for each week
      const granularTasks = [
        // Week 2: Data Migration
        {
          name: 'Import current year assessments to production',
          priority: 'P0-Critical',
          type: 'Migration',
          status: 'Backlog',
          hours: 12,
          assignee: 'Robert Torres'
        },
        {
          name: 'Import remaining summer 2025 events',
          priority: 'P0-Critical',
          type: 'Migration',
          status: 'Backlog',
          hours: 8,
          assignee: 'Robert Torres'
        },
        {
          name: 'Migrate active program registrations',
          priority: 'P1-High',
          type: 'Migration',
          status: 'Backlog',
          hours: 16,
          assignee: null
        },
        {
          name: 'Verify data integrity across all systems',
          priority: 'P0-Critical',
          type: 'Feature',
          status: 'Backlog',
          hours: 20,
          assignee: 'Marcus Chen'
        },
        // Week 3: Soft Launch
        {
          name: 'Process real transactions in parallel with legacy',
          priority: 'P0-Critical',
          type: 'Feature',
          status: 'Backlog',
          hours: 24,
          assignee: 'Marcus Chen'
        },
        {
          name: 'Fix any critical issues discovered in pilot',
          priority: 'P0-Critical',
          type: 'Bug',
          status: 'Backlog',
          hours: 32,
          assignee: null
        },
        {
          name: 'Document common tasks and workflows',
          priority: 'P1-High',
          type: 'Documentation',
          status: 'Backlog',
          hours: 16,
          assignee: 'Emma Wilson'
        },
        // Week 4: Full Launch
        {
          name: 'Announce new system to all members',
          priority: 'P1-High',
          type: 'Feature',
          status: 'Backlog',
          hours: 8,
          assignee: 'Sarah Mitchell'
        },
        {
          name: 'Enable member portal access for all members',
          priority: 'P0-Critical',
          type: 'Configuration',
          status: 'Backlog',
          hours: 4,
          assignee: 'Marcus Chen'
        },
        {
          name: 'Begin processing payments online exclusively',
          priority: 'P0-Critical',
          type: 'Feature',
          status: 'Backlog',
          hours: 12,
          assignee: null
        },
        {
          name: 'Switch to new system as primary',
          priority: 'P0-Critical',
          type: 'Configuration',
          status: 'Backlog',
          hours: 6,
          assignee: 'Marcus Chen'
        },
        {
          name: 'Keep legacy system as backup only',
          priority: 'P2-Medium',
          type: 'Configuration',
          status: 'Backlog',
          hours: 4,
          assignee: 'Robert Torres'
        },
        // Week 5: Stabilization
        {
          name: 'Monitor system performance continuously',
          priority: 'P1-High',
          type: 'Feature',
          status: 'Backlog',
          hours: 20,
          assignee: 'Marcus Chen'
        },
        {
          name: 'Address user feedback and requests',
          priority: 'P2-Medium',
          type: 'Feature',
          status: 'Backlog',
          hours: 24,
          assignee: 'Emma Wilson'
        },
        {
          name: 'Optimize slow queries and performance',
          priority: 'P2-Medium',
          type: 'Feature',
          status: 'Backlog',
          hours: 16,
          assignee: 'Marcus Chen'
        },
        {
          name: 'Train committee chairs on new features',
          priority: 'P2-Medium',
          type: 'Documentation',
          status: 'Backlog',
          hours: 12,
          assignee: 'Sarah Mitchell'
        },
        {
          name: 'Prepare comprehensive board report',
          priority: 'P1-High',
          type: 'Documentation',
          status: 'Backlog',
          hours: 16,
          assignee: 'Sarah Mitchell'
        }
      ];

      for (const task of granularTasks) {
        await client.query(`
          INSERT INTO project_mgmt.tasks (
            project_id, name, priority, task_type,
            status, estimated_hours, assignee_id, created_by,
            acceptance_criteria, components
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          deploymentId, task.name, task.priority, task.type,
          task.status, task.hours,
          task.assignee ? resourceMap[task.assignee] : null,
          resourceMap['You'],
          'Task completed successfully according to launch timeline',
          ['Production', 'Deployment']
        ]);
      }
    }

    // ========================================
    // CREATE ADDITIONAL BLOCKERS
    // ========================================
    console.log('\n🚫 Adding realistic project blockers...');

    // Generate additional blocker IDs
    const blockerCount = await client.query('SELECT COUNT(*) FROM project_mgmt.blockers');
    let blockerNumber = parseInt(blockerCount.rows[0].count) + 1;

    const additionalBlockers = [
      {
        title: 'Legacy system documentation incomplete',
        type: 'Process',
        severity: '🟡 Medium-Schedule Delay',
        components: ['Legacy Systems', 'Documentation'],
        owner: 'Robert Torres',
        identified_by: 'Sarah Mitchell',
        impact: 'Data migration timeline at risk without proper legacy system documentation',
        mitigation: 'Reverse engineer legacy systems while documenting current state'
      },
      {
        title: 'App Store approval process timeline uncertain',
        type: 'External',
        severity: '🟡 Medium-Schedule Delay',
        components: ['Mobile Apps', 'App Stores'],
        owner: 'Jessica Park',
        identified_by: 'Jessica Park',
        impact: 'Mobile app launch may be delayed by app store review cycles',
        mitigation: 'Submit apps early with beta versions, maintain relationship with app store liaisons'
      }
    ];

    for (const blocker of additionalBlockers) {
      const blockerId = `BV-BLOCK-${String(blockerNumber).padStart(3, '0')}`;
      
      await client.query(`
        INSERT INTO project_mgmt.blockers (
          blocker_id, title, blocker_type, severity, status,
          components_affected, owner_id, identified_by,
          identified_date, target_resolution,
          impact_description, mitigation_plan
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id
      `, [
        blockerId, blocker.title, blocker.type, blocker.severity, 'Active',
        blocker.components, resourceMap[blocker.owner], resourceMap[blocker.identified_by],
        'CURRENT_DATE', '2025-08-15', blocker.impact, blocker.mitigation
      ]);

      blockerNumber++;
    }

    // ========================================
    // SUMMARY REPORT
    // ========================================
    console.log('\n🎉 Complete roadmap expansion finished!\\n');

    // Show final summary
    const summary = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM project_mgmt.projects WHERE NOT is_archived) as total_projects,
        (SELECT COUNT(*) FROM project_mgmt.projects WHERE status = 'Active') as active_projects,
        (SELECT COUNT(*) FROM project_mgmt.projects WHERE status = 'Completed') as completed_projects,
        (SELECT COUNT(*) FROM project_mgmt.tasks WHERE NOT is_archived) as total_tasks,
        (SELECT COUNT(*) FROM project_mgmt.tasks WHERE status IN ('To Do', 'In Progress')) as active_tasks,
        (SELECT COUNT(*) FROM project_mgmt.milestones) as total_milestones,
        (SELECT COUNT(*) FROM project_mgmt.blockers WHERE status = 'Active') as active_blockers,
        (SELECT COUNT(*) FROM project_mgmt.sprints) as total_sprints
    `);

    console.log('📊 Final Database Summary:');
    const stats = summary.rows[0];
    console.log(`• Projects: ${stats.total_projects} total (${stats.completed_projects} completed, ${stats.active_projects} active)`);
    console.log(`• Tasks: ${stats.total_tasks} total, ${stats.active_tasks} active`);
    console.log(`• Milestones: ${stats.total_milestones}`);
    console.log(`• Blockers: ${stats.active_blockers} active`);
    console.log(`• Sprints: ${stats.total_sprints}`);

    // Show project breakdown by phase
    const projectBreakdown = await client.query(`
      SELECT phase, COUNT(*) as count, status
      FROM project_mgmt.projects
      WHERE NOT is_archived
      GROUP BY phase, status
      ORDER BY phase, status
    `);

    console.log('\\n📈 Project Breakdown by Phase:');
    projectBreakdown.rows.forEach(row => {
      console.log(`   ${row.phase}: ${row.count} (${row.status})`);
    });

    console.log('\\n🎯 Complete Bay View Roadmap Now Tracked:');
    console.log('✅ Historical foundation work (Phase 1 & 2) - COMPLETED');
    console.log('✅ Current deployment project (August 2025) - ACTIVE');
    console.log('✅ Analytics & reporting (Fall 2025) - PLANNING');
    console.log('✅ Member portal enhancement (Fall 2025) - PLANNING');
    console.log('✅ Financial integration (Winter 2025-26) - PLANNING');
    console.log('✅ Mobile app development (Winter 2025-26) - PLANNING');
    console.log('✅ Historical data import (Winter 2025-26) - PLANNING');
    console.log('✅ 2026 season preparation (Spring 2026) - PLANNING');

  } catch (error) {
    console.error('❌ Error expanding roadmap:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run if called directly
expandCompleteRoadmap()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

export { expandCompleteRoadmap };