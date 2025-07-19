import { withDatabase, withTransaction } from '../lib/db.js';
import { withCors } from '../lib/cors.js';

/**
 * Unified Project Management API
 * Handles all PM operations through a single endpoint
 */
export default withCors(async (req, res) => {
  const { action } = req.query;
  
  if (!action) {
    return res.status(400).json({ error: 'Missing action parameter' });
  }

  // Route to appropriate handler based on action
  switch (action) {
    case 'create-project':
      return handleCreateProject(req, res);
    case 'get-projects':
      return handleGetProjects(req, res);
    case 'get-tasks':
      return handleGetTasks(req, res);
    case 'update-task':
      return handleUpdateTask(req, res);
    case 'get-dashboard':
      return handleGetDashboard(req, res);
    default:
      return res.status(400).json({ error: `Unknown action: ${action}` });
  }
});

// CREATE PROJECT
async function handleCreateProject(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate Bearer token against ADMIN_TOKEN
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization required' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Invalid authentication token' });
  }

  return withDatabase(async (client) => {
    return withTransaction(client, async () => {
      const {
        name,
        status = 'Planning',
        health = '🟢 Green',
        priority = 'P2-Medium',
        phase,
        project_type = [],
        related_systems = [],
        start_date,
        end_date,
        owner_email,
        description,
        success_criteria,
        budget,
        stakeholder_emails = []
      } = req.body;

      // Validation
      if (!name || !phase) {
        return res.status(400).json({ 
          error: 'Missing required fields: name, phase' 
        });
      }
      
      // Validate email formats
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (owner_email && !emailRegex.test(owner_email)) {
        return res.status(400).json({ error: 'Invalid owner email format' });
      }
      
      // Validate array fields
      if (!Array.isArray(project_type) || !Array.isArray(related_systems) || !Array.isArray(stakeholder_emails)) {
        return res.status(400).json({ error: 'project_type, related_systems, and stakeholder_emails must be arrays' });
      }
      
      // Validate stakeholder emails
      for (const email of stakeholder_emails) {
        if (!emailRegex.test(email)) {
          return res.status(400).json({ error: `Invalid stakeholder email format: ${email}` });
        }
      }
      
      // Validate budget if provided
      if (budget !== undefined && budget !== null) {
        const budgetNum = parseFloat(budget);
        if (isNaN(budgetNum) || budgetNum < 0) {
          return res.status(400).json({ error: 'Budget must be a positive number' });
        }
      }

      // Get owner by email
      let owner_id = null;
      if (owner_email) {
        const ownerResult = await client.query(
          'SELECT id FROM project_mgmt.resources WHERE email = $1',
          [owner_email]
        );
        if (ownerResult.rows.length > 0) {
          owner_id = ownerResult.rows[0].id;
        }
      }

      // Get creator - use owner_id if available, otherwise use system user
      const created_by = owner_id || null;

      // Create project
      const projectResult = await client.query(`
        INSERT INTO project_mgmt.projects (
          name, status, health, priority, phase, project_type, related_systems,
          start_date, end_date, owner_id, created_by,
          description, success_criteria, budget
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        ) RETURNING *
      `, [
        name, status, health, priority, phase, project_type, related_systems,
        start_date, end_date, owner_id, created_by,
        description, success_criteria, budget
      ]);

      const project = projectResult.rows[0];

      // Add stakeholders
      if (stakeholder_emails.length > 0) {
        for (const email of stakeholder_emails) {
          // Get or create resource
          const resourceResult = await client.query(
            'SELECT id FROM project_mgmt.resources WHERE email = $1',
            [email]
          );
          
          let resource_id;
          if (resourceResult.rows.length === 0) {
            // Create new resource
            const newResource = await client.query(
              'INSERT INTO project_mgmt.resources (email, name) VALUES ($1, $2) RETURNING id',
              [email, email.split('@')[0]]
            );
            resource_id = newResource.rows[0].id;
          } else {
            resource_id = resourceResult.rows[0].id;
          }

          // Add as stakeholder
          await client.query(
            'INSERT INTO project_mgmt.project_stakeholders (project_id, stakeholder_id) VALUES ($1, $2)',
            [project.id, resource_id]
          );
        }
      }

      // Create initial milestones if provided
      const milestones = req.body.milestones || [];
      for (const milestone of milestones) {
        await client.query(`
          INSERT INTO project_mgmt.milestones (
            project_id, name, description, due_date, status
          ) VALUES ($1, $2, $3, $4, $5)
        `, [
          project.id, 
          milestone.name, 
          milestone.description, 
          milestone.due_date,
          milestone.status || 'Not Started'
        ]);
      }

      res.status(201).json({
        success: true,
        project: project,
        message: 'Project created successfully'
      });
    });
  }, res);
}

