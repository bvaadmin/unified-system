/**
 * Get Configuration Settings API
 * Retrieve configuration values by category or key
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

    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const pgClient = createPgClient();

    try {
        await pgClient.connect();

        const { category, key, environment = 'production' } = req.query;

        // Get specific setting by key
        if (key) {
            const result = await pgClient.query(
                `SELECT config.get_value($1, $2, $3) as value`,
                [key, category || null, environment]
            );

            if (!result.rows[0].value) {
                res.status(404).json({ 
                    error: 'Configuration not found',
                    key,
                    category 
                });
                return;
            }

            // Get full setting details
            const details = await pgClient.query(`
                SELECT 
                    s.setting_key,
                    s.setting_name,
                    s.description,
                    s.data_type,
                    s.unit,
                    s.min_value,
                    s.max_value,
                    s.is_sensitive,
                    CASE 
                        WHEN s.is_sensitive THEN '***'
                        ELSE config.get_value($1, $2, $3)
                    END as value,
                    s.default_value,
                    s.effective_from,
                    s.effective_to,
                    s.updated_at
                FROM config.settings s
                JOIN config.categories c ON s.category_id = c.id
                WHERE s.setting_key = $1
                  AND ($2 IS NULL OR c.category_code = $2)
                  AND s.is_active = TRUE
            `, [key, category || null, environment]);

            if (details.rows.length === 0) {
                res.status(404).json({ error: 'Configuration not found' });
                return;
            }

            res.status(200).json({
                success: true,
                setting: details.rows[0]
            });
            return;
        }

        // Get all settings in a category
        if (category) {
            const settings = await pgClient.query(`
                SELECT 
                    s.setting_key,
                    s.setting_name,
                    s.description,
                    s.data_type,
                    s.unit,
                    CASE 
                        WHEN s.is_sensitive THEN '***'
                        ELSE COALESCE(
                            (SELECT CASE s.data_type
                                WHEN 'text' THEN eo.override_value_text
                                WHEN 'number' THEN eo.override_value_number::TEXT
                                WHEN 'boolean' THEN eo.override_value_boolean::TEXT
                                WHEN 'date' THEN eo.override_value_date::TEXT
                                WHEN 'timestamp' THEN eo.override_value_timestamp::TEXT
                                WHEN 'json' THEN eo.override_value_json::TEXT
                            END
                            FROM config.environment_overrides eo
                            WHERE eo.setting_id = s.id 
                              AND eo.environment = $2
                              AND eo.is_active = TRUE),
                            CASE s.data_type
                                WHEN 'text' THEN s.value_text
                                WHEN 'number' THEN s.value_number::TEXT
                                WHEN 'boolean' THEN s.value_boolean::TEXT
                                WHEN 'date' THEN s.value_date::TEXT
                                WHEN 'timestamp' THEN s.value_timestamp::TEXT
                                WHEN 'json' THEN s.value_json::TEXT
                            END,
                            s.default_value
                        )
                    END as value,
                    s.is_sensitive,
                    s.effective_from,
                    s.effective_to
                FROM config.settings s
                JOIN config.categories c ON s.category_id = c.id
                WHERE c.category_code = $1
                  AND s.is_active = TRUE
                  AND (s.effective_from IS NULL OR s.effective_from <= CURRENT_DATE)
                  AND (s.effective_to IS NULL OR s.effective_to >= CURRENT_DATE)
                ORDER BY s.setting_name
            `, [category, environment]);

            res.status(200).json({
                success: true,
                category,
                environment,
                settings: settings.rows
            });
            return;
        }

        // Get all categories with setting counts
        const categories = await pgClient.query(`
            SELECT 
                c.category_code,
                c.category_name,
                c.description,
                pc.category_code as parent_code,
                COUNT(s.id) as setting_count
            FROM config.categories c
            LEFT JOIN config.categories pc ON c.parent_category_id = pc.id
            LEFT JOIN config.settings s ON c.id = s.category_id AND s.is_active = TRUE
            WHERE c.is_active = TRUE
            GROUP BY c.id, c.category_code, c.category_name, c.description, 
                     c.sort_order, pc.category_code
            ORDER BY c.sort_order, c.category_code
        `);

        res.status(200).json({
            success: true,
            categories: categories.rows
        });

    } catch (error) {
        console.error('Get configuration error:', error);
        res.status(500).json({ 
            error: 'Failed to retrieve configuration',
            message: error.message 
        });
    } finally {
        await pgClient.end();
    }
}