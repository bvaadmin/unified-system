/**
 * Modern Database Adapter
 * Handles operations on new unified schemas
 */

import { BaseAdapter } from './base-adapter.js';

export class ModernAdapter extends BaseAdapter {
    /**
     * Create a person
     */
    async createPerson(data) {
        return this.insert('core.persons', {
            person_type: data.person_type,
            first_name: data.first_name,
            middle_name: data.middle_name,
            last_name: data.last_name,
            maiden_name: data.maiden_name,
            date_of_birth: data.date_of_birth,
            gender: data.gender,
            primary_email: data.primary_email,
            primary_phone: data.primary_phone,
            legacy_memorial_id: data.legacy_memorial_id,
            legacy_chapel_app_id: data.legacy_chapel_app_id,
            migration_source: data.migration_source,
            migration_date: data.migration_date || new Date(),
            created_by: data.created_by
        });
    }

    /**
     * Get a person by ID
     */
    async getPerson(id) {
        const person = await this.findOne('core.persons', { id });
        
        if (person) {
            // Get contact methods
            person.contacts = await this.findMany('core.contact_methods', { person_id: id });
            
            // Get family relationships
            const relationships = await this.query(`
                SELECT 
                    fr.*,
                    p.first_name,
                    p.last_name
                FROM core.family_relationships fr
                JOIN core.persons p ON fr.related_person_id = p.id
                WHERE fr.person_id = $1 AND fr.is_active = true
            `, [id]);
            person.family = relationships.rows;
            
            // Get member info if applicable
            person.membership = await this.findOne('core.members', { person_id: id });
        }
        
        return person;
    }

    /**
     * Get person by legacy memorial ID
     */
    async getPersonByMemorialId(memorialId) {
        return this.findOne('core.persons', { legacy_memorial_id: memorialId });
    }

    /**
     * Get person by legacy chapel application ID
     */
    async getPersonByChapelAppId(chapelAppId) {
        return this.findOne('core.persons', { legacy_chapel_app_id: chapelAppId });
    }

    /**
     * Create or update a person from legacy data
     */
    async upsertPersonFromLegacy(source, legacyId, data) {
        const existingField = source === 'memorial' ? 'legacy_memorial_id' : 'legacy_chapel_app_id';
        const existing = await this.findOne('core.persons', { [existingField]: legacyId });
        
        if (existing) {
            // Update existing person
            return this.update('core.persons', { id: existing.id }, {
                ...data,
                updated_at: new Date()
            });
        } else {
            // Create new person
            return this.createPerson({
                ...data,
                [existingField]: legacyId,
                migration_source: `${source}_migration`,
                migration_date: new Date()
            });
        }
    }

    /**
     * Link a person to legacy records
     */
    async linkToLegacy(personId, source, legacyId) {
        const field = source === 'memorial' ? 'legacy_memorial_id' : 'legacy_chapel_app_id';
        return this.update('core.persons', { id: personId }, {
            [field]: legacyId,
            updated_at: new Date()
        });
    }

    /**
     * Create family relationship
     */
    async createFamilyRelationship(personId, relatedPersonId, relationshipType) {
        // Check if relationship already exists
        const existing = await this.findOne('core.family_relationships', {
            person_id: personId,
            related_person_id: relatedPersonId
        });
        
        if (existing) {
            return this.update('core.family_relationships', 
                { id: existing.id }, 
                { relationship_type: relationshipType, is_active: true }
            );
        }
        
        return this.insert('core.family_relationships', {
            person_id: personId,
            related_person_id: relatedPersonId,
            relationship_type: relationshipType,
            is_active: true
        });
    }

    /**
     * Create or update contact method
     */
    async upsertContactMethod(personId, contactType, contactValue, label = null) {
        const existing = await this.findOne('core.contact_methods', {
            person_id: personId,
            contact_type: contactType,
            contact_value: contactValue
        });
        
        if (existing) {
            return existing;
        }
        
        return this.insert('core.contact_methods', {
            person_id: personId,
            contact_type: contactType,
            contact_value: contactValue,
            label: label,
            is_primary: false
        });
    }