// GET PROJECTS
async function handleGetProjects(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return withDatabase(async (client) => {
    const { 
      status, 
      phase, 
      owner_id,
      include_archived = false,
      view = 'list', // list, overview, or detailed
      limit = '50',
      offset = '0'
    } = req.query;
    
    // Validate pagination parameters
    const limitNum = Math.min(parseInt(limit) || 50, 100);
    const offsetNum = parseInt(offset) || 0;
    
    if (isNaN(limitNum) || limitNum < 1) {
      return res.status(400).json({ error: 'Invalid limit parameter' });
    }
    
    if (isNaN(offsetNum) || offsetNum < 0) {
      return res.status(400).json({ error: 'Invalid offset parameter' });
    }

    let query;
    const params = [];
    const conditions = [];

    if (view === 'overview') {
      // Use the view for aggregated data
      query = `
        SELECT * FROM project_mgmt.project_overview_v
        WHERE 1=1
      `;
    } else {
      // Regular query with joins
      query = `
        SELECT 
          p.*,
          r.name as owner_name,
          r.email as owner_email,
          COUNT(DISTINCT m.id) as milestone_count,
          COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'Completed') as completed_milestones,
          COUNT(DISTINCT t.id) as task_count,
          COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'Done') as completed_tasks,
          COALESCE(json_agg(DISTINCT 
            jsonb_build_object(
              'id', s.stakeholder_id,
              'name', sr.name,
              'email', sr.email
            )
          ) FILTER (WHERE s.stakeholder_id IS NOT NULL), '[]'::json) as stakeholders
        FROM project_mgmt.projects p
        LEFT JOIN project_mgmt.resources r ON p.owner_id = r.id
        LEFT JOIN project_mgmt.milestones m ON p.id = m.project_id
        LEFT JOIN project_mgmt.tasks t ON p.id = t.project_id
        LEFT JOIN project_mgmt.project_stakeholders s ON p.id = s.project_id
        LEFT JOIN project_mgmt.resources sr ON s.stakeholder_id = sr.id
        WHERE 1=1
      `;
    }

    // Add filters
    if (status) {
      conditions.push(`p.status = $${params.length + 1}`);
      params.push(status);
    }

    if (phase) {
      conditions.push(`p.phase = $${params.length + 1}`);
      params.push(phase);
    }

    if (owner_id) {
      const ownerId = parseInt(owner_id);
      if (isNaN(ownerId)) {
        return res.status(400).json({ error: 'Invalid owner_id format' });
      }
      conditions.push(`p.owner_id = $${params.length + 1}`);
      params.push(ownerId);
    }

    if (include_archived !== 'true') {
      conditions.push('NOT p.is_archived');
    }

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    if (view === 'overview' && (!status || status === 'Active')) {
      // Already grouped in view
      query += ' ORDER BY p.priority, p.name';
    } else {
      query += ' GROUP BY p.id, r.name ORDER BY p.priority, p.name';
    }
    
    // Add pagination
    params.push(limitNum);
    query += ` LIMIT $${params.length}`;
    params.push(offsetNum);
    query += ` OFFSET $${params.length}`;
    
    // Get total count for pagination metadata
    let countQuery = query.substring(0, query.lastIndexOf('ORDER BY'));
    countQuery = `SELECT COUNT(*) FROM (${countQuery}) as count_query`;
    const countParams = params.slice(0, -2); // Remove LIMIT and OFFSET params
    
    const [result, countResult] = await Promise.all([
      client.query(query, params),
      client.query(countQuery, countParams)
    ]);

    // If detailed view requested, fetch additional data
    if (view === 'detailed' && result.rows.length > 0) {
      const projectIds = result.rows.map(p => p.id);
      
      // Fetch recent milestones
      const milestones = await client.query(`
        SELECT * FROM project_mgmt.milestones
        WHERE project_id = ANY($1::int[])
        ORDER BY due_date
      `, [projectIds]);

      // Fetch active tasks
      const tasks = await client.query(`
        SELECT t.*, r.name as assignee_name
        FROM project_mgmt.tasks t
        LEFT JOIN project_mgmt.resources r ON t.assignee_id = r.id
        WHERE t.project_id = ANY($1::int[])
        AND t.status NOT IN ('Done', 'Backlog')
        ORDER BY t.priority, t.due_date
      `, [projectIds]);

      // Group by project
      const milestonesMap = {};
      const tasksMap = {};
      
      milestones.rows.forEach(m => {
        if (!milestonesMap[m.project_id]) milestonesMap[m.project_id] = [];
        milestonesMap[m.project_id].push(m);
      });
      
      tasks.rows.forEach(t => {
        if (!tasksMap[t.project_id]) tasksMap[t.project_id] = [];
        tasksMap[t.project_id].push(t);
      });

      // Merge into results
      result.rows.forEach(project => {
        project.milestones = milestonesMap[project.id] || [];
        project.active_tasks = tasksMap[project.id] || [];
      });
    }

    const totalCount = parseInt(countResult.rows[0].count);
    
    res.status(200).json({
      success: true,
      projects: result.rows,
      count: result.rows.length,
      pagination: {
        total: totalCount,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + result.rows.length < totalCount
      }
    });
  }, res);
}

