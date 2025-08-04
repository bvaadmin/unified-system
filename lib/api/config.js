import { withDatabase } from '../lib/db.js';
import { withCors } from '../lib/cors.js';

/**
 * Unified Configuration API
 * Handles all configuration operations through a single endpoint
 */
export default withCors(async (req, res) => {
  const { action } = req.query;
  
  if (!action) {
    return res.status(400).json({ error: 'Missing action parameter' });
  }

  // Route to appropriate handler based on action
  switch (action) {
    case 'get-settings':
      return handleGetSettings(req, res);
    case 'update-setting':
      return handleUpdateSetting(req, res);
    case 'get-history':
      return handleGetHistory(req, res);
    default:
      return res.status(400).json({ error: `Unknown action: ${action}` });
  }
});

// GET SETTINGS
async function handleGetSettings(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return withDatabase(async (client) => {
    const { key, category, environment } = req.query;

    try {
      if (key) {
        // Get specific setting
        const result = await client.query(
          `SELECT * FROM config.get_value($1, $2, $3)`,
          [key, category || null, environment || 'production']
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Setting not found' });
        }

        const setting = result.rows[0];
        res.status(200).json({
          success: true,
          setting: {
            key: setting.key,
            value: setting.value,
            category: setting.category,
            data_type: setting.data_type,
            description: setting.description,
            updated_at: setting.updated_at,
            updated_by: setting.updated_by
          }
        });
      } else if (category) {
        // Get all settings in category
        const result = await client.query(`
          SELECT 
            s.key,
            COALESCE(eo.value, s.value) as value,
            s.category,
            s.data_type,
            s.description,
            s.is_sensitive,
            s.updated_at,
            s.updated_by
          FROM config.settings s
          LEFT JOIN config.environment_overrides eo 
            ON s.key = s.key 
            AND s.category = s.category 
            AND eo.environment = $2
          WHERE s.category = $1
          ORDER BY s.key
        `, [category, environment || 'production']);

        res.status(200).json({
          success: true,
          settings: result.rows
        });
      } else {
        // Get all categories
        const result = await client.query(`
          SELECT DISTINCT 
            c.category,
            c.description,
            COUNT(s.key) as setting_count
          FROM config.categories c
          LEFT JOIN config.settings s ON c.category = s.category
          GROUP BY c.category, c.description
          ORDER BY c.category
        `);

        res.status(200).json({
          success: true,
          categories: result.rows
        });
      }
    } catch (error) {
      console.error('Get settings error:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve settings',
        message: error.message 
      });
    }
  }, res);
}

// UPDATE SETTING
async function handleUpdateSetting(req, res) {
  if (req.method !== 'POST' && req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate admin token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization required' });
  }

  const token = authHeader.replace('Bearer ', '');
  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Invalid authentication token' });
  }

  return withDatabase(async (client) => {
    const { key, value, category, reason, environment = 'production' } = req.body;

    if (!key || value === undefined || !category) {
      return res.status(400).json({ 
        error: 'Missing required fields: key, value, category' 
      });
    }

    if (!reason) {
      return res.status(400).json({ 
        error: 'Reason for change is required' 
      });
    }

    try {
      // Get current value for history
      const currentResult = await client.query(
        `SELECT * FROM config.get_value($1, $2, $3)`,
        [key, category, environment]
      );

      const oldValue = currentResult.rows[0]?.value || null;

      // Update the setting
      const result = await client.query(
        `SELECT * FROM config.set_value($1, $2, $3, $4, $5, $6)`,
        [key, value, category, 'api-update', reason, environment]
      );

      if (result.rows.length === 0) {
        return res.status(500).json({ error: 'Failed to update setting' });
      }

      res.status(200).json({
        success: true,
        message: 'Setting updated successfully',
        setting: {
          key,
          category,
          environment,
          old_value: oldValue,
          new_value: value,
          updated_by: 'api-update',
          reason
        }
      });
    } catch (error) {
      console.error('Update setting error:', error);
      res.status(500).json({ 
        error: 'Failed to update setting',
        message: error.message 
      });
    }
  }, res);
}

// GET HISTORY
async function handleGetHistory(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return withDatabase(async (client) => {
    const { 
      key, 
      category, 
      limit = 50, 
      offset = 0,
      startDate,
      endDate 
    } = req.query;

    try {
      let query = `
        SELECT 
          h.*,
          s.description as setting_description
        FROM config.setting_history h
        JOIN config.settings s ON h.key = s.key AND h.category = s.category
        WHERE 1=1
      `;
      const params = [];

      if (key) {
        params.push(key);
        query += ` AND h.key = $${params.length}`;
      }

      if (category) {
        params.push(category);
        query += ` AND h.category = $${params.length}`;
      }

      if (startDate) {
        params.push(startDate);
        query += ` AND h.changed_at >= $${params.length}`;
      }

      if (endDate) {
        params.push(endDate);
        query += ` AND h.changed_at <= $${params.length}`;
      }

      // Add ordering and pagination
      query += ` ORDER BY h.changed_at DESC`;
      
      params.push(parseInt(limit));
      query += ` LIMIT $${params.length}`;
      
      params.push(parseInt(offset));
      query += ` OFFSET $${params.length}`;

      // Get total count
      let countQuery = `
        SELECT COUNT(*) 
        FROM config.setting_history h
        WHERE 1=1
      `;
      const countParams = params.slice(0, -2); // Remove limit and offset

      if (key) countQuery += ` AND h.key = $1`;
      if (category) countQuery += ` AND h.category = $${key ? 2 : 1}`;
      if (startDate) countQuery += ` AND h.changed_at >= $${countParams.length + 1}`;
      if (endDate) countQuery += ` AND h.changed_at <= $${countParams.length + 1}`;

      const [historyResult, countResult] = await Promise.all([
        client.query(query, params),
        client.query(countQuery, countParams)
      ]);

      const totalCount = parseInt(countResult.rows[0].count);

      res.status(200).json({
        success: true,
        history: historyResult.rows,
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + historyResult.rows.length < totalCount
        }
      });
    } catch (error) {
      console.error('Get history error:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve history',
        message: error.message 
      });
    }
  }, res);
}