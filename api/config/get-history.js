/**
 * Get Configuration History API
 * Retrieve change history for configuration settings
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

        const { 
            key, 
            category, 
            limit = 50,
            offset = 0,
            startDate,
            endDate
        } = req.query;

        let query = `
            SELECT 
                h.id,
                s.setting_key,
                s.setting_name,
                c.category_code,
                c.category_name,
                h.old_value_text,
                h.new_value_text,
                h.change_type,
                h.change_reason,
                h.changed_at,
                p.first_name || ' ' || p.last_name as changed_by_name,
                h.approval_status,
                ap.first_name || ' ' || ap.last_name as approved_by_name,
                h.approval_date,
                h.approval_notes
            FROM config.setting_history h
            JOIN config.settings s ON h.setting_id = s.id
            JOIN config.categories c ON s.category_id = c.id
            LEFT JOIN core.persons p ON h.changed_by = p.id
            LEFT JOIN core.persons ap ON h.approved_by = ap.id
            WHERE 1=1
        `;

        const params = [];
        let paramIndex = 1;

        // Add filters
        if (key) {
            query += ` AND s.setting_key = $${paramIndex}`;
            params.push(key);
            paramIndex++;
        }

        if (category) {
            query += ` AND c.category_code = $${paramIndex}`;
            params.push(category);
            paramIndex++;
        }

        if (startDate) {
            query += ` AND h.changed_at >= $${paramIndex}`;
            params.push(startDate);
            paramIndex++;
        }

        if (endDate) {
            query += ` AND h.changed_at <= $${paramIndex}`;
            params.push(endDate);
            paramIndex++;
        }

        // Add ordering and pagination
        query += ` ORDER BY h.changed_at DESC`;
        query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await pgClient.query(query, params);

        // Get total count for pagination
        let countQuery = `
            SELECT COUNT(*) as total
            FROM config.setting_history h
            JOIN config.settings s ON h.setting_id = s.id
            JOIN config.categories c ON s.category_id = c.id
            WHERE 1=1
        `;

        const countParams = [];
        let countParamIndex = 1;

        if (key) {
            countQuery += ` AND s.setting_key = $${countParamIndex}`;
            countParams.push(key);
            countParamIndex++;
        }

        if (category) {
            countQuery += ` AND c.category_code = $${countParamIndex}`;
            countParams.push(category);
            countParamIndex++;
        }

        if (startDate) {
            countQuery += ` AND h.changed_at >= $${countParamIndex}`;
            countParams.push(startDate);
            countParamIndex++;
        }

        if (endDate) {
            countQuery += ` AND h.changed_at <= $${countParamIndex}`;
            countParams.push(endDate);
            countParamIndex++;
        }

        const countResult = await pgClient.query(countQuery, countParams);

        res.status(200).json({
            success: true,
            history: result.rows,
            pagination: {
                total: parseInt(countResult.rows[0].total),
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: parseInt(offset) + result.rows.length < parseInt(countResult.rows[0].total)
            }
        });

    } catch (error) {
        console.error('Get configuration history error:', error);
        res.status(500).json({ 
            error: 'Failed to retrieve configuration history',
            message: error.message 
        });
    } finally {
        await pgClient.end();
    }
}