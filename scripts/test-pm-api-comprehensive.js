#!/usr/bin/env node

/**
 * Comprehensive Test Suite for Project Management API
 * Tests all endpoints with various scenarios including error cases
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}/api/pm`
  : 'http://localhost:3000/api/pm';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

// Test utilities
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName, passed, details = '') {
  const symbol = passed ? '✓' : '✗';
  const color = passed ? 'green' : 'red';
  log(`  ${symbol} ${testName} ${details}`, color);
  return passed;
}

async function testEndpoint(name, method, endpoint, options = {}) {
  const { headers = {}, body, expectedStatus = 200, validateResponse } = options;
  
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const responseData = await response.json();
    const statusPassed = response.status === expectedStatus;
    
    if (!statusPassed) {
      logTest(name, false, `Expected ${expectedStatus}, got ${response.status}`);
      console.log('Response:', responseData);
      return false;
    }

    if (validateResponse) {
      const validationPassed = validateResponse(responseData);
      return logTest(name, validationPassed, validationPassed ? '' : 'Validation failed');
    }

    return logTest(name, true);
  } catch (error) {
    logTest(name, false, `Error: ${error.message}`);
    return false;
  }
}

// Test data
let createdProjectId;
let createdTaskId;

async function runTests() {
  log('\n=== Project Management API Test Suite ===\n', 'blue');
  
  let totalTests = 0;
  let passedTests = 0;

  // 1. Authentication Tests
  log('\n1. Authentication Tests', 'yellow');
  
  totalTests++;
  if (await testEndpoint('POST /create-project without auth', 'POST', '/create-project', {
    expectedStatus: 401,
    body: { name: 'Test Project', phase: 'Phase 1' }
  })) passedTests++;

  totalTests++;
  if (await testEndpoint('POST /create-project with invalid token', 'POST', '/create-project', {
    headers: { 'Authorization': 'Bearer invalid-token' },
    expectedStatus: 401,
    body: { name: 'Test Project', phase: 'Phase 1' }
  })) passedTests++;

  totalTests++;
  if (await testEndpoint('PUT /update-task without auth', 'PUT', '/update-task?task_id=1', {
    expectedStatus: 401,
    body: { status: 'In Progress' }
  })) passedTests++;

  // 2. Input Validation Tests
  log('\n2. Input Validation Tests', 'yellow');

  totalTests++;
  if (await testEndpoint('POST /create-project missing required fields', 'POST', '/create-project', {
    headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` },
    expectedStatus: 400,
    body: { name: 'Test Project' } // Missing phase
  })) passedTests++;

  totalTests++;
  if (await testEndpoint('POST /create-project invalid email', 'POST', '/create-project', {
    headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` },
    expectedStatus: 400,
    body: { 
      name: 'Test Project', 
      phase: 'Phase 1',
      owner_email: 'invalid-email'
    }
  })) passedTests++;

  totalTests++;
  if (await testEndpoint('POST /create-project invalid arrays', 'POST', '/create-project', {
    headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` },
    expectedStatus: 400,
    body: { 
      name: 'Test Project', 
      phase: 'Phase 1',
      project_type: 'not-an-array'
    }
  })) passedTests++;

  totalTests++;
  if (await testEndpoint('POST /create-project invalid budget', 'POST', '/create-project', {
    headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` },
    expectedStatus: 400,
    body: { 
      name: 'Test Project', 
      phase: 'Phase 1',
      budget: -1000
    }
  })) passedTests++;

  totalTests++;
  if (await testEndpoint('GET /get-projects invalid owner_id', 'GET', '/get-projects?owner_id=invalid', {
    expectedStatus: 400
  })) passedTests++;

  totalTests++;
  if (await testEndpoint('GET /get-tasks invalid project_id', 'GET', '/get-tasks?project_id=abc', {
    expectedStatus: 400
  })) passedTests++;

  totalTests++;
  if (await testEndpoint('PUT /update-task invalid task_id', 'PUT', '/update-task?task_id=invalid', {
    headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` },
    expectedStatus: 400,
    body: { status: 'In Progress' }
  })) passedTests++;

  // 3. Pagination Tests
  log('\n3. Pagination Tests', 'yellow');

  totalTests++;
  if (await testEndpoint('GET /get-projects with pagination', 'GET', '/get-projects?limit=10&offset=0', {
    validateResponse: (data) => {
      return data.pagination && 
             data.pagination.limit === 10 && 
             data.pagination.offset === 0 &&
             typeof data.pagination.total === 'number' &&
             typeof data.pagination.hasMore === 'boolean';
    }
  })) passedTests++;

  totalTests++;
  if (await testEndpoint('GET /get-projects invalid limit', 'GET', '/get-projects?limit=-1', {
    expectedStatus: 400
  })) passedTests++;

  totalTests++;
  if (await testEndpoint('GET /get-projects limit exceeds max', 'GET', '/get-projects?limit=200', {
    validateResponse: (data) => data.pagination && data.pagination.limit === 100
  })) passedTests++;

  totalTests++;
  if (await testEndpoint('GET /get-tasks with pagination', 'GET', '/get-tasks?limit=5&offset=10', {
    validateResponse: (data) => {
      return data.pagination && 
             data.pagination.limit === 5 && 
             data.pagination.offset === 10;
    }
  })) passedTests++;

  // 4. Successful Operation Tests
  log('\n4. Successful Operation Tests', 'yellow');

  totalTests++;
  const createProjectResult = await testEndpoint('POST /create-project success', 'POST', '/create-project', {
    headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` },
    body: {
      name: 'PM Test Project ' + Date.now(),
      phase: 'Phase 2D',
      status: 'Active',
      health: '🟢 Green',
      priority: 'P1-High',
      description: 'Test project for API validation',
      budget: 50000,
      project_type: ['API', 'Testing'],
      related_systems: ['project_mgmt'],
      stakeholder_emails: ['test@example.com', 'pm@bayview.org']
    },
    validateResponse: (data) => {
      if (data.success && data.project && data.project.id) {
        createdProjectId = data.project.id;
        return true;
      }
      return false;
    }
  });
  if (createProjectResult) passedTests++;

  totalTests++;
  if (await testEndpoint('GET /get-projects filter by status', 'GET', '/get-projects?status=Active', {
    validateResponse: (data) => {
      return data.success && 
             Array.isArray(data.projects) &&
             data.projects.every(p => p.status === 'Active');
    }
  })) passedTests++;

  totalTests++;
  if (await testEndpoint('GET /get-projects detailed view', 'GET', '/get-projects?view=detailed&limit=5', {
    validateResponse: (data) => {
      return data.success && 
             Array.isArray(data.projects) &&
             data.projects.length > 0 &&
             data.projects[0].milestones !== undefined &&
             data.projects[0].active_tasks !== undefined;
    }
  })) passedTests++;

  totalTests++;
  if (await testEndpoint('GET /get-dashboard', 'GET', '/get-dashboard', {
    validateResponse: (data) => {
      return data.success && 
             data.projectStats &&
             data.taskStats &&
             data.milestoneStats &&
             data.resourceUtilization;
    }
  })) passedTests++;

  // 5. Task Management Tests
  log('\n5. Task Management Tests', 'yellow');

  if (createdProjectId) {
    totalTests++;
    if (await testEndpoint('GET /get-tasks by project', 'GET', `/get-tasks?project_id=${createdProjectId}`, {
      validateResponse: (data) => {
        return data.success && 
               Array.isArray(data.tasks) &&
               data.stats &&
               data.pagination;
      }
    })) passedTests++;
  }

  // 6. Error Handling Tests
  log('\n6. Error Handling Tests', 'yellow');

  totalTests++;
  if (await testEndpoint('PUT /update-task non-existent task', 'PUT', '/update-task?task_id=999999', {
    headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` },
    expectedStatus: 404,
    body: { status: 'Done' }
  })) passedTests++;

  totalTests++;
  if (await testEndpoint('GET /invalid-endpoint', 'GET', '/invalid-endpoint', {
    expectedStatus: 404
  })) passedTests++;

  // Results
  log('\n=== Test Results ===', 'blue');
  const percentage = Math.round((passedTests / totalTests) * 100);
  const resultColor = percentage === 100 ? 'green' : percentage >= 80 ? 'yellow' : 'red';
  
  log(`\nTotal Tests: ${totalTests}`, 'blue');
  log(`Passed: ${passedTests}`, 'green');
  log(`Failed: ${totalTests - passedTests}`, 'red');
  log(`Success Rate: ${percentage}%\n`, resultColor);

  return passedTests === totalTests;
}

// Run tests
runTests()
  .then(allPassed => {
    process.exit(allPassed ? 0 : 1);
  })
  .catch(error => {
    log(`\nTest suite error: ${error.message}`, 'red');
    process.exit(1);
  });