/**
 * Legacy Database Adapter
 * Handles operations on existing bayview and crouse_chapel schemas
 */

import { BaseAdapter } from './base-adapter.js';

export class LegacyAdapter extends BaseAdapter {
    /**
     * Get a memorial by ID
     */
    async getMemorial(id) {
        return this.findOne('bayview.memorials', { id });
    }

    /**
     * Get all memorials
     */
    async getAllMemorials(options = {}) {
        return this.findMany('bayview.memorials', {}, {
            orderBy: options.orderBy || 'created_at DESC',
            limit: options.limit,
            offset: options.offset
        });
    }

    /**
     * Create a memorial
     */
    async createMemorial(data) {
        // Only include fields that exist in the table
        const memorialData = {
            first_name: data.first_name,
            last_name: data.last_name,
            birth_date: data.birth_date,
            death_date: data.death_date,
            message: data.message
        };
        
        return this.insert('bayview.memorials', memorialData);
    }

    /**
     * Update a memorial
     */
    async updateMemorial(id, data) {
        return this.update('bayview.memorials', { id }, data);
    }

    /**
     * Get a chapel service application
     */
    async getChapelApplication(id) {
        const app = await this.findOne('crouse_chapel.service_applications', { id });
        
        if (app) {
            // Get related details based on type
            switch (app.application_type) {
                case 'wedding':
                    app.details = await this.findOne('crouse_chapel.wedding_details', { application_id: id });
                    break;
                case 'memorial':
                    app.details = await this.findOne('crouse_chapel.memorial_details', { application_id: id });
                    break;
                case 'baptism':
                    app.details = await this.findOne('crouse_chapel.baptism_details', { application_id: id });
                    break;
                case 'general-use':
                    app.details = await this.findOne('crouse_chapel.general_use_details', { application_id: id });
                    break;
            }
            
            // Get clergy
            const clergyResult = await this.query(`
                SELECT c.* 
                FROM crouse_chapel.clergy c
                JOIN crouse_chapel.service_clergy sc ON c.id = sc.clergy_id
                WHERE sc.application_id = $1
            `, [id]);
            app.clergy = clergyResult.rows;
            
            // Get equipment
            app.equipment = await this.findOne('crouse_chapel.service_equipment', { application_id: id });
        }
        
        return app;
    }

    /**
     * Create a chapel service application
     */
    async createChapelApplication(data) {
        return this.transaction(async (client) => {
            // Create main application
            const appResult = await client.query(`
                INSERT INTO crouse_chapel.service_applications (
                    application_type, service_date, service_time,
                    contact_name, contact_email, contact_phone, contact_address,
                    member_name, member_relationship,
                    status, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
                RETURNING *
            `, [
                data.application_type,
                data.service_date,
                data.service_time,
                data.contact_name,
                data.contact_email,
                data.contact_phone,
                data.contact_address,
                data.member_name,
                data.member_relationship,
                'pending'
            ]);
            
            const application = appResult.rows[0];
            
            // Create type-specific details
            // (Implementation depends on application type)
            
            return application;
        });
    }

    /**
     * Get memorials with Notion sync status
     */
    async getMemorialsNeedingSync() {
        // Since the simple memorial table doesn't have notion tracking,
        // return all memorials
        return this.query(`
            SELECT * FROM bayview.memorials
            ORDER BY created_at
            LIMIT 100
        `).then(result => result.rows);
    }

    /**
     * Update memorial Notion sync status
     */
    async updateMemorialNotionSync(id, notionId) {
        // No-op for now since table doesn't have notion columns
        console.log(`Would update memorial ${id} with Notion ID ${notionId}`);
        return { id };
    }

    /**
     * Count total legacy records
     */
    async getLegacyCounts() {
        const counts = {};
        
        // Count memorials
        counts.memorials = await this.count('bayview.memorials');
        
        // Count chapel applications
        counts.chapelApplications = await this.count('crouse_chapel.service_applications');
        
        // Count by type
        const typeResult = await this.query(`
            SELECT application_type, COUNT(*) as count
            FROM crouse_chapel.service_applications
            GROUP BY application_type
        `);
        
        counts.chapelByType = {};
        typeResult.rows.forEach(row => {
            counts.chapelByType[row.application_type] = parseInt(row.count);
        });
        
        return counts;
    }

    /**
     * Check data integrity
     */
    async checkIntegrity() {
        const issues = [];
        
        // Check for orphaned wedding details
        const orphanedWeddings = await this.query(`
            SELECT wd.id 
            FROM crouse_chapel.wedding_details wd
            LEFT JOIN crouse_chapel.service_applications sa ON wd.application_id = sa.id
            WHERE sa.id IS NULL
        `);
        
        if (orphanedWeddings.rows.length > 0) {
            issues.push({
                type: 'orphaned_records',
                table: 'wedding_details',
                count: orphanedWeddings.rows.length
            });
        }
        
        // Check for applications without details
        const missingDetails = await this.query(`
            SELECT sa.id, sa.application_type
            FROM crouse_chapel.service_applications sa
            LEFT JOIN crouse_chapel.wedding_details wd ON sa.id = wd.application_id AND sa.application_type = 'wedding'
            LEFT JOIN crouse_chapel.memorial_details md ON sa.id = md.application_id AND sa.application_type = 'memorial'
            LEFT JOIN crouse_chapel.baptism_details bd ON sa.id = bd.application_id AND sa.application_type = 'baptism'
            LEFT JOIN crouse_chapel.general_use_details gd ON sa.id = gd.application_id AND sa.application_type = 'general-use'
            WHERE wd.id IS NULL AND md.id IS NULL AND bd.id IS NULL AND gd.id IS NULL
        `);
        
        if (missingDetails.rows.length > 0) {
            issues.push({
                type: 'missing_details',
                table: 'service_applications',
                count: missingDetails.rows.length
            });
        }
        
        return issues;
    }
}