    /**
     * Create member record
     */
    async createMember(personId, data) {
        return this.insert('core.members', {
            person_id: personId,
            member_number: data.member_number,
            membership_type: data.membership_type || 'regular',
            status: data.status || 'active',
            membership_start_date: data.membership_start_date || new Date(),
            voting_eligible: data.voting_eligible !== false,
            board_eligible: data.board_eligible !== false,
            legacy_family_id: data.legacy_family_id,
            generation_number: data.generation_number
        });
    }

    /**
     * Get migration statistics
     */
    async getMigrationStats() {
        const stats = {};
        
        // Total persons
        stats.totalPersons = await this.count('core.persons');
        
        // By type
        const typeResult = await this.query(`
            SELECT person_type, COUNT(*) as count
            FROM core.persons
            GROUP BY person_type
        `);
        
        stats.byType = {};
        typeResult.rows.forEach(row => {
            stats.byType[row.person_type] = parseInt(row.count);
        });
        
        // Migration sources
        const sourceResult = await this.query(`
            SELECT migration_source, COUNT(*) as count
            FROM core.persons
            WHERE migration_source IS NOT NULL
            GROUP BY migration_source
        `);
        
        stats.bySource = {};
        sourceResult.rows.forEach(row => {
            stats.bySource[row.migration_source] = parseInt(row.count);
        });
        
        // Legacy links
        const legacyResult = await this.query(`
            SELECT 
                COUNT(CASE WHEN legacy_memorial_id IS NOT NULL THEN 1 END) as memorial_links,
                COUNT(CASE WHEN legacy_chapel_app_id IS NOT NULL THEN 1 END) as chapel_links
            FROM core.persons
        `);
        
        stats.legacyLinks = legacyResult.rows[0];
        
        return stats;
    }

    /**
     * Search persons
     */
    async searchPersons(searchTerm, options = {}) {
        const query = `
            SELECT 
                p.*,
                m.member_number,
                ts_rank(p.full_name_search, plainto_tsquery('english', $1)) as relevance
            FROM core.persons p
            LEFT JOIN core.members m ON p.id = m.person_id
            WHERE p.full_name_search @@ plainto_tsquery('english', $1)
               OR p.primary_email ILIKE $2
               OR m.member_number ILIKE $2
            ORDER BY relevance DESC, p.last_name, p.first_name
            LIMIT $3 OFFSET $4
        `;
        
        const result = await this.query(query, [
            searchTerm,
            `%${searchTerm}%`,
            options.limit || 50,
            options.offset || 0
        ]);
        
        return result.rows;
    }

    /**
     * Create audit log entry
     */
    async createAuditLog(tableName, recordId, action, userId, oldValues = null, newValues = null) {
        return this.insert('bayview.audit_log', {
            table_name: tableName,
            record_id: recordId,
            action: action,
            changed_by: userId,
            old_values: oldValues,
            new_values: newValues
        });
    }

    /**
     * Get person activity timeline
     */
    async getPersonTimeline(personId, limit = 50) {
        const query = `
            WITH timeline AS (
                -- Audit entries
                SELECT 
                    'audit' as event_type,
                    changed_at as event_date,
                    action as event_action,
                    table_name as event_context,
                    new_values as event_data
                FROM bayview.audit_log
                WHERE table_name = 'core.persons' AND record_id = $1
                
                UNION ALL
                
                -- Contact method changes
                SELECT 
                    'contact' as event_type,
                    created_at as event_date,
                    'created' as event_action,
                    contact_type as event_context,
                    jsonb_build_object('value', contact_value, 'label', label) as event_data
                FROM core.contact_methods
                WHERE person_id = $1
                
                UNION ALL
                
                -- Family relationships
                SELECT 
                    'family' as event_type,
                    fr.created_at as event_date,
                    'added' as event_action,
                    fr.relationship_type as event_context,
                    jsonb_build_object(
                        'related_person', p.first_name || ' ' || p.last_name,
                        'related_person_id', p.id
                    ) as event_data
                FROM core.family_relationships fr
                JOIN core.persons p ON fr.related_person_id = p.id
                WHERE fr.person_id = $1
            )
            SELECT * FROM timeline
            ORDER BY event_date DESC
            LIMIT $2
        `;
        
        const result = await this.query(query, [personId, limit]);
        return result.rows;
    }
}