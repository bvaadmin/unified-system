#!/usr/bin/env node

/**
 * Create Project Management Data
 * Populates the project management database with Bay View projects
 */

import pg from 'pg';
import dotenv from 'dotenv';

const { Client } = pg;
dotenv.config();

async function createProjectManagementData() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Get resource IDs
    const resources = await client.query(`
      SELECT id, name, email FROM project_mgmt.resources
    `);
    const resourceMap = {};
    resources.rows.forEach(r => {
      resourceMap[r.name] = r.id;
    });

    console.log('\nCreating projects...');

    // Project 1: Unified Database Migration (Completed)
    const project1 = await client.query(`
      INSERT INTO project_mgmt.projects (
        name, status, health, priority, phase, project_type, related_systems,
        start_date, end_date, actual_start, actual_end,
        owner_id, created_by, description, success_criteria, budget
      ) VALUES (
        'Bay View Unified Database Migration',
        'Completed', '🟢 Green', 'P0-Critical', 'Phase 2D-Governance',
        ARRAY['Database', 'Migration'], ARRAY['Chapel', 'Memorial', 'Property', 'Finance'],
        '2025-01-01', '2025-03-31', '2025-01-01', '2025-03-15',
        $1, $2,
        'Complete migration from legacy systems to unified PostgreSQL database with dual-write safety',
        'All data migrated without loss, dual-write active, zero downtime',
        75000
      ) RETURNING id, project_code
    `, [resourceMap['Sarah Mitchell'], resourceMap['You']]);

    console.log(`Created project: ${project1.rows[0].project_code}`);

    // Project 2: Runtime Configuration System (Completed)
    const project2 = await client.query(`
      INSERT INTO project_mgmt.projects (
        name, status, health, priority, phase, project_type, related_systems,
        start_date, end_date, actual_start, actual_end,
        owner_id, created_by, description, success_criteria, budget, actual_spend
      ) VALUES (
        'Runtime Configuration System',
        'Completed', '🟢 Green', 'P1-High', 'Phase 2D-Governance',
        ARRAY['Backend', 'Infrastructure'], ARRAY['Finance', 'Events', 'Chapel', 'Memorial'],
        '2024-12-01', '2025-01-10', '2024-12-01', '2025-01-10',
        $1, $2,
        'Implement runtime configuration for all fees, budgets, and settings',
        'All hardcoded values moved to config, full audit trail',
        25000, 23500
      ) RETURNING id, project_code
    `, [resourceMap['Marcus Chen'], resourceMap['You']]);

    console.log(`Created project: ${project2.rows[0].project_code}`);

    // Project 3: Chapel Service API v2 (Active)
    const project3 = await client.query(`
      INSERT INTO project_mgmt.projects (
        name, status, health, priority, phase, project_type, related_systems,
        start_date, end_date, owner_id, created_by,
        description, success_criteria, budget
      ) VALUES (
        'Chapel Service API v2',
        'Active', '🟡 Yellow', 'P1-High', 'Phase 2B-Events',
        ARRAY['API', 'Backend'], ARRAY['Chapel', 'Events'],
        '2025-07-15', '2025-08-31',
        $1, $2,
        'Upgrade chapel service submission API to use new unified database',
        'New API handles all chapel bookings with improved performance',
        45000
      ) RETURNING id, project_code
    `, [resourceMap['Jessica Park'], resourceMap['You']]);

    console.log(`Created project: ${project3.rows[0].project_code}`);

    // Create milestones
    console.log('\nCreating milestones...');

    // Milestones for Project 1
    await client.query(`
      INSERT INTO project_mgmt.milestones (
        project_id, name, due_date, status, impact_if_missed,
        owner_id, completion_criteria, system_components, completed_date
      ) VALUES
      ($1, 'Legacy Data Migration Complete', '2025-02-15', 'Complete', 'High-Feature Delay',
       $2, 'All legacy data successfully migrated and validated', 
       ARRAY['Database'], '2025-02-10'),
      ($1, 'Dual-Write Verified', '2025-02-01', 'Complete', 'Critical-System Down',
       $3, 'Both legacy and modern systems receive all writes',
       ARRAY['Database', 'API'], '2025-01-28'),
      ($1, 'Production Cutover', '2025-03-15', 'Complete', 'Critical-System Down',
       $2, 'New system is primary, legacy system archived',
       ARRAY['Database', 'API', 'Integration'], '2025-03-15')
    `, [project1.rows[0].id, resourceMap['Robert Torres'], resourceMap['Marcus Chen']]);

    // Create tasks
    console.log('\nCreating tasks...');

    // Get current sprint
    const sprint = await client.query(`
      INSERT INTO project_mgmt.sprints (
        sprint_number, name, project_id, start_date, end_date,
        sprint_goals, focus_areas, status
      ) VALUES (
        'S2025-07', 'July Sprint - Launch Preparation',
        $1, '2025-07-15', '2025-07-31',
        'Complete API v2, prepare for August launch, fix critical bugs',
        ARRAY['API Development', 'Testing', 'Documentation'],
        'Active'
      ) RETURNING id
    `, [project3.rows[0].id]);

    // Tasks for active project
    const tasks = [
      {
        name: 'Implement dual-write manager for chapel services',
        status: 'In Progress',
        priority: 'P0-Critical',
        type: 'Feature',
        points: 8,
        assignee: 'Marcus Chen',
        progress: 75,
        components: ['Chapel API', 'Dual-Write']
      },
      {
        name: 'Add payment provider configuration to config system',
        status: 'To Do',
        priority: 'P1-High',
        type: 'Configuration',
        points: 3,
        assignee: 'Jessica Park',
        progress: 0,
        components: ['Config System', 'Payment Processing']
      },
      {
        name: 'Create chapel availability checking function',
        status: 'Done',
        priority: 'P0-Critical',
        type: 'Feature',
        points: 5,
        assignee: 'Marcus Chen',
        progress: 100,
        components: ['Chapel API', 'Core Database']
      },
      {
        name: 'Write API documentation for chapel endpoints',
        status: 'To Do',
        priority: 'P2-Medium',
        type: 'Documentation',
        points: 2,
        assignee: 'Emma Wilson',
        progress: 0,
        components: ['Chapel API']
      }
    ];

    for (const task of tasks) {
      await client.query(`
        INSERT INTO project_mgmt.tasks (
          project_id, sprint_id, name, status, priority, task_type,
          story_points, assignee_id, progress, components,
          estimated_hours, test_coverage, migration_safe,
          created_by, acceptance_criteria
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $7 * 4, true, true, $11,
          'Feature works as expected, tests pass, documentation complete'
        )
      `, [
        project3.rows[0].id,
        sprint.rows[0].id,
        task.name,
        task.status,
        task.priority,
        task.type,
        task.points,
        resourceMap[task.assignee],
        task.progress,
        task.components,
        resourceMap['You']
      ]);
    }

    // Create a blocker
    console.log('\nCreating blockers...');

    const blocker = await client.query(`
      INSERT INTO project_mgmt.blockers (
        title, blocker_type, severity, status,
        components_affected, owner_id, identified_by,
        identified_date, target_resolution,
        impact_description, mitigation_plan
      ) VALUES (
        'Stripe payment gateway security review delay',
        'External', '🟡 Medium-Workaround Exists', 'Mitigating',
        ARRAY['Payment System', 'API'],
        $1, $2,
        '2025-07-15', '2025-08-01',
        'Cannot process live payments until Stripe approves our integration',
        'Use manual payment entry as workaround, expedite review process'
      ) RETURNING id
    `, [resourceMap['Sarah Mitchell'], resourceMap['Jessica Park']]);

    // Link blocker to project
    await client.query(`
      INSERT INTO project_mgmt.blocker_relationships (
        blocker_id, blocked_project_id
      ) VALUES ($1, $2)
    `, [blocker.rows[0].id, project3.rows[0].id]);

    // Create resource allocations
    console.log('\nCreating resource allocations...');

    const allocations = [
      { resource: 'Marcus Chen', project: project3.rows[0].id, percent: 80 },
      { resource: 'Jessica Park', project: project3.rows[0].id, percent: 100 },
      { resource: 'Emma Wilson', project: project3.rows[0].id, percent: 50 },
      { resource: 'Sarah Mitchell', project: project3.rows[0].id, percent: 20 }
    ];

    for (const alloc of allocations) {
      await client.query(`
        INSERT INTO project_mgmt.resource_allocations (
          resource_id, project_id, allocation_percent,
          start_date, role_on_project
        ) VALUES ($1, $2, $3, CURRENT_DATE, 'Team Member')
      `, [resourceMap[alloc.resource], alloc.project, alloc.percent]);
    }

    // Create stakeholders
    await client.query(`
      INSERT INTO project_mgmt.project_stakeholders (project_id, resource_id, role)
      VALUES 
      ($1, $2, 'Executive Sponsor'),
      ($1, $3, 'Technical Lead'),
      ($1, $4, 'Business Owner')
    `, [
      project3.rows[0].id,
      resourceMap['Lisa Anderson'],
      resourceMap['Sam'],
      resourceMap['David Thompson']
    ]);

    console.log('\n✅ Project management data created successfully!');

    // Show summary
    const summary = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM project_mgmt.projects) as projects,
        (SELECT COUNT(*) FROM project_mgmt.milestones) as milestones,
        (SELECT COUNT(*) FROM project_mgmt.tasks) as tasks,
        (SELECT COUNT(*) FROM project_mgmt.blockers) as blockers,
        (SELECT COUNT(*) FROM project_mgmt.resources) as resources,
        (SELECT COUNT(*) FROM project_mgmt.sprints) as sprints
    `);

    console.log('\nDatabase Summary:');
    console.log(`- Projects: ${summary.rows[0].projects}`);
    console.log(`- Milestones: ${summary.rows[0].milestones}`);
    console.log(`- Tasks: ${summary.rows[0].tasks}`);
    console.log(`- Blockers: ${summary.rows[0].blockers}`);
    console.log(`- Resources: ${summary.rows[0].resources}`);
    console.log(`- Sprints: ${summary.rows[0].sprints}`);

    // Show active project status
    const activeProjects = await client.query(`
      SELECT * FROM project_mgmt.v_active_projects
      ORDER BY priority
    `);

    console.log('\nActive Projects:');
    activeProjects.rows.forEach(p => {
      console.log(`- ${p.project_code}: ${p.name}`);
      console.log(`  Status: ${p.health} | Progress: ${p.avg_progress}% | Tasks: ${p.task_count} (${p.completed_tasks} done)`);
      console.log(`  Blockers: ${p.active_blockers} | Owner: ${p.owner_name}`);
    });

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run if called directly
createProjectManagementData()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

export { createProjectManagementData };