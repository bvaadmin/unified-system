# Bay View Project Management Database

## Overview

A standalone PostgreSQL-based project management system deployed on DigitalOcean, separate from the Bay View operational database. This system tracks all digital transformation projects, tasks, milestones, and resources.

## Architecture

### Database Schema: `project_mgmt`

The system consists of 6 core tables that mirror the Notion framework but with the power of relational database capabilities:

1. **Projects** - Master tracking for all initiatives
2. **Milestones** - Major checkpoints and deliverables
3. **Tasks** - Granular work items with full tracking
4. **Blockers** - Risk and issue management
5. **Resources** - Team members and allocation
6. **Sprints** - Agile development cycles

### Key Features

- **Auto-generated codes** - Projects (BV-2025-API-001), Tasks (T-S2025-07-001)
- **Dependency tracking** - With circular dependency prevention
- **Resource allocation** - Track team utilization and capacity
- **Progress calculation** - Automatic rollups from tasks to projects
- **Comprehensive views** - Pre-built queries for dashboards
- **Full audit trail** - All changes tracked with timestamps

## Setup Instructions

### 1. Initialize the Database

```bash
# Create the project management schema and tables
npm run init-pm-db

# Populate with sample data
npm run create-pm-data
```

### 2. Environment Configuration

The PM system uses the same `DATABASE_URL` as the main Bay View database but operates in a separate schema (`project_mgmt`).

```env
DATABASE_URL=postgresql://user:pass@host:port/database?sslmode=require
```

## API Endpoints

### Get Dashboard Overview
```http
GET /api/pm/get-dashboard
```
Returns comprehensive dashboard data including:
- Project and task statistics
- Active projects with progress
- Upcoming milestones
- Active blockers
- Resource utilization
- Timeline of upcoming events

### List Projects
```http
GET /api/pm/get-projects?status=Active&view=overview
```
Parameters:
- `status` - Filter by project status
- `phase` - Filter by project phase
- `owner_id` - Filter by owner
- `view` - `list`, `overview`, or `detailed`

### Create Project
```http
POST /api/pm/create-project
Authorization: Bearer {token}
```
Body:
```json
{
  "name": "New API Development",
  "phase": "Phase 3-Analytics",
  "priority": "P1-High",
  "project_type": ["API", "Backend"],
  "related_systems": ["Chapel", "Events"],
  "start_date": "2025-08-01",
  "end_date": "2025-09-30",
  "owner_email": "developer@bayview.org",
  "description": "Build analytics API",
  "budget": 50000
}
```

### List Tasks
```http
GET /api/pm/get-tasks?project_id=1&status=In Progress,To Do
```
Parameters:
- `project_id` - Filter by project
- `sprint_id` - Filter by sprint
- `assignee_id` - Filter by assignee
- `status` - Filter by status (comma-separated)
- `priority` - Filter by priority
- `component` - Filter by component

### Update Task
```http
PUT /api/pm/update-task?task_id=1
Authorization: Bearer {token}
```
Body:
```json
{
  "status": "In Progress",
  "progress": 50,
  "assignee_id": 3,
  "actual_hours": 4.5
}
```

## Database Views

### v_active_projects
Aggregated view of all active projects with:
- Task and milestone counts
- Completion progress
- Active blockers
- Owner information

### v_sprint_velocity
Sprint performance metrics:
- Total and completed story points
- Task completion rates
- Blocker counts

### v_resource_utilization
Team capacity and allocation:
- Active project assignments
- Weekly capacity vs allocated hours
- Utilization percentage

### v_blocker_impact
Blocker analysis showing:
- Number of blocked items
- Severity and status
- Owner and resolution tracking

## Project Codes

Projects are automatically assigned codes in the format:
```
BV-{YEAR}-{TYPE}-{NUMBER}
```

Types:
- **BE** - Backend
- **DB** - Database
- **API** - API Development
- **MIG** - Migration
- **INF** - Infrastructure
- **INT** - Integration
- **SEC** - Security
- **GEN** - General

## Task Management

### Task States
- **Backlog** - Not yet prioritized
- **To Do** - Ready to start
- **In Progress** - Being worked on
- **Code Review** - Awaiting review
- **Testing** - In QA
- **Done** - Completed
- **Blocked** - Has blockers

### Story Points
Tasks use story points for estimation:
- 1-2 points: Small task (< 1 day)
- 3-5 points: Medium task (2-3 days)
- 8 points: Large task (1 week)
- 13+ points: Should be broken down

## Resource Management

### Resource Types
- **Developer** - Software development
- **DBA** - Database administration
- **DevOps** - Infrastructure and deployment
- **QA** - Quality assurance
- **Director** - Program/department directors
- **External** - Contractors and consultants

### Allocation Tracking
- Resources can be allocated to multiple projects
- Allocation percentage tracks commitment
- Utilization calculated against weekly capacity (40 hours * availability%)

## Blocker Management

### Severity Levels
1. **🔴 Critical-System Down** - Production outage
2. **🟠 High-Feature Blocked** - Feature cannot proceed
3. **🟡 Medium-Workaround Exists** - Can proceed with limitations
4. **🟢 Low-Minor Impact** - Minimal impact

### Blocker Types
- **Technical** - Code/architecture issues
- **Resource** - People/budget constraints
- **External** - Third-party dependencies
- **Process** - Procedural blockers
- **Data** - Data quality/availability
- **Integration** - System integration issues

## Sprint Management

Sprints follow the naming convention: `S{YEAR}-{NUMBER}`

Example: `S2025-07` (7th sprint of 2025)

### Sprint Workflow
1. **Planning** - Define goals and select tasks
2. **Active** - Sprint in progress
3. **Review** - Sprint review and demo
4. **Completed** - Retrospective done

## Security

The PM database uses PostgreSQL row-level security with three roles:
- **pm_viewer** - Read-only access
- **pm_editor** - Read/write access
- **pm_admin** - Full control

## Best Practices

1. **Update task progress daily** - Keep progress accurate
2. **Close blockers promptly** - Don't leave resolved blockers open
3. **Use consistent priorities** - P0 is truly critical
4. **Link related items** - Connect tasks to milestones and blockers
5. **Document decisions** - Use technical notes field

## Integration Points

While separate from the operational database, the PM system can reference:
- Configuration settings from `config` schema
- User/member data (read-only)
- System components being developed

## Reporting

Key reports available through the dashboard API:
- Project portfolio overview
- Sprint velocity trends
- Resource utilization heatmap
- Milestone timeline
- Blocker impact analysis
- Task burndown charts

## Maintenance

### Regular Tasks
- Archive completed projects quarterly
- Review and close stale blockers
- Update resource availability
- Clean up old sprint data

### Performance
All key queries are optimized with indexes on:
- Foreign keys
- Status and date fields
- Array fields using GIN indexes

## Future Enhancements

1. **GitHub Integration** - Auto-update tasks from commits
2. **Slack Notifications** - Real-time updates
3. **Time Tracking** - Detailed hour logging
4. **Budget Tracking** - Financial integration
5. **Reporting API** - Custom report generation