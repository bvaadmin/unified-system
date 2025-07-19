const { withDatabase } = require('../../lib/db');
const { withCors } = require('../../lib/cors');

module.exports = withCors(async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return withDatabase(async (client) => {
    const { 
      status, 
      phase, 
      owner_id,
      include_archived = false,
      view = 'list' // list, overview, or detailed
    } = req.query;

    let query;
    const params = [];
    const conditions = [];

    if (view === 'overview') {
      // Use the view for aggregated data
      query = `
        SELECT 
          p.*,
          p.owner_name,
          p.milestone_count,
          p.task_count,
          p.completed_tasks,
          p.active_blockers,
          p.avg_progress
        FROM project_mgmt.v_active_projects p
        WHERE 1=1
      `;
      
      if (status && status !== 'Active') {
        // Switch to full table if filtering by non-active status
        query = `
          SELECT 
            p.*,
            r.name as owner_name,
            COUNT(DISTINCT m.id) as milestone_count,
            COUNT(DISTINCT t.id) as task_count,
            COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'Done') as completed_tasks,
            COUNT(DISTINCT b.id) as active_blockers,
            ROUND(AVG(t.progress)::numeric, 0) as avg_progress
          FROM project_mgmt.projects p
          LEFT JOIN project_mgmt.resources r ON p.owner_id = r.id
          LEFT JOIN project_mgmt.milestones m ON p.id = m.project_id
          LEFT JOIN project_mgmt.tasks t ON p.id = t.project_id
          LEFT JOIN project_mgmt.blocker_relationships br ON p.id = br.blocked_project_id
          LEFT JOIN project_mgmt.blockers b ON br.blocker_id = b.id AND b.status = 'Active'
          WHERE 1=1
        `;
        conditions.push(`p.status = $${params.length + 1}`);
        params.push(status);
      }
    } else {
      // Simple list view
      query = `
        SELECT 
          p.*,
          r.name as owner_name,
          ARRAY_AGG(DISTINCT ps.resource_id) as stakeholder_ids
        FROM project_mgmt.projects p
        LEFT JOIN project_mgmt.resources r ON p.owner_id = r.id
        LEFT JOIN project_mgmt.project_stakeholders ps ON p.id = ps.project_id
        WHERE 1=1
      `;
      
      if (status) {
        conditions.push(`p.status = $${params.length + 1}`);
        params.push(status);
      }
    }

    if (phase) {
      conditions.push(`p.phase = $${params.length + 1}`);
      params.push(phase);
    }

    if (owner_id) {
      conditions.push(`p.owner_id = $${params.length + 1}`);
      params.push(parseInt(owner_id));
    }

    if (!include_archived || include_archived === 'false') {
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

    const result = await client.query(query, params);

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

    res.status(200).json({
      success: true,
      projects: result.rows,
      count: result.rows.length
    });
  }, res);
});