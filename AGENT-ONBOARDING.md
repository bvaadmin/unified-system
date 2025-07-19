# 🤖 Agent/Developer Onboarding Guide

Welcome to the Bay View Association Digital Transformation Project! This guide will get you productive in 5 minutes.

## 🚀 Quick Start - Your First Query

Connect to the project management database and run:

```sql
-- Get your work assignments
SELECT * FROM project_mgmt.v_agent_work_queue 
WHERE assignment_status LIKE '%AVAILABLE%' 
   OR assignment_status LIKE '%AI%'
ORDER BY urgency_score DESC 
LIMIT 10;
```

This shows you exactly what needs to be done, in priority order.

## 📊 Understanding the Project - 4 Essential Views

### 1. What Should I Work On?
```sql
-- Your personalized work queue
SELECT * FROM project_mgmt.v_agent_work_queue;
```
- Shows tasks by urgency score
- Indicates if blocked or waiting on dependencies
- Highlights unassigned work you can claim

### 2. What Are We Building?
```sql
-- Project context and goals
SELECT * FROM project_mgmt.v_project_context;
```
- Active projects with descriptions
- Success criteria
- Progress and next milestones
- Budget status

### 3. What Systems Exist?
```sql
-- System and component map
SELECT * FROM project_mgmt.v_system_knowledge;
```
- All Bay View systems (Chapel, Memorial, Property, etc.)
- Components (APIs, databases, forms)
- Where active work is happening

### 4. What Happened Recently?
```sql
-- Last 7 days of activity
SELECT * FROM project_mgmt.v_recent_activity;
```
- Task updates
- New blockers
- Completed milestones

## 🎯 Your Mission Briefing

Run this for an instant summary:

```sql
SELECT * FROM project_mgmt.get_agent_briefing();
```

Returns:
- Current project phase
- Priority task count
- Active blockers
- Available work
- Sprint status

## 💼 Claiming and Working on Tasks

### See Available Work
```sql
-- Unassigned tasks ready to start
SELECT task_id, task_name, project_code, priority, components, estimated_hours
FROM project_mgmt.v_agent_work_queue
WHERE assignment_status LIKE '%AVAILABLE%'
  AND work_status = '✅ READY TO START'
ORDER BY urgency_score DESC;
```

### Claim a Task
```sql
-- Assign task to yourself (AI agent)
SELECT project_mgmt.agent_claim_task('T-S2025-07-001');
```

### View Your Tasks
```sql
-- Your current assignments
SELECT * FROM project_mgmt.agent_my_tasks();
```

### Update Task Progress
```sql
-- Mark progress on your task
UPDATE project_mgmt.tasks 
SET progress = 50, 
    status = 'In Progress',
    actual_hours = 2.5
WHERE task_id = 'T-S2025-07-001';
```

## 🏗️ Bay View System Architecture

### Core Systems You're Working With:
1. **Chapel** - Service scheduling and management
2. **Memorial** - Memorial garden applications
3. **Property** - Cottage/lot management (Block/Lot system)
4. **Finance** - Assessments and payments
5. **Events** - Program registration
6. **Communications** - Member notifications

### Current Phase Focus:
Check `SELECT DISTINCT phase FROM project_mgmt.v_project_context` to see active phases.

### Technology Stack:
- **Database**: PostgreSQL on DigitalOcean
- **APIs**: Node.js on Vercel
- **Frontend**: GitHub Pages (forms)
- **Integration**: Notion (workflow management)

## 🚨 Checking for Blockers

Before starting work, always check:

```sql
-- See all active blockers
SELECT b.*, 
       STRING_AGG(t.task_id || ': ' || t.name, '; ') as blocked_tasks
FROM project_mgmt.v_blocker_impact b
LEFT JOIN project_mgmt.blocker_relationships br ON b.id = br.blocker_id
LEFT JOIN project_mgmt.tasks t ON br.blocked_task_id = t.id
WHERE b.status IN ('Active', 'Mitigating')
GROUP BY b.id, b.blocker_id, b.title, b.severity, b.status, 
         b.owner_name, b.blocked_tasks, b.blocked_milestones, b.blocked_projects;
```

## 📈 Tracking Progress

### Sprint Progress
```sql
-- Current sprint status
SELECT * FROM project_mgmt.v_sprint_velocity
WHERE status = 'Active';
```

### Project Health
```sql
-- Project dashboard
SELECT project_code, name, health, 
       overall_progress || '%' as progress,
       completed_tasks || '/' || (completed_tasks + remaining_tasks) as task_status,
       next_milestone
FROM project_mgmt.v_project_context
ORDER BY project_code;
```

## 🔗 Key Resources

### Database Connection
- Host: `bayview-association-db-do-user-15688023-0.g.db.ondigitalocean.com`
- Schema: `project_mgmt`
- Your ID: Look for `email = 'assistant@ai.helper'` in resources table

### API Endpoints
- Dashboard: `GET /api/pm/get-dashboard`
- Projects: `GET /api/pm/get-projects`
- Tasks: `GET /api/pm/get-tasks`
- Update Task: `PUT /api/pm/update-task?task_id=XXX`

### Documentation
- `/docs/project-management-database.md` - Full PM system docs
- `/CLAUDE.md` - Bay View specific context
- `/docs/database-er-diagram.md` - System architecture

## 💡 Pro Tips for Agents

1. **Start with the work queue** - It's sorted by urgency
2. **Check dependencies** - Some tasks wait on others
3. **Read acceptance criteria** - It defines "done"
4. **Update progress regularly** - Keeps everyone informed
5. **Flag blockers immediately** - Don't wait

## 🆘 Common Queries

### Find specific component work
```sql
SELECT * FROM project_mgmt.v_agent_work_queue
WHERE 'Chapel API' = ANY(components);
```

### See milestone deadlines
```sql
SELECT m.*, p.project_code
FROM project_mgmt.milestones m
JOIN project_mgmt.projects p ON m.project_id = p.id
WHERE m.status != 'Complete'
ORDER BY m.due_date;
```

### Check resource allocation
```sql
SELECT * FROM project_mgmt.v_resource_utilization
ORDER BY total_allocation_percent DESC;
```

## 🎉 Ready to Start!

1. Run the agent briefing function
2. Check the work queue
3. Claim your first task
4. Make Bay View better!

Remember: This PM database is your single source of truth. When in doubt, query it!