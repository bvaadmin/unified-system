import { withPooledConnection } from '../lib/db.js';
import { applyCors } from '../lib/cors.js';

export default async function handler(req, res) {
  // Apply CORS
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      return await handleGetConfig(req, res);
    } else if (req.method === 'POST' || req.method === 'PUT') {
      return await handleUpdateConfig(req, res);
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Config API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

// Get configuration settings
async function handleGetConfig(req, res) {
  const { key, category, environment } = req.query;

  try {
    const result = await withPooledConnection(async (pgClient) => {
      if (key) {
        // Get specific setting
        const settingResult = await pgClient.query(
          'SELECT config.get_value($1, $2, $3) as value',
          [key, category || null, environment || 'production']
        );
        
        return {
          key,
          value: settingResult.rows[0]?.value || null,
          category: category || null,
          environment: environment || 'production'
        };
      } else if (category) {
        // Get all settings in category
        const categoryResult = await pgClient.query(
          `SELECT s.setting_key, s.setting_value, s.value_type, s.description
           FROM config.settings s
           JOIN config.categories c ON s.category_id = c.id
           WHERE c.category_name = $1
           ORDER BY s.setting_key`,
          [category]
        );
        
        return {
          category,
          settings: categoryResult.rows
        };
      } else {
        // Get all categories
        const categoriesResult = await pgClient.query(
          `SELECT category_name, description
           FROM config.categories
           ORDER BY category_name`
        );
        
        return {
          categories: categoriesResult.rows
        };
      }
    });
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Get config error:', error);
    return res.status(500).json({ 
      error: 'Failed to get configuration',
      message: error.message 
    });
  }
}

// Update configuration setting
async function handleUpdateConfig(req, res) {
  // Check for admin token
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.ADMIN_TOKEN;
  
  if (!authHeader || !expectedToken || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const token = authHeader.substring(7);
  if (token !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { key, value, category, reason, environment } = req.body;
  
  if (!key || value === undefined || !category || !reason) {
    return res.status(400).json({ 
      error: 'Missing required fields: key, value, category, reason' 
    });
  }

  try {
    const result = await withPooledConnection(async (pgClient) => {
      // Get old value for audit trail
      const oldValueResult = await pgClient.query(
        'SELECT config.get_value($1, $2, $3) as old_value',
        [key, category, environment || 'production']
      );
      const oldValue = oldValueResult.rows[0]?.old_value;
      
      // Update the setting
      await pgClient.query(
        'SELECT config.set_value($1, $2, $3, $4, $5, $6)',
        [key, value, category, 'system', reason, environment || 'production']
      );
      
      return {
        key,
        old_value: oldValue,
        new_value: value,
        category,
        reason,
        environment: environment || 'production',
        updated_at: new Date().toISOString()
      };
    });
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Update config error:', error);
    return res.status(500).json({ 
      error: 'Failed to update configuration',
      message: error.message 
    });
  }
}
