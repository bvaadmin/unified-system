const { withDatabase, withTransaction } = require('../../lib/db');
const { withCors } = require('../../lib/cors');

module.exports = withCors(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Simple auth check - in production, use proper authentication
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization required' });
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

      // Get creator (You - the AI assistant)
      const creatorResult = await client.query(
        'SELECT id FROM project_mgmt.resources WHERE email = $1',
        ['assistant@ai.helper']
      );
      const created_by = creatorResult.rows[0]?.id || 1;

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
        const stakeholderQuery = `
          INSERT INTO project_mgmt.project_stakeholders (project_id, resource_id, role)
          SELECT $1, id, 'Stakeholder'
          FROM project_mgmt.resources
          WHERE email = ANY($2::text[])
        `;
        await client.query(stakeholderQuery, [project.id, stakeholder_emails]);
      }

      // Create initial milestones if provided
      if (req.body.milestones && Array.isArray(req.body.milestones)) {
        for (const milestone of req.body.milestones) {
          await client.query(`
            INSERT INTO project_mgmt.milestones (
              project_id, name, due_date, status, impact_if_missed,
              owner_id, completion_criteria, system_components
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8
            )
          `, [
            project.id,
            milestone.name,
            milestone.due_date,
            milestone.status || 'Not Started',
            milestone.impact_if_missed || 'Medium-Performance',
            owner_id,
            milestone.completion_criteria,
            milestone.system_components || []
          ]);
        }
      }

      res.status(201).json({
        success: true,
        project: project,
        message: `Project ${project.project_code} created successfully`
      });
    });
  }, res);
});