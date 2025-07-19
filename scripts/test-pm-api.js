#!/usr/bin/env node

/**
 * Test Project Management API
 * Tests all PM endpoints locally
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000/api/pm';
const AUTH_TOKEN = 'bva-admin-2025';

async function testPMAPI() {
  console.log('Testing Project Management API...\n');

  try {
    // Test 1: Get Dashboard
    console.log('1. Testing GET /api/pm/get-dashboard');
    const dashboardRes = await fetch(`${BASE_URL}/get-dashboard`);
    const dashboard = await dashboardRes.json();
    
    if (dashboard.success) {
      console.log('✅ Dashboard retrieved successfully');
      console.log(`   - Active Projects: ${dashboard.dashboard.summary.active_projects_count}`);
      console.log(`   - Total Tasks: ${dashboard.dashboard.summary.tasks.total_tasks}`);
      console.log(`   - Active Blockers: ${dashboard.dashboard.summary.active_blockers_count}`);
    } else {
      console.log('❌ Dashboard request failed:', dashboard.error);
    }

    // Test 2: Get Projects
    console.log('\n2. Testing GET /api/pm/get-projects');
    const projectsRes = await fetch(`${BASE_URL}/get-projects?view=overview`);
    const projects = await projectsRes.json();
    
    if (projects.success) {
      console.log(`✅ Retrieved ${projects.count} projects`);
      projects.projects.forEach(p => {
        console.log(`   - ${p.project_code}: ${p.name} [${p.status}] ${p.health}`);
      });
    } else {
      console.log('❌ Projects request failed:', projects.error);
    }

    // Test 3: Get Active Projects Only
    console.log('\n3. Testing GET /api/pm/get-projects?status=Active');
    const activeRes = await fetch(`${BASE_URL}/get-projects?status=Active`);
    const activeProjects = await activeRes.json();
    
    if (activeProjects.success) {
      console.log(`✅ Retrieved ${activeProjects.count} active projects`);
    } else {
      console.log('❌ Active projects request failed:', activeProjects.error);
    }

    // Test 4: Get Tasks
    console.log('\n4. Testing GET /api/pm/get-tasks');
    const tasksRes = await fetch(`${BASE_URL}/get-tasks`);
    const tasks = await tasksRes.json();
    
    if (tasks.success) {
      console.log(`✅ Retrieved ${tasks.tasks.length} tasks`);
      console.log('   Task Status Summary:');
      Object.entries(tasks.stats.by_status).forEach(([status, count]) => {
        console.log(`   - ${status}: ${count}`);
      });
    } else {
      console.log('❌ Tasks request failed:', tasks.error);
    }

    // Test 5: Create a New Task (if we have an active project)
    if (activeProjects.success && activeProjects.projects.length > 0) {
      const projectId = activeProjects.projects[0].id;
      console.log(`\n5. Testing POST /api/pm/create-task for project ${activeProjects.projects[0].project_code}`);
      
      const newTask = {
        project_id: projectId,
        name: 'Test API endpoint documentation',
        status: 'To Do',
        priority: 'P2-Medium',
        task_type: 'Documentation',
        components: ['Chapel API'],
        estimated_hours: 4,
        acceptance_criteria: 'API documentation is complete and accurate'
      };

      const createTaskRes = await fetch(`${BASE_URL}/create-task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        body: JSON.stringify(newTask)
      });
      
      const createdTask = await createTaskRes.json();
      
      if (createdTask.success) {
        console.log(`✅ Created task: ${createdTask.task.task_id}`);
      } else {
        console.log('❌ Create task failed:', createdTask.error);
      }
    }

    // Test 6: Create a New Project
    console.log('\n6. Testing POST /api/pm/create-project');
    
    const newProject = {
      name: 'Test Analytics Dashboard',
      phase: 'Phase 3-Analytics',
      priority: 'P2-Medium',
      project_type: ['Backend', 'API'],
      related_systems: ['Analytics'],
      start_date: '2025-08-01',
      end_date: '2025-09-30',
      description: 'Test project created via API',
      budget: 25000,
      owner_email: 'marcus@bayviewassociation.org'
    };

    const createProjectRes = await fetch(`${BASE_URL}/create-project`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify(newProject)
    });
    
    const createdProject = await createProjectRes.json();
    
    if (createdProject.success) {
      console.log(`✅ Created project: ${createdProject.project.project_code}`);
      console.log(`   - Name: ${createdProject.project.name}`);
      console.log(`   - ID: ${createdProject.project.id}`);
    } else {
      console.log('❌ Create project failed:', createdProject.error);
    }

    // Test 7: Get Projects with Details
    console.log('\n7. Testing GET /api/pm/get-projects?view=detailed');
    const detailedRes = await fetch(`${BASE_URL}/get-projects?view=detailed&status=Active`);
    const detailedProjects = await detailedRes.json();
    
    if (detailedProjects.success && detailedProjects.projects.length > 0) {
      console.log(`✅ Retrieved detailed info for ${detailedProjects.count} projects`);
      const firstProject = detailedProjects.projects[0];
      console.log(`   - ${firstProject.project_code}:`);
      console.log(`     Milestones: ${firstProject.milestones?.length || 0}`);
      console.log(`     Active Tasks: ${firstProject.active_tasks?.length || 0}`);
    } else {
      console.log('❌ Detailed projects request failed:', detailedProjects.error);
    }

    console.log('\n✅ API testing completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('\n⚠️  Make sure the development server is running: npm run dev');
    }
  }
}

// Run tests
testPMAPI();