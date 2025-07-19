/**
 * Update Configuration Setting API
 * Update configuration values with history tracking
 */
import { applyCors } from '../../lib/cors.js';
import { createPgClient } from '../../lib/db.js';

// Configurations for this function
export const config = {
    maxDuration: 10, // Vercel function timeout
};

export default async function handler(req, res) {
    // Apply CORS
    if (!applyCors(req, res)) return;

    if (req.method !== 'PUT' && req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    // Check admin authorization
    const authHeader = req.headers.authorization;
    const adminToken = process.env.ADMIN_TOKEN;

    if (!adminToken || !authHeader || authHeader !== `Bearer ${adminToken}`) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const pgClient = createPgClient();

    try {
        await pgClient.connect();

        const { 
            key, 
            value, 
            category, 
            reason = 'API update',
            changedBy = null,
            environment = null 
        } = req.body;

        if (!key || value === undefined) {
            res.status(400).json({ 
                error: 'Missing required fields',
                required: ['key', 'value'] 
            });
            return;
        }

        // Start transaction
        await pgClient.query('BEGIN');

        // Check if setting exists
        const settingCheck = await pgClient.query(`
            SELECT 
                s.id,
                s.setting_key,
                s.data_type,
                s.min_value,
                s.max_value,
                s.allowed_values,
                s.validation_regex,
                s.requires_approval,
                s.is_sensitive,
                c.category_code
            FROM config.settings s
            JOIN config.categories c ON s.category_id = c.id
            WHERE s.setting_key = $1
              AND ($2 IS NULL OR c.category_code = $2)
              AND s.is_active = TRUE
        `, [key, category || null]);

        if (settingCheck.rows.length === 0) {
            await pgClient.query('ROLLBACK');
            res.status(404).json({ 
                error: 'Configuration setting not found',
                key,
                category 
            });
            return;
        }

        const setting = settingCheck.rows[0];

        // Validate value based on data type
        let validatedValue = value;
        try {
            switch (setting.data_type) {
                case 'number':
                    validatedValue = parseFloat(value);
                    if (isNaN(validatedValue)) {
                        throw new Error('Invalid number format');
                    }
                    // Check min/max
                    if (setting.min_value && validatedValue < setting.min_value) {
                        throw new Error(`Value must be at least ${setting.min_value}`);
                    }
                    if (setting.max_value && validatedValue > setting.max_value) {
                        throw new Error(`Value must be at most ${setting.max_value}`);
                    }
                    break;
                    
                case 'boolean':
                    validatedValue = value === true || value === 'true' || value === '1';
                    break;
                    
                case 'date':
                    // Validate date format
                    const dateTest = new Date(value);
                    if (isNaN(dateTest.getTime())) {
                        throw new Error('Invalid date format');
                    }
                    break;
                    
                case 'json':
                    // Validate JSON
                    if (typeof value === 'string') {
                        JSON.parse(value);
                    }
                    break;
            }

            // Check allowed values
            if (setting.allowed_values && setting.allowed_values.length > 0) {
                if (!setting.allowed_values.includes(String(value))) {
                    throw new Error(`Value must be one of: ${setting.allowed_values.join(', ')}`);
                }
            }

            // Check regex validation
            if (setting.validation_regex) {
                const regex = new RegExp(setting.validation_regex);
                if (!regex.test(String(value))) {
                    throw new Error('Value does not match required format');
                }
            }
        } catch (validationError) {
            await pgClient.query('ROLLBACK');
            res.status(400).json({ 
                error: 'Validation failed',
                message: validationError.message,
                dataType: setting.data_type
            });
            return;
        }

        // Handle environment-specific override
        if (environment && environment !== 'production') {
            // Check if override exists
            const overrideCheck = await pgClient.query(`
                SELECT id FROM config.environment_overrides
                WHERE setting_id = $1 AND environment = $2
            `, [setting.id, environment]);

            if (overrideCheck.rows.length > 0) {
                // Update existing override
                const updateQuery = `
                    UPDATE config.environment_overrides 
                    SET ${setting.data_type === 'text' || setting.data_type === 'array' ? 'override_value_text' : 
                          setting.data_type === 'number' ? 'override_value_number' :
                          setting.data_type === 'boolean' ? 'override_value_boolean' :
                          setting.data_type === 'date' ? 'override_value_date' :
                          setting.data_type === 'timestamp' ? 'override_value_timestamp' :
                          'override_value_json'} = $3,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE setting_id = $1 AND environment = $2
                `;
                await pgClient.query(updateQuery, [setting.id, environment, validatedValue]);
            } else {
                // Create new override
                const insertQuery = `
                    INSERT INTO config.environment_overrides (
                        setting_id, environment,
                        ${setting.data_type === 'text' || setting.data_type === 'array' ? 'override_value_text' : 
                          setting.data_type === 'number' ? 'override_value_number' :
                          setting.data_type === 'boolean' ? 'override_value_boolean' :
                          setting.data_type === 'date' ? 'override_value_date' :
                          setting.data_type === 'timestamp' ? 'override_value_timestamp' :
                          'override_value_json'}
                    ) VALUES ($1, $2, $3)
                `;
                await pgClient.query(insertQuery, [setting.id, environment, validatedValue]);
            }

            // Record in history
            await pgClient.query(`
                INSERT INTO config.setting_history (
                    setting_id, change_type, change_reason, changed_by,
                    new_value_text
                ) VALUES ($1, 'update', $2, $3, $4)
            `, [setting.id, `${reason} (${environment} override)`, changedBy, String(validatedValue)]);

        } else {
            // Update main setting value
            const result = await pgClient.query(
                `SELECT config.set_value($1, $2, $3, $4, $5)`,
                [key, String(validatedValue), category || null, changedBy, reason]
            );

            if (!result.rows[0].set_value) {
                throw new Error('Failed to update configuration');
            }
        }

        await pgClient.query('COMMIT');

        // Get updated value
        const updatedValue = await pgClient.query(
            `SELECT config.get_value($1, $2, $3) as value`,
            [key, category || null, environment || 'production']
        );

        res.status(200).json({
            success: true,
            key,
            category: setting.category_code,
            environment: environment || 'production',
            oldValue: setting.data_type === 'boolean' ? (value === 'true') : value,
            newValue: updatedValue.rows[0].value,
            dataType: setting.data_type,
            reason,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        await pgClient.query('ROLLBACK');
        console.error('Update configuration error:', error);
        res.status(500).json({ 
            error: 'Failed to update configuration',
            message: error.message 
        });
    } finally {
        await pgClient.end();
    }
}