/**
 * Base Database Adapter
 * Provides common functionality for all database adapters
 */

export class BaseAdapter {
    constructor(pgClient) {
        this.pgClient = pgClient;
    }

    /**
     * Execute a query with automatic error handling
     */
    async query(sql, params = []) {
        try {
            const result = await this.pgClient.query(sql, params);
            return result;
        } catch (error) {
            console.error('Database query error:', error.message);
            console.error('Query:', sql);
            console.error('Params:', params);
            throw error;
        }
    }

    /**
     * Execute a transaction
     */
    async transaction(callback) {
        await this.pgClient.query('BEGIN');
        try {
            const result = await callback(this.pgClient);
            await this.pgClient.query('COMMIT');
            return result;
        } catch (error) {
            await this.pgClient.query('ROLLBACK');
            throw error;
        }
    }

    /**
     * Check if a record exists
     */
    async exists(table, conditions) {
        const keys = Object.keys(conditions);
        const values = Object.values(conditions);
        const whereClause = keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');
        
        const result = await this.query(
            `SELECT EXISTS(SELECT 1 FROM ${table} WHERE ${whereClause})`,
            values
        );
        
        return result.rows[0].exists;
    }

    /**
     * Get a single record
     */
    async findOne(table, conditions) {
        const keys = Object.keys(conditions);
        const values = Object.values(conditions);
        const whereClause = keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');
        
        const result = await this.query(
            `SELECT * FROM ${table} WHERE ${whereClause} LIMIT 1`,
            values
        );
        
        return result.rows[0];
    }

    /**
     * Get multiple records
     */
    async findMany(table, conditions = {}, options = {}) {
        const keys = Object.keys(conditions);
        const values = Object.values(conditions);
        let whereClause = '';
        
        if (keys.length > 0) {
            whereClause = 'WHERE ' + keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');
        }
        
        let query = `SELECT * FROM ${table} ${whereClause}`;
        
        if (options.orderBy) {
            query += ` ORDER BY ${options.orderBy}`;
        }
        
        if (options.limit) {
            query += ` LIMIT ${options.limit}`;
        }
        
        if (options.offset) {
            query += ` OFFSET ${options.offset}`;
        }
        
        const result = await this.query(query, values);
        return result.rows;
    }

    /**
     * Insert a record
     */
    async insert(table, data) {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const placeholders = keys.map((_, i) => `$${i + 1}`);
        
        const query = `
            INSERT INTO ${table} (${keys.join(', ')})
            VALUES (${placeholders.join(', ')})
            RETURNING *
        `;
        
        const result = await this.query(query, values);
        return result.rows[0];
    }

    /**
     * Update a record
     */
    async update(table, conditions, data) {
        const dataKeys = Object.keys(data);
        const dataValues = Object.values(data);
        const conditionKeys = Object.keys(conditions);
        const conditionValues = Object.values(conditions);
        
        const setClause = dataKeys.map((key, i) => `${key} = $${i + 1}`).join(', ');
        const whereClause = conditionKeys.map((key, i) => `${key} = $${dataKeys.length + i + 1}`).join(' AND ');
        
        const query = `
            UPDATE ${table}
            SET ${setClause}
            WHERE ${whereClause}
            RETURNING *
        `;
        
        const result = await this.query(query, [...dataValues, ...conditionValues]);
        return result.rows[0];
    }

    /**
     * Delete a record
     */
    async delete(table, conditions) {
        const keys = Object.keys(conditions);
        const values = Object.values(conditions);
        const whereClause = keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');
        
        const query = `
            DELETE FROM ${table}
            WHERE ${whereClause}
            RETURNING *
        `;
        
        const result = await this.query(query, values);
        return result.rows[0];
    }

    /**
     * Count records
     */
    async count(table, conditions = {}) {
        const keys = Object.keys(conditions);
        const values = Object.values(conditions);
        let whereClause = '';
        
        if (keys.length > 0) {
            whereClause = 'WHERE ' + keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');
        }
        
        const result = await this.query(
            `SELECT COUNT(*) FROM ${table} ${whereClause}`,
            values
        );
        
        return parseInt(result.rows[0].count);
    }
}