// GET TASKS
async function handleGetTasks(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return withDatabase(async (client) => {
    const { 
      project_id,
      milestone_id,
      sprint_id,
      assignee_id,
      status,
      priority,
      task_type,
      component,
      include_archived = false,
      limit = '50',
      offset = '0'
    } = req.query;
    
    // Validate pagination parameters
    const limitNum = Math.min(parseInt(limit) || 50, 100);
    const offsetNum = parseInt(offset) || 0;
    
    if (isNaN(limitNum) || limitNum < 1) {
      return res.status(400).json({ error: 'Invalid limit parameter' });
    }
    
    if (isNaN(offsetNum) || offsetNum < 0) {
      return res.status(400).json({ error: 'Invalid offset parameter' });
    }

    let query = `
      SELECT 
        t.*,
        p.name as project_name,
        p.project_code,
        m.name as milestone_name,
        s.name as sprint_name,
        s.sprint_number,
        assignee.name as assignee_name,
        assignee.email as assignee_email,
        reviewer.name as reviewer_name,
        creator.name as creator_name,
        -- Blockers as array of IDs
        COALESCE(
          array_agg(DISTINCT td.depends_on_task_id) 
          FILTER (WHERE td.depends_on_task_id IS NOT NULL), 
          ARRAY[]::int[]
        ) as blocker_ids,
        -- Story points for velocity
        t.story_points,
        -- Task age
        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - t.created_at))/86400 as age_days,
        -- Time in current status
        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - t.updated_at))/86400 as status_days
      FROM project_mgmt.tasks t
      LEFT JOIN project_mgmt.projects p ON t.project_id = p.id
      LEFT JOIN project_mgmt.milestones m ON t.milestone_id = m.id
      LEFT JOIN project_mgmt.sprints s ON t.sprint_id = s.id
      LEFT JOIN project_mgmt.resources assignee ON t.assignee_id = assignee.id
      LEFT JOIN project_mgmt.resources reviewer ON t.reviewer_id = reviewer.id
      LEFT JOIN project_mgmt.resources creator ON t.created_by = creator.id
      LEFT JOIN project_mgmt.task_dependencies td ON t.id = td.task_id
      WHERE 1=1
    `;

    const params = [];
    const conditions = [];

    // Add filters
    if (project_id) {
      const projectId = parseInt(project_id);
      if (isNaN(projectId)) {
        return res.status(400).json({ error: 'Invalid project_id format' });
      }
      conditions.push(`t.project_id = $${params.length + 1}`);
      params.push(projectId);
    }

    if (milestone_id) {
      const milestoneId = parseInt(milestone_id);
      if (isNaN(milestoneId)) {
        return res.status(400).json({ error: 'Invalid milestone_id format' });
      }
      conditions.push(`t.milestone_id = $${params.length + 1}`);
      params.push(milestoneId);
    }

    if (sprint_id) {
      const sprintId = parseInt(sprint_id);
      if (isNaN(sprintId)) {
        return res.status(400).json({ error: 'Invalid sprint_id format' });
      }
      conditions.push(`t.sprint_id = $${params.length + 1}`);
      params.push(sprintId);
    }

    if (assignee_id) {
      const assigneeId = parseInt(assignee_id);
      if (isNaN(assigneeId)) {
        return res.status(400).json({ error: 'Invalid assignee_id format' });
      }
      conditions.push(`t.assignee_id = $${params.length + 1}`);
      params.push(assigneeId);
    }

    if (status) {
      if (status.includes(',')) {
        const statuses = status.split(',');
        conditions.push(`t.status = ANY($${params.length + 1}::text[])`);
        params.push(statuses);
      } else {
        conditions.push(`t.status = $${params.length + 1}`);
        params.push(status);
      }
    }

    if (priority) {
      conditions.push(`t.priority = $${params.length + 1}`);
      params.push(priority);
    }

    if (task_type) {
      conditions.push(`t.task_type = $${params.length + 1}`);
      params.push(task_type);
    }

    if (component) {
      conditions.push(`$${params.length + 1} = ANY(t.components)`);
      params.push(component);
    }

    if (!include_archived || include_archived === 'false') {
      conditions.push('NOT t.is_archived');
    }

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    query += `
      GROUP BY 
        t.id, p.name, p.project_code, m.name, s.name, s.sprint_number,
        assignee.name, assignee.email, reviewer.name, creator.name
      ORDER BY t.priority, t.due_date NULLS LAST, t.created_at DESC
    `;
    
    // Get total count for pagination
    let countQuery = query.substring(0, query.lastIndexOf('ORDER BY'));
    countQuery = `SELECT COUNT(*) FROM (${countQuery}) as count_query`;
    
    // Add pagination
    params.push(limitNum);
    query += ` LIMIT $${params.length}`;
    params.push(offsetNum);
    query += ` OFFSET $${params.length}`;
    
    const countParams = params.slice(0, -2); // Remove LIMIT and OFFSET params
    
    const [result, countResult] = await Promise.all([
      client.query(query, params),
      client.query(countQuery, countParams)
    ]);

    // Fetch blocker details if any tasks have blockers
    const tasksWithBlockers = result.rows.filter(t => t.blocker_ids && t.blocker_ids[0] !== null);
    if (tasksWithBlockers.length > 0) {
      const blockerIds = [...new Set(tasksWithBlockers.flatMap(t => t.blocker_ids))];
      const blockers = await client.query(`
        SELECT id, title, status, priority
        FROM project_mgmt.tasks
        WHERE id = ANY($1::int[])
      `, [blockerIds]);

      const blockerMap = {};
      blockers.rows.forEach(b => {
        blockerMap[b.id] = b;
      });

      // Add blocker details to tasks
      result.rows.forEach(task => {
        if (task.blocker_ids && task.blocker_ids[0] !== null) {
          task.blockers = task.blocker_ids.map(id => blockerMap[id]).filter(Boolean);
        } else {
          task.blockers = [];
        }
      });
    }

    // Calculate summary statistics
    const stats = {
      total: result.rows.length,
      by_status: {},
      by_priority: {},
      total_story_points: 0,
      completed_story_points: 0
    };

    result.rows.forEach(task => {
      // Status counts
      stats.by_status[task.status] = (stats.by_status[task.status] || 0) + 1;
      
      // Priority counts
      stats.by_priority[task.priority] = (stats.by_priority[task.priority] || 0) + 1;
      
      // Story points
      if (task.story_points) {
        stats.total_story_points += task.story_points;
        if (task.status === 'Done') {
          stats.completed_story_points += task.story_points;
        }
      }
    });

    const totalCount = parseInt(countResult.rows[0].count);
    
    res.status(200).json({
      success: true,
      tasks: result.rows,
      stats: stats,
      pagination: {
        total: totalCount,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + result.rows.length < totalCount
      }
    });
  }, res);
}

