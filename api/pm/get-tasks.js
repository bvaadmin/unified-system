import { withDatabase } from '../../lib/db.js';
import { withCors } from '../../lib/cors.js';

export default withCors(async (req, res) => {
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
        creator.name as created_by_name,
        ARRAY_AGG(DISTINCT dep.depends_on_task_id) as dependency_ids,
        ARRAY_AGG(DISTINCT br.blocker_id) as blocker_ids
      FROM project_mgmt.tasks t
      LEFT JOIN project_mgmt.projects p ON t.project_id = p.id
      LEFT JOIN project_mgmt.milestones m ON t.milestone_id = m.id
      LEFT JOIN project_mgmt.sprints s ON t.sprint_id = s.id
      LEFT JOIN project_mgmt.resources assignee ON t.assignee_id = assignee.id
      LEFT JOIN project_mgmt.resources reviewer ON t.reviewer_id = reviewer.id
      LEFT JOIN project_mgmt.resources creator ON t.created_by = creator.id
      LEFT JOIN project_mgmt.task_dependencies dep ON t.id = dep.task_id
      LEFT JOIN project_mgmt.blocker_relationships br ON t.id = br.blocked_task_id
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
        SELECT id, title, severity, status
        FROM project_mgmt.blockers
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
});