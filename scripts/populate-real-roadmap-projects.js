#!/usr/bin/env node

/**
 * Populate PM Database with Real Bay View Roadmap Projects
 * Uses actual tasks and projects from PROJECT-ROADMAP.md and PROJECT-PLAN-JULY-2025.md
 */

import pg from 'pg';
import dotenv from 'dotenv';

const { Client } = pg;
dotenv.config();

async function populateRealProjects() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('🚀 Populating PM database with real Bay View roadmap...\n');

    // Clear ALL existing PM data for clean start (keep resources)
    console.log('Cleaning all existing PM data for fresh start...');
    await client.query('DELETE FROM project_mgmt.blocker_relationships');
    await client.query('DELETE FROM project_mgmt.task_dependencies');
    await client.query('DELETE FROM project_mgmt.project_stakeholders');
    await client.query('DELETE FROM project_mgmt.resource_allocations');
    await client.query('DELETE FROM project_mgmt.tasks');
    await client.query('DELETE FROM project_mgmt.milestones');
    await client.query('DELETE FROM project_mgmt.sprints');
    await client.query('DELETE FROM project_mgmt.blockers');
    await client.query('DELETE FROM project_mgmt.projects');
    
    // Reset sequences for clean IDs
    await client.query('ALTER SEQUENCE project_mgmt.projects_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE project_mgmt.tasks_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE project_mgmt.milestones_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE project_mgmt.sprints_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE project_mgmt.blockers_id_seq RESTART WITH 1');

    // Get resource IDs for assignments
    const resources = await client.query('SELECT id, name, email FROM project_mgmt.resources');
    const resourceMap = {};
    resources.rows.forEach(r => {
      resourceMap[r.name] = r.id;
      resourceMap[r.email] = r.id;
    });

    console.log('✅ Resource mapping ready:', Object.keys(resourceMap).length, 'people');

    // ========================================
    // PHASE 3: ANALYTICS & REPORTING
    // ========================================
    console.log('\n📊 Creating Phase 3: Analytics & Reporting...');
    
    const phase3Project = await client.query(`
      INSERT INTO project_mgmt.projects (
        name, status, health, priority, phase, project_type, related_systems,
        start_date, end_date, owner_id, created_by,
        description, success_criteria, budget
      ) VALUES (
        'Analytics & Reporting Dashboard',
        'Planning', '🟢 Green', 'P1-High', 'Phase 3-Analytics',
        ARRAY['Backend', 'API', 'Infrastructure'], 
        ARRAY['Finance', 'Programs', 'Property', 'Member Directory'],
        '2025-09-01', '2025-11-30',
        $1, $2,
        'Complete analytics and reporting system for board visibility, financial tracking, and program analysis',
        'All reports automated, board dashboard live, real-time financial tracking operational',
        125000
      ) RETURNING id, project_code
    `, [resourceMap['Marcus Chen'], resourceMap['You']]);

    const phase3Id = phase3Project.rows[0].id;
    console.log('Created project:', phase3Project.rows[0].project_code);

    // Phase 3 Milestones
    await client.query(`
      INSERT INTO project_mgmt.milestones (
        project_id, name, due_date, status, impact_if_missed,
        owner_id, completion_criteria, system_components
      ) VALUES
      ($1, 'Financial Dashboards Complete', '2025-09-30', 'Not Started', 'High-Feature Delay',
       $2, 'Real-time revenue tracking, assessment monitoring, payment analytics live',
       ARRAY['Finance API', 'Dashboard Frontend']),
      ($1, 'Program Analytics Live', '2025-10-15', 'Not Started', 'Medium-Performance',
       $3, 'Attendance tracking, revenue analysis, capacity reports functional',
       ARRAY['Events API', 'Analytics Engine']),
      ($1, 'Board Reports Automated', '2025-11-15', 'Not Started', 'Critical-System Down',
       $2, 'Monthly/quarterly reports generate automatically, trustees dashboard active',
       ARRAY['Reporting System', 'PDF Generator'])
    `, [phase3Id, resourceMap['Marcus Chen'], resourceMap['Jessica Park']]);

    // Phase 3 Tasks
    const phase3Tasks = [
      {
        name: 'Design financial dashboard architecture',
        priority: 'P0-Critical',
        type: 'Feature',
        components: ['Analytics', 'Finance API'],
        status: 'To Do',
        hours: 16,
        assignee: 'Marcus Chen'
      },
      {
        name: 'Implement real-time revenue tracking',
        priority: 'P1-High',
        type: 'Feature', 
        components: ['Finance API', 'Analytics'],
        status: 'Backlog',
        hours: 24,
        assignee: null
      },
      {
        name: 'Build assessment collection monitoring',
        priority: 'P1-High',
        type: 'Feature',
        components: ['Finance API', 'Analytics'],
        status: 'Backlog', 
        hours: 20,
        assignee: null
      },
      {
        name: 'Create payment analytics by type/method',
        priority: 'P2-Medium',
        type: 'Feature',
        components: ['Payment Processing', 'Analytics'],
        status: 'Backlog',
        hours: 12,
        assignee: null
      },
      {
        name: 'Develop aging reports for outstanding balances',
        priority: 'P1-High',
        type: 'Feature',
        components: ['Finance API', 'Analytics'],
        status: 'Backlog',
        hours: 16,
        assignee: null
      },
      {
        name: 'Build program attendance tracking',
        priority: 'P2-Medium',
        type: 'Feature',
        components: ['Events API', 'Analytics'],
        status: 'Backlog',
        hours: 18,
        assignee: 'Jessica Park'
      },
      {
        name: 'Create year-over-year program comparisons',
        priority: 'P2-Medium',
        type: 'Feature',
        components: ['Events API', 'Analytics'],
        status: 'Backlog',
        hours: 14,
        assignee: null
      },
      {
        name: 'Implement capacity utilization reports',
        priority: 'P2-Medium',
        type: 'Feature',
        components: ['Events API', 'Analytics'],
        status: 'Backlog',
        hours: 10,
        assignee: null
      },
      {
        name: 'Build member demographics dashboard',
        priority: 'P3-Low',
        type: 'Feature',
        components: ['Core Database', 'Analytics'],
        status: 'Backlog',
        hours: 20,
        assignee: null
      },
      {
        name: 'Create automated board report generation',
        priority: 'P0-Critical',
        type: 'Feature',
        components: ['Reporting System', 'PDF Generator'],
        status: 'Backlog',
        hours: 32,
        assignee: null
      }
    ];

    for (const task of phase3Tasks) {
      await client.query(`
        INSERT INTO project_mgmt.tasks (
          project_id, name, priority, task_type, components,
          status, estimated_hours, assignee_id, created_by,
          acceptance_criteria
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        phase3Id, task.name, task.priority, task.type, task.components,
        task.status, task.hours, 
        task.assignee ? resourceMap[task.assignee] : null,
        resourceMap['You'],
        'Feature works as expected, tests pass, documentation complete'
      ]);
    }

    // ========================================
    // PHASE 4: MEMBER PORTAL & SELF-SERVICE
    // ========================================
    console.log('\n👤 Creating Phase 4: Member Portal & Self-Service...');
    
    const phase4Project = await client.query(`
      INSERT INTO project_mgmt.projects (
        name, status, health, priority, phase, project_type, related_systems,
        start_date, end_date, owner_id, created_by,
        description, success_criteria, budget
      ) VALUES (
        'Member Portal & Self-Service Platform',
        'Planning', '🟢 Green', 'P1-High', 'Phase 4-Portal',
        ARRAY['Frontend', 'API', 'Security'], 
        ARRAY['Member Directory', 'Events', 'Finance', 'Communications'],
        '2025-10-01', '2026-01-31',
        $1, $2,
        'Complete member self-service portal with authentication, payments, registrations, and document access',
        'Members can self-manage accounts, register for events, make payments, access documents',
        180000
      ) RETURNING id, project_code
    `, [resourceMap['Jessica Park'], resourceMap['You']]);

    const phase4Id = phase4Project.rows[0].id;
    console.log('Created project:', phase4Project.rows[0].project_code);

    // Phase 4 Tasks
    const phase4Tasks = [
      {
        name: 'Design authentication system with MFA',
        priority: 'P0-Critical',
        type: 'Feature',
        components: ['Portal', 'Authentication'],
        status: 'To Do',
        hours: 40,
        assignee: 'Marcus Chen'
      },
      {
        name: 'Build secure login and session management',
        priority: 'P0-Critical',
        type: 'Feature',
        components: ['Portal', 'Authentication'],
        status: 'Backlog',
        hours: 32,
        assignee: null
      },
      {
        name: 'Create member account management interface',
        priority: 'P1-High',
        type: 'Feature',
        components: ['Portal', 'Member Directory'],
        status: 'Backlog',
        hours: 48,
        assignee: 'Jessica Park'
      },
      {
        name: 'Implement online payment processing',
        priority: 'P1-High',
        type: 'Feature',
        components: ['Portal', 'Payment Processing'],
        status: 'Backlog',
        hours: 56,
        assignee: null
      },
      {
        name: 'Build event registration system',
        priority: 'P1-High',
        type: 'Feature',
        components: ['Portal', 'Events API'],
        status: 'Backlog',
        hours: 64,
        assignee: null
      },
      {
        name: 'Create document library and access',
        priority: 'P2-Medium',
        type: 'Feature',
        components: ['Portal', 'Document Management'],
        status: 'Backlog',
        hours: 36,
        assignee: null
      },
      {
        name: 'Implement member directory with privacy controls',
        priority: 'P2-Medium',
        type: 'Feature',
        components: ['Portal', 'Member Directory'],
        status: 'Backlog',
        hours: 28,
        assignee: null
      }
    ];

    for (const task of phase4Tasks) {
      await client.query(`
        INSERT INTO project_mgmt.tasks (
          project_id, name, priority, task_type, components,
          status, estimated_hours, assignee_id, created_by,
          acceptance_criteria
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        phase4Id, task.name, task.priority, task.type, task.components,
        task.status, task.hours,
        task.assignee ? resourceMap[task.assignee] : null,
        resourceMap['You'],
        'Feature works as expected, tests pass, security reviewed, documentation complete'
      ]);
    }

    // ========================================
    // IMMEDIATE DEPLOYMENT PROJECT (Current Sprint)
    // ========================================
    console.log('\n🚀 Creating Immediate Deployment Project (August 2025)...');
    
    const deploymentProject = await client.query(`
      INSERT INTO project_mgmt.projects (
        name, status, health, priority, phase, project_type, related_systems,
        start_date, end_date, owner_id, created_by,
        description, success_criteria, budget, actual_spend
      ) VALUES (
        'Bay View System Launch - August 2025',
        'Active', '🟡 Yellow', 'P0-Critical', 'Phase 2D-Governance',
        ARRAY['Deployment', 'Migration', 'Infrastructure'], 
        ARRAY['Chapel', 'Memorial', 'Finance', 'Events', 'Core Database'],
        '2025-07-22', '2025-08-31',
        $1, $2,
        'Deploy completed Bay View unified system to production, migrate real data, train users',
        'System live in production, real members using it, legacy systems archived',
        75000, 25000
      ) RETURNING id, project_code
    `, [resourceMap['Sarah Mitchell'], resourceMap['You']]);

    const deploymentId = deploymentProject.rows[0].id;
    console.log('Created project:', deploymentProject.rows[0].project_code);

    // Create current sprint for deployment (since we cleared all data, this will be fresh)
    const currentSprint = await client.query(`
      INSERT INTO project_mgmt.sprints (
        sprint_number, name, project_id, start_date, end_date,
        sprint_goals, focus_areas, status
      ) VALUES (
        'S2025-07', 'July 2025 - Production Launch Preparation',
        $1, '2025-07-22', '2025-07-31',
        'Prepare production environment, backup legacy systems, deploy APIs',
        ARRAY['Production Setup', 'Data Migration', 'API Deployment'],
        'Active'
      ) RETURNING id
    `, [deploymentId]);

    const sprintId = currentSprint.rows[0].id;

    // Immediate deployment tasks (current work)
    const deploymentTasks = [
      {
        name: 'Backup all legacy systems completely',
        priority: 'P0-Critical',
        type: 'Migration',
        components: ['Legacy Systems', 'Backup'],
        status: 'In Progress',
        hours: 8,
        assignee: 'Robert Torres',
        progress: 60
      },
      {
        name: 'Create production database on DigitalOcean',
        priority: 'P0-Critical',
        type: 'Configuration',
        components: ['Core Database', 'Production'],
        status: 'Done',
        hours: 4,
        assignee: 'Marcus Chen',
        progress: 100
      },
      {
        name: 'Deploy APIs to production Vercel',
        priority: 'P0-Critical',
        type: 'Migration',
        components: ['Chapel API', 'Memorial API', 'Config System'],
        status: 'To Do',
        hours: 6,
        assignee: 'You',
        progress: 0
      },
      {
        name: 'Configure production environment variables',
        priority: 'P0-Critical',
        type: 'Configuration',
        components: ['Production', 'Security'],
        status: 'To Do',
        hours: 3,
        assignee: 'Marcus Chen',
        progress: 0
      },
      {
        name: 'Set up monitoring and alerts for production',
        priority: 'P1-High',
        type: 'Configuration',
        components: ['Monitoring', 'Production'],
        status: 'Backlog',
        hours: 12,
        assignee: null,
        progress: 0
      },
      {
        name: 'Export current member data from legacy systems',
        priority: 'P0-Critical',
        type: 'Migration',
        components: ['Legacy Systems', 'Core Database'],
        status: 'To Do',
        hours: 16,
        assignee: 'Robert Torres',
        progress: 0
      },
      {
        name: 'Import active cottage leaseholders (312 properties)',
        priority: 'P0-Critical',
        type: 'Migration',
        components: ['Property System', 'Core Database'],
        status: 'Backlog',
        hours: 24,
        assignee: null,
        progress: 0
      },
      {
        name: 'Train office staff on new system',
        priority: 'P1-High',
        type: 'Documentation',
        components: ['Training', 'User Support'],
        status: 'Backlog',
        hours: 20,
        assignee: 'Sarah Mitchell',
        progress: 0
      },
      {
        name: 'Test with 10 pilot members',
        priority: 'P1-High',
        type: 'Feature',
        components: ['User Testing', 'Quality Assurance'],
        status: 'Backlog',
        hours: 16,
        assignee: 'Emma Wilson',
        progress: 0
      },
      {
        name: 'Create help guides and documentation',
        priority: 'P2-Medium',
        type: 'Documentation',
        components: ['User Support', 'Documentation'],
        status: 'Backlog',
        hours: 24,
        assignee: 'Emma Wilson',
        progress: 0
      }
    ];

    for (const task of deploymentTasks) {
      await client.query(`
        INSERT INTO project_mgmt.tasks (
          project_id, sprint_id, name, priority, task_type, components,
          status, estimated_hours, assignee_id, created_by, progress,
          acceptance_criteria
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        deploymentId, sprintId, task.name, task.priority, task.type, task.components,
        task.status, task.hours,
        task.assignee === 'You' ? resourceMap['assistant@ai.helper'] : 
        task.assignee ? resourceMap[task.assignee] : null,
        resourceMap['You'], task.progress,
        'Task completed successfully, stakeholders satisfied, no blockers'
      ]);
    }

    // ========================================
    // PHASE 5: FINANCIAL INTEGRATION
    // ========================================
    console.log('\n💰 Creating Phase 5: Financial Integration...');
    
    const phase5Project = await client.query(`
      INSERT INTO project_mgmt.projects (
        name, status, health, priority, phase, project_type, related_systems,
        start_date, end_date, owner_id, created_by,
        description, success_criteria, budget
      ) VALUES (
        'QuickBooks & Financial Integration',
        'Planning', '🟢 Green', 'P1-High', 'Phase 5-Financial',
        ARRAY['Integration', 'API', 'Backend'], 
        ARRAY['Finance', 'QuickBooks', 'Banking'],
        '2025-11-01', '2026-02-28',
        $1, $2,
        'Complete financial system integration with QuickBooks, bank reconciliation, and donor management',
        'All financial data syncs automatically, reconciliation is automated, donor tracking complete',
        95000
      ) RETURNING id, project_code
    `, [resourceMap['Marcus Chen'], resourceMap['You']]);

    const phase5Id = phase5Project.rows[0].id;
    console.log('Created project:', phase5Project.rows[0].project_code);

    // Sample Phase 5 tasks
    const phase5Tasks = [
      {
        name: 'Design QuickBooks integration architecture',
        priority: 'P0-Critical',
        type: 'Feature',
        components: ['QuickBooks', 'Finance API'],
        status: 'Backlog',
        hours: 32,
        assignee: null
      },
      {
        name: 'Build chart of accounts synchronization',
        priority: 'P1-High',
        type: 'Feature',
        components: ['QuickBooks', 'Finance API'],
        status: 'Backlog',
        hours: 40,
        assignee: null
      },
      {
        name: 'Implement automated bank reconciliation',
        priority: 'P1-High',
        type: 'Feature',
        components: ['Banking', 'Finance API'],
        status: 'Backlog',
        hours: 48,
        assignee: null
      }
    ];

    for (const task of phase5Tasks) {
      await client.query(`
        INSERT INTO project_mgmt.tasks (
          project_id, name, priority, task_type, components,
          status, estimated_hours, assignee_id, created_by,
          acceptance_criteria
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        phase5Id, task.name, task.priority, task.type, task.components,
        task.status, task.hours, null, resourceMap['You'],
        'Integration works reliably, data syncs correctly, error handling robust'
      ]);
    }

    // ========================================
    // CREATE A SAMPLE BLOCKER
    // ========================================
    console.log('\n🚫 Creating sample blockers...');
    
    // Generate blocker_id manually since there's no trigger
    const blockerCount = await client.query('SELECT COUNT(*) FROM project_mgmt.blockers');
    const blockerNumber = parseInt(blockerCount.rows[0].count) + 1;
    const blockerId = `BV-BLOCK-${String(blockerNumber).padStart(3, '0')}`;

    const blocker = await client.query(`
      INSERT INTO project_mgmt.blockers (
        blocker_id, title, blocker_type, severity, status,
        components_affected, owner_id, identified_by,
        identified_date, target_resolution,
        impact_description, mitigation_plan
      ) VALUES (
        $1, 'DigitalOcean database connection limit reached',
        'Technical', '🟠 High-Feature Blocked', 'Active',
        ARRAY['Core Database', 'Production'],
        $2, $3,
        CURRENT_DATE, '2025-08-01',
        'Cannot add more concurrent connections for production load testing',
        'Upgrade to higher tier database plan or optimize connection pooling'
      ) RETURNING id
    `, [blockerId, resourceMap['Marcus Chen'], resourceMap['Robert Torres']]);

    // Link blocker to deployment task
    const linkTask = await client.query(`
      SELECT id FROM project_mgmt.tasks 
      WHERE project_id = $1 AND name LIKE '%pilot members%'
    `, [deploymentId]);

    if (linkTask.rows.length > 0) {
      await client.query(`
        INSERT INTO project_mgmt.blocker_relationships (
          blocker_id, blocked_task_id
        ) VALUES ($1, $2)
      `, [blocker.rows[0].id, linkTask.rows[0].id]);
    }

    // ========================================
    // SUMMARY REPORT
    // ========================================
    console.log('\n🎉 Real roadmap data populated successfully!\n');

    // Show summary
    const summary = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM project_mgmt.projects WHERE NOT is_archived) as total_projects,
        (SELECT COUNT(*) FROM project_mgmt.projects WHERE status = 'Active') as active_projects,
        (SELECT COUNT(*) FROM project_mgmt.tasks WHERE NOT is_archived) as total_tasks,
        (SELECT COUNT(*) FROM project_mgmt.tasks WHERE status IN ('To Do', 'In Progress')) as active_tasks,
        (SELECT COUNT(*) FROM project_mgmt.milestones) as total_milestones,
        (SELECT COUNT(*) FROM project_mgmt.blockers WHERE status = 'Active') as active_blockers,
        (SELECT COUNT(*) FROM project_mgmt.sprints) as total_sprints
    `);

    console.log('📊 Database Summary:');
    const stats = summary.rows[0];
    console.log(`• Projects: ${stats.total_projects} total, ${stats.active_projects} active`);
    console.log(`• Tasks: ${stats.total_tasks} total, ${stats.active_tasks} active`);
    console.log(`• Milestones: ${stats.total_milestones}`);
    console.log(`• Blockers: ${stats.active_blockers} active`);
    console.log(`• Sprints: ${stats.total_sprints}`);

    // Show current work queue for any agent
    const workQueue = await client.query(`
      SELECT * FROM project_mgmt.v_agent_work_queue
      ORDER BY 
        CASE priority
          WHEN 'P0-Critical' THEN 1
          WHEN 'P1-High' THEN 2
          WHEN 'P2-Medium' THEN 3
          WHEN 'P3-Low' THEN 4
        END
      LIMIT 8
    `);

    console.log('\n🤖 Top Agent Work Queue:');
    workQueue.rows.forEach((task, i) => {
      console.log(`${i+1}. [${task.priority}] ${task.task_name}`);
      console.log(`   Project: ${task.project_code} | Status: ${task.status} | ${task.assignment_status}`);
      console.log(`   Components: ${task.components?.join(', ') || 'None'}`);
      console.log('');
    });

    console.log('🎯 Next Steps:');
    console.log('1. Any agent can now query: SELECT * FROM project_mgmt.v_agent_work_queue');
    console.log('2. They\'ll see exactly what to work on and why');
    console.log('3. All real Bay View roadmap projects are now tracked');
    console.log('4. Tasks connect to actual system components');

  } catch (error) {
    console.error('❌ Error populating roadmap:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run if called directly
populateRealProjects()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

export { populateRealProjects };