// UPDATE TASK
async function handleUpdateTask(req, res) {
  if (req.method !== 'PUT' && req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization required' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Invalid authentication token' });
  }

  const { task_id } = req.query;
  if (!task_id) {
    return res.status(400).json({ error: 'task_id is required' });
  }
  
  // Validate task_id is a number
  const taskId = parseInt(task_id);
  if (isNaN(taskId)) {
    return res.status(400).json({ error: 'Invalid task_id format' });
  }

  return withDatabase(async (client) => {
    return withTransaction(client, async () => {
      // Get current task
      const currentTask = await client.query(
        'SELECT * FROM project_mgmt.tasks WHERE id = $1',
        [taskId]
      );

      if (currentTask.rows.length === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const task = currentTask.rows[0];
      const updates = [];
      const values = [];
      let paramCount = 1;

      // Build update query dynamically
      const updateableFields = [
        'title', 'description', 'status', 'priority', 'task_type',
        'assignee_id', 'reviewer_id', 'milestone_id', 'sprint_id',
        'due_date', 'story_points', 'progress', 'components', 'labels'
      ];

      updateableFields.forEach(field => {
        if (req.body[field] !== undefined) {
          updates.push(`${field} = $${paramCount}`);
          values.push(req.body[field]);
          paramCount++;
        }
      });

      // Handle status transitions
      if (req.body.status && req.body.status !== task.status) {
        // Auto-update progress based on status
        if (req.body.status === 'Done') {
          updates.push(`progress = $${paramCount}`);
          values.push(100);
          paramCount++;
        } else if (req.body.status === 'In Progress' && task.status === 'To Do') {
          updates.push(`progress = $${paramCount}`);
          values.push(10);
          paramCount++;
        } else if (req.body.status === 'To Do' && task.status === 'Backlog') {
          updates.push(`progress = $${paramCount}`);
          values.push(0);
          paramCount++;
        }
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No valid updates provided' });
      }

      // Update task
      values.push(taskId);
      const updateQuery = `
        UPDATE project_mgmt.tasks 
        SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await client.query(updateQuery, values);
      const updatedTask = result.rows[0];

      // Handle dependencies if provided
      if (req.body.dependencies !== undefined) {
        // Clear existing dependencies
        await client.query(
          'DELETE FROM project_mgmt.task_dependencies WHERE task_id = $1',
          [taskId]
        );

        // Add new dependencies
        if (Array.isArray(req.body.dependencies) && req.body.dependencies.length > 0) {
          for (const depId of req.body.dependencies) {
            // Validate dependency ID
            const dependencyId = parseInt(depId);
            if (isNaN(dependencyId)) {
              throw new Error(`Invalid dependency ID format: ${depId}`);
            }
            
            // Check for circular dependency
            const checkCircular = await client.query(
              'SELECT project_mgmt.check_circular_dependency($1, $2) as is_circular',
              [taskId, dependencyId]
            );

            if (checkCircular.rows[0].is_circular) {
              throw new Error(`Circular dependency detected with task ${depId}`);
            }

            await client.query(`
              INSERT INTO project_mgmt.task_dependencies (task_id, depends_on_task_id)
              VALUES ($1, $2)
            `, [taskId, dependencyId]);
          }
        }
      }

      // Add to status history
      if (req.body.status && req.body.status !== task.status) {
        await client.query(`
          INSERT INTO project_mgmt.task_status_history (
            task_id, from_status, to_status, changed_by, notes
          ) VALUES ($1, $2, $3, $4, $5)
        `, [taskId, task.status, req.body.status, task.assignee_id, req.body.notes || null]);
      }

      // Fetch updated task with relationships
      const fullTask = await client.query(`
        SELECT 
          t.*,
          p.name as project_name,
          m.name as milestone_name,
          assignee.name as assignee_name,
          reviewer.name as reviewer_name,
          array_agg(DISTINCT td.depends_on_task_id) as dependency_ids
        FROM project_mgmt.tasks t
        LEFT JOIN project_mgmt.projects p ON t.project_id = p.id
        LEFT JOIN project_mgmt.milestones m ON t.milestone_id = m.id
        LEFT JOIN project_mgmt.resources assignee ON t.assignee_id = assignee.id
        LEFT JOIN project_mgmt.resources reviewer ON t.reviewer_id = reviewer.id
        LEFT JOIN project_mgmt.task_dependencies td ON t.id = td.task_id
        WHERE t.id = $1
        GROUP BY t.id, p.name, m.name, assignee.name, reviewer.name
      `, [taskId]);

      res.status(200).json({
        success: true,
        task: fullTask.rows[0],
        message: 'Task updated successfully'
      });
    });
  }, res);
}

// GET DASHBOARD
async function handleGetDashboard(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return withDatabase(async (client) => {
    try {
      // Get overall project statistics
      const projectStats = await client.query(`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'Planning') as planning_count,
          COUNT(*) FILTER (WHERE status = 'Active') as active_count,
          COUNT(*) FILTER (WHERE status = 'On Hold') as on_hold_count,
          COUNT(*) FILTER (WHERE status = 'Completed') as completed_count,
          COUNT(*) FILTER (WHERE status = 'Cancelled') as cancelled_count,
          COUNT(*) FILTER (WHERE health = '🟢 Green') as green_count,
          COUNT(*) FILTER (WHERE health = '🟡 Yellow') as yellow_count,
          COUNT(*) FILTER (WHERE health = '🔴 Red') as red_count,
          SUM(budget) as total_budget,
          SUM(actual_spend) as total_spend
        FROM project_mgmt.projects
        WHERE NOT is_archived
      `);

      // Get task statistics
      const taskStats = await client.query(`
        SELECT 
          COUNT(*) as total_tasks,
          COUNT(*) FILTER (WHERE status = 'Backlog') as backlog_count,
          COUNT(*) FILTER (WHERE status = 'To Do') as todo_count,
          COUNT(*) FILTER (WHERE status = 'In Progress') as in_progress_count,
          COUNT(*) FILTER (WHERE status = 'Review') as review_count,
          COUNT(*) FILTER (WHERE status = 'Done') as done_count,
          COUNT(*) FILTER (WHERE priority = 'P0-Critical') as critical_count,
          COUNT(*) FILTER (WHERE priority = 'P1-High') as high_priority_count,
          COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status != 'Done') as overdue_count,
          SUM(story_points) as total_story_points,
          SUM(story_points) FILTER (WHERE status = 'Done') as completed_story_points
        FROM project_mgmt.tasks
        WHERE NOT is_archived
      `);

      // Get milestone statistics
      const milestoneStats = await client.query(`
        SELECT 
          COUNT(*) as total_milestones,
          COUNT(*) FILTER (WHERE status = 'Not Started') as not_started_count,
          COUNT(*) FILTER (WHERE status = 'In Progress') as in_progress_count,
          COUNT(*) FILTER (WHERE status = 'At Risk') as at_risk_count,
          COUNT(*) FILTER (WHERE status = 'Completed') as completed_count,
          COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status != 'Completed') as overdue_count
        FROM project_mgmt.milestones m
        JOIN project_mgmt.projects p ON m.project_id = p.id
        WHERE NOT p.is_archived
      `);

      // Get resource utilization
      const resourceUtilization = await client.query(`
        SELECT 
          r.id,
          r.name,
          r.email,
          r.role,
          COUNT(DISTINCT t.id) as assigned_tasks,
          COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'In Progress') as active_tasks,
          COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'Done' AND t.updated_at > CURRENT_DATE - INTERVAL '7 days') as completed_this_week,
          SUM(t.story_points) FILTER (WHERE t.status = 'Done' AND t.updated_at > CURRENT_DATE - INTERVAL '7 days') as velocity_this_week
        FROM project_mgmt.resources r
        LEFT JOIN project_mgmt.tasks t ON r.id = t.assignee_id AND NOT t.is_archived
        WHERE r.is_active
        GROUP BY r.id, r.name, r.email, r.role
        ORDER BY assigned_tasks DESC
        LIMIT 10
      `);

      // Get recent activity
      const recentActivity = await client.query(`
        SELECT * FROM (
          -- Recent task updates
          SELECT 
            'task' as activity_type,
            t.id,
            t.title as name,
            t.status,
            t.updated_at,
            r.name as actor_name,
            p.name as project_name
          FROM project_mgmt.tasks t
          JOIN project_mgmt.projects p ON t.project_id = p.id
          LEFT JOIN project_mgmt.resources r ON t.assignee_id = r.id
          WHERE t.updated_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
          
          UNION ALL
          
          -- Recent project updates
          SELECT 
            'project' as activity_type,
            p.id,
            p.name,
            p.status,
            p.updated_at,
            r.name as actor_name,
            NULL as project_name
          FROM project_mgmt.projects p
          LEFT JOIN project_mgmt.resources r ON p.owner_id = r.id
          WHERE p.updated_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
        ) activities
        ORDER BY updated_at DESC
        LIMIT 20
      `);

      // Get upcoming milestones
      const upcomingMilestones = await client.query(`
        SELECT 
          m.*,
          p.name as project_name,
          p.priority as project_priority
        FROM project_mgmt.milestones m
        JOIN project_mgmt.projects p ON m.project_id = p.id
        WHERE m.status != 'Completed'
        AND m.due_date >= CURRENT_DATE
        AND NOT p.is_archived
        ORDER BY m.due_date
        LIMIT 10
      `);

      res.status(200).json({
        success: true,
        projectStats: projectStats.rows[0],
        taskStats: taskStats.rows[0],
        milestoneStats: milestoneStats.rows[0],
        resourceUtilization: resourceUtilization.rows,
        recentActivity: recentActivity.rows,
        upcomingMilestones: upcomingMilestones.rows,
        generated_at: new Date()
      });
    } catch (error) {
      console.error('Dashboard error:', error);
      res.status(500).json({ 
        error: 'Failed to generate dashboard',
        details: error.message 
      });
    }
  }, res);
}