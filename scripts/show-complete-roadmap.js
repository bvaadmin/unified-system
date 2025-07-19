#!/usr/bin/env node

import pg from 'pg';
import dotenv from 'dotenv';

const { Client } = pg;
dotenv.config();

async function showCompleteRoadmap() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('🎯 COMPLETE BAY VIEW ROADMAP IN PMD\n');

    // Show all projects by status
    const projects = await client.query(`
      SELECT project_code, name, status, phase, 
             COALESCE(budget, 0) as budget, 
             COALESCE(actual_spend, 0) as actual_spend
      FROM project_mgmt.projects 
      WHERE NOT is_archived
      ORDER BY 
        CASE status 
          WHEN 'Completed' THEN 1 
          WHEN 'Active' THEN 2 
          WHEN 'Planning' THEN 3 
        END, 
        start_date
    `);

    console.log('📊 ALL PROJECTS:');
    projects.rows.forEach(p => {
      const budget = p.budget ? `$${(p.budget/1000).toFixed(0)}k` : 'TBD';
      const spend = p.actual_spend ? ` (spent: $${(p.actual_spend/1000).toFixed(0)}k)` : '';
      console.log(`   ${p.status === 'Completed' ? '✅' : p.status === 'Active' ? '🚀' : '📋'} ${p.project_code}: ${p.name}`);
      console.log(`      Phase: ${p.phase} | Budget: ${budget}${spend}`);
    });

    // Show current work queue
    const workQueue = await client.query(`
      SELECT * FROM project_mgmt.v_agent_work_queue
      ORDER BY 
        CASE priority
          WHEN 'P0-Critical' THEN 1
          WHEN 'P1-High' THEN 2
          WHEN 'P2-Medium' THEN 3
          WHEN 'P3-Low' THEN 4
        END
      LIMIT 10
    `);

    console.log('\n🤖 CURRENT AGENT WORK QUEUE:');
    workQueue.rows.forEach((task, i) => {
      console.log(`${i+1}. [${task.priority}] ${task.task_name}`);
      console.log(`   Project: ${task.project_code} | Status: ${task.status} | ${task.assignment_status}`);
      console.log(`   Components: ${task.components?.join(', ') || 'None'}`);
      console.log('');
    });

    // Show budget totals
    const budgetSummary = await client.query(`
      SELECT 
        SUM(budget) as total_budget,
        SUM(actual_spend) as total_spend,
        COUNT(*) FILTER (WHERE status = 'Completed') as completed_count,
        COUNT(*) FILTER (WHERE status = 'Active') as active_count,
        COUNT(*) FILTER (WHERE status = 'Planning') as planning_count
      FROM project_mgmt.projects 
      WHERE NOT is_archived
    `);

    const bs = budgetSummary.rows[0];
    console.log('💰 ROADMAP BUDGET SUMMARY:');
    console.log(`   Total Budget: $${(bs.total_budget/1000).toFixed(0)}k`);
    console.log(`   Total Spent: $${(bs.total_spend/1000).toFixed(0)}k`);
    console.log(`   Remaining: $${((bs.total_budget - bs.total_spend)/1000).toFixed(0)}k`);
    console.log(`   Projects: ${bs.completed_count} completed, ${bs.active_count} active, ${bs.planning_count} planned`);

  } finally {
    await client.end();
  }
}

showCompleteRoadmap().catch(console.error);