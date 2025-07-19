import { withDatabase } from '../../lib/db.js';
import { withCors } from '../../lib/cors.js';

export default withCors(async (req, res) => {
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
          COUNT(*) FILTER (WHERE status = 'Code Review') as review_count,
          COUNT(*) FILTER (WHERE status = 'Testing') as testing_count,
          COUNT(*) FILTER (WHERE status = 'Done') as done_count,
          COUNT(*) FILTER (WHERE status = 'Blocked') as blocked_count,
          SUM(story_points) as total_points,
          SUM(story_points) FILTER (WHERE status = 'Done') as completed_points,
          AVG(progress) as average_progress
        FROM project_mgmt.tasks
        WHERE NOT is_archived
      `);

      // Get active projects with details
      const activeProjects = await client.query(`
        SELECT * FROM project_mgmt.v_active_projects
        ORDER BY priority, name
        LIMIT 10
      `);

      // Get upcoming milestones
      const upcomingMilestones = await client.query(`
        SELECT 
          m.*,
          p.name as project_name,
          p.project_code,
          r.name as owner_name,
          (m.due_date - CURRENT_DATE) as days_until_due
        FROM project_mgmt.milestones m
        JOIN project_mgmt.projects p ON m.project_id = p.id
        LEFT JOIN project_mgmt.resources r ON m.owner_id = r.id
        WHERE m.status != 'Complete'
        AND m.due_date >= CURRENT_DATE
        ORDER BY m.due_date
        LIMIT 10
      `);

      // Get active blockers
      const activeBlockers = await client.query(`
        SELECT * FROM project_mgmt.v_blocker_impact
        WHERE status IN ('Active', 'Mitigating')
        ORDER BY 
          CASE severity
            WHEN '🔴 Critical-System Down' THEN 1
            WHEN '🟠 High-Feature Blocked' THEN 2
            WHEN '🟡 Medium-Workaround Exists' THEN 3
            WHEN '🟢 Low-Minor Impact' THEN 4
          END,
          identified_date DESC
        LIMIT 10
      `);

      // Get current sprint info
      const currentSprint = await client.query(`
        SELECT * FROM project_mgmt.v_sprint_velocity
        WHERE status = 'Active'
        ORDER BY start_date DESC
        LIMIT 1
      `);

      // Get resource utilization
      const resourceUtil = await client.query(`
        SELECT * FROM project_mgmt.v_resource_utilization
        WHERE total_allocation_percent > 0
        ORDER BY total_allocation_percent DESC
      `);

      // Get recent task updates (last 7 days)
      const recentUpdates = await client.query(`
        SELECT 
          t.task_id,
          t.name,
          t.status,
          t.updated_at,
          p.name as project_name,
          r.name as assignee_name
        FROM project_mgmt.tasks t
        JOIN project_mgmt.projects p ON t.project_id = p.id
        LEFT JOIN project_mgmt.resources r ON t.assignee_id = r.id
        WHERE t.updated_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
        AND t.updated_at != t.created_at
        ORDER BY t.updated_at DESC
        LIMIT 20
      `);

      // Build timeline data for next 30 days
      const timeline = await client.query(`
        WITH timeline_events AS (
          SELECT 
            'milestone' as event_type,
            m.name as event_name,
            m.due_date as event_date,
            p.name as project_name,
            m.impact_if_missed as impact
          FROM project_mgmt.milestones m
          JOIN project_mgmt.projects p ON m.project_id = p.id
          WHERE m.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
          AND m.status != 'Complete'
          
          UNION ALL
          
          SELECT 
            'sprint_end' as event_type,
            s.name as event_name,
            s.end_date as event_date,
            p.name as project_name,
            'Sprint End' as impact
          FROM project_mgmt.sprints s
          JOIN project_mgmt.projects p ON s.project_id = p.id
          WHERE s.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
          AND s.status IN ('Planning', 'Active')
          
          UNION ALL
          
          SELECT 
            'task_due' as event_type,
            t.name as event_name,
            t.due_date as event_date,
            p.name as project_name,
            t.priority as impact
          FROM project_mgmt.tasks t
          JOIN project_mgmt.projects p ON t.project_id = p.id
          WHERE t.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
          AND t.status NOT IN ('Done', 'Cancelled')
          AND t.priority IN ('P0-Critical', 'P1-High')
        )
        SELECT * FROM timeline_events
        ORDER BY event_date, impact
      `);

      // Calculate velocity trend
      const velocityTrend = await client.query(`
        SELECT 
          sprint_number,
          name,
          completed_points,
          total_points,
          ROUND((completed_points::numeric / NULLIF(total_points, 0) * 100), 0) as completion_rate
        FROM project_mgmt.v_sprint_velocity
        WHERE status = 'Completed'
        ORDER BY end_date DESC
        LIMIT 5
      `);

      res.status(200).json({
        success: true,
        dashboard: {
          summary: {
            projects: projectStats.rows[0],
            tasks: taskStats.rows[0],
            active_projects_count: activeProjects.rows.length,
            upcoming_milestones_count: upcomingMilestones.rows.length,
            active_blockers_count: activeBlockers.rows.length
          },
          active_projects: activeProjects.rows,
          upcoming_milestones: upcomingMilestones.rows,
          active_blockers: activeBlockers.rows,
          current_sprint: currentSprint.rows[0] || null,
          resource_utilization: resourceUtil.rows,
          recent_updates: recentUpdates.rows,
          timeline: timeline.rows,
          velocity_trend: velocityTrend.rows,
          generated_at: new Date()
        }
      });
    } catch (error) {
      console.error('Dashboard error:', error);
      res.status(500).json({ 
        error: 'Failed to generate dashboard',
        message: error.message 
      });
    }
  }, res);
});