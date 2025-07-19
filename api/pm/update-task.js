import { withDatabase, withTransaction } from '../../lib/db.js';
import { withCors } from '../../lib/cors.js';

export default withCors(async (req, res) => {
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

      // Handle all possible updates
      const updateFields = [
        'name', 'status', 'priority', 'task_type', 'story_points',
        'assignee_id', 'reviewer_id', 'sprint_id', 'milestone_id',
        'start_date', 'due_date', 'completed_date',
        'estimated_hours', 'actual_hours', 'progress',
        'github_issue_url', 'pr_url',
        'test_coverage', 'migration_safe', 'code_reviewed',
        'acceptance_criteria', 'technical_notes',
        'components', 'tags'
      ];

      for (const field of updateFields) {
        if (req.body[field] !== undefined) {
          updates.push(`${field} = $${paramCount}`);
          values.push(req.body[field]);
          paramCount++;
        }
      }

      // Special handling for progress based on status
      if (req.body.status && !req.body.hasOwnProperty('progress')) {
        if (req.body.status === 'Done') {
          updates.push(`progress = $${paramCount}`);
          values.push(100);
          paramCount++;
          
          // Set completed date if not provided
          if (!req.body.completed_date) {
            updates.push(`completed_date = $${paramCount}`);
            values.push(new Date());
            paramCount++;
          }
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

      // Log significant status changes
      const statusChanges = [];
      if (req.body.status && req.body.status !== task.status) {
        statusChanges.push(`Status: ${task.status} → ${req.body.status}`);
      }
      if (req.body.priority && req.body.priority !== task.priority) {
        statusChanges.push(`Priority: ${task.priority} → ${req.body.priority}`);
      }

      // Get full task details
      const fullTask = await client.query(`
        SELECT 
          t.*,
          p.name as project_name,
          m.name as milestone_name,
          s.name as sprint_name,
          assignee.name as assignee_name,
          reviewer.name as reviewer_name
        FROM project_mgmt.tasks t
        LEFT JOIN project_mgmt.projects p ON t.project_id = p.id
        LEFT JOIN project_mgmt.milestones m ON t.milestone_id = m.id
        LEFT JOIN project_mgmt.sprints s ON t.sprint_id = s.id
        LEFT JOIN project_mgmt.resources assignee ON t.assignee_id = assignee.id
        LEFT JOIN project_mgmt.resources reviewer ON t.reviewer_id = reviewer.id
        WHERE t.id = $1
      `, [taskId]);

      res.status(200).json({
        success: true,
        task: fullTask.rows[0],
        changes: statusChanges,
        message: `Task ${updatedTask.task_id} updated successfully`
      });
    });
  }, res);
});