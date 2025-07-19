/**
 * Bridge Database Adapter
 * Handles operations across both legacy and modern systems
 * Provides seamless data access during migration
 */

import { BaseAdapter } from './base-adapter.js';

export class BridgeAdapter extends BaseAdapter {
    constructor(pgClient, legacyAdapter, modernAdapter) {
        super(pgClient);
        this.legacy = legacyAdapter;
        this.modern = modernAdapter;
    }

    /**
     * Get a person from either system
     */
    async getPersonFromMemorial(memorialId) {
        // First check modern system
        const modernPerson = await this.modern.getPersonByMemorialId(memorialId);
        if (modernPerson) {
            return {
                source: 'modern',
                data: modernPerson
            };
        }

        // Fall back to legacy
        const legacyMemorial = await this.legacy.getMemorial(memorialId);
        if (legacyMemorial) {
            return {
                source: 'legacy',
                data: this.transformMemorialToPerson(legacyMemorial)
            };
        }

        return null;
    }

    /**
     * Transform legacy memorial to person format
     */
    transformMemorialToPerson(memorial) {
        return {
            id: `legacy-memorial-${memorial.id}`,
            person_type: 'deceased',
            first_name: memorial.first_name,
            middle_name: null,
            last_name: memorial.last_name,
            maiden_name: null,
            date_of_birth: memorial.birth_date,
            date_of_death: memorial.death_date,
            primary_email: null,
            primary_phone: null,
            legacy_memorial_id: memorial.id,
            created_at: memorial.created_at,
            updated_at: memorial.updated_at,
            // Additional memorial-specific data
            memorial_data: {
                message: memorial.message
            }
        };
    }

    /**
     * Get all persons from both systems
     */
    async getAllPersons(options = {}) {
        const results = [];
        
        // Get from modern system
        const modernPersons = await this.modern.findMany('core.persons', {}, options);
        modernPersons.forEach(person => {
            results.push({
                source: 'modern',
                data: person
            });
        });

        // Get from legacy (memorials) that aren't migrated
        const unmigrated = await this.query(`
            SELECT m.*
            FROM bayview.memorials m
            LEFT JOIN core.persons p ON p.legacy_memorial_id = m.id
            WHERE p.id IS NULL
            ORDER BY m.created_at DESC
            LIMIT $1 OFFSET $2
        `, [options.limit || 100, options.offset || 0]);

        unmigrated.rows.forEach(memorial => {
            results.push({
                source: 'legacy',
                data: this.transformMemorialToPerson(memorial)
            });
        });

        return results;
    }

    /**
     * Create a person in both systems (dual-write)
     */
    async createPersonDualWrite(data, options = {}) {
        const results = {
            legacy: null,
            modern: null,
            status: 'pending'
        };

        try {
            // If this is a memorial, create in legacy first
            if (data.person_type === 'deceased' && options.createMemorial) {
                const memorialData = {
                    first_name: data.first_name,
                    middle_name: data.middle_name,
                    last_name: data.last_name,
                    maiden_name: data.maiden_name,
                    birth_date: data.date_of_birth,
                    death_date: data.date_of_death,
                    birth_place: data.memorial_data?.birth_place,
                    home_address: data.memorial_data?.home_address,
                    bayview_address: data.memorial_data?.bayview_address,
                    message: data.memorial_data?.message,
                    bayview_history: data.memorial_data?.bayview_history,
                    contact_name: data.contact_name,
                    contact_email: data.contact_email,
                    contact_phone: data.contact_phone,
                    contact_address: data.contact_address
                };

                results.legacy = await this.legacy.createMemorial(memorialData);
                data.legacy_memorial_id = results.legacy.id;
            }

            // Create in modern system
            results.modern = await this.modern.createPerson(data);

            // Link them if both created
            if (results.legacy && results.modern) {
                await this.modern.linkToLegacy(
                    results.modern.id,
                    'memorial',
                    results.legacy.id
                );
            }

            results.status = 'success';
            return results;

        } catch (error) {
            console.error('Dual write error:', error);
            results.status = 'partial';
            results.error = error.message;
            
            // If modern failed but legacy succeeded, that's acceptable
            if (results.legacy && !results.modern) {
                return results;
            }
            
            throw error;
        }
    }

    /**
     * Get comprehensive view of a person across both systems
     */
    async getUnifiedPersonView(personId) {
        const view = {
            modern: null,
            legacy: {
                memorial: null,
                chapel: null
            },
            combined: {}
        };

        // Get modern person
        const modernPerson = await this.modern.getPerson(personId);
        if (modernPerson) {
            view.modern = modernPerson;

            // Get linked legacy data
            if (modernPerson.legacy_memorial_id) {
                view.legacy.memorial = await this.legacy.getMemorial(modernPerson.legacy_memorial_id);
            }
            if (modernPerson.legacy_chapel_app_id) {
                view.legacy.chapel = await this.legacy.getChapelApplication(modernPerson.legacy_chapel_app_id);
            }
        }

        // Combine data with modern taking precedence
        view.combined = {
            ...view.legacy.memorial,
            ...view.legacy.chapel,
            ...view.modern,
            // Preserve legacy-specific fields
            legacy_data: {
                memorial: view.legacy.memorial,
                chapel: view.legacy.chapel
            }
        };

        return view;
    }

    /**
     * Search across both systems
     */
    async searchEverywhere(searchTerm, options = {}) {
        const results = {
            modern: [],
            legacy: {
                memorials: [],
                chapel: []
            }
        };

        // Search modern system
        results.modern = await this.modern.searchPersons(searchTerm, options);

        // Search legacy memorials
        const memorialQuery = `
            SELECT m.*
            FROM bayview.memorials m
            WHERE (
                m.first_name ILIKE $1 OR
                m.last_name ILIKE $1 OR
                m.message ILIKE $1
            )
            ORDER BY m.created_at DESC
            LIMIT $2
        `;
        const memorials = await this.query(memorialQuery, [`%${searchTerm}%`, options.limit || 50]);
        results.legacy.memorials = memorials.rows;

        // Search legacy chapel applications
        const chapelQuery = `
            SELECT sa.*
            FROM crouse_chapel.service_applications sa
            WHERE (
                sa.contact_name ILIKE $1 OR
                sa.contact_email ILIKE $1 OR
                sa.member_name ILIKE $1
            )
            ORDER BY sa.created_at DESC
            LIMIT $2
        `;
        const chapel = await this.query(chapelQuery, [`%${searchTerm}%`, options.limit || 50]);
        results.legacy.chapel = chapel.rows;

        return results;
    }

    /**
     * Get migration progress statistics
     */
    async getMigrationProgress() {
        const progress = {
            memorials: {
                total: 0,
                migrated: 0,
                pending: 0,
                percentage: 0
            },
            chapel: {
                total: 0,
                migrated: 0,
                pending: 0,
                percentage: 0
            },
            overall: {
                total: 0,
                migrated: 0,
                pending: 0,
                percentage: 0
            }
        };

        // Memorial migration progress
        const memorialStats = await this.query(`
            SELECT 
                COUNT(m.id) as total,
                COUNT(p.id) as migrated
            FROM bayview.memorials m
            LEFT JOIN core.persons p ON p.legacy_memorial_id = m.id
        `);
        
        progress.memorials.total = parseInt(memorialStats.rows[0].total);
        progress.memorials.migrated = parseInt(memorialStats.rows[0].migrated);
        progress.memorials.pending = progress.memorials.total - progress.memorials.migrated;
        progress.memorials.percentage = progress.memorials.total > 0 
            ? Math.round((progress.memorials.migrated / progress.memorials.total) * 100)
            : 0;

        // Chapel migration progress
        const chapelStats = await this.query(`
            SELECT 
                COUNT(sa.id) as total,
                COUNT(p.id) as migrated
            FROM crouse_chapel.service_applications sa
            LEFT JOIN core.persons p ON p.legacy_chapel_app_id = sa.id
        `);
        
        progress.chapel.total = parseInt(chapelStats.rows[0].total);
        progress.chapel.migrated = parseInt(chapelStats.rows[0].migrated);
        progress.chapel.pending = progress.chapel.total - progress.chapel.migrated;
        progress.chapel.percentage = progress.chapel.total > 0
            ? Math.round((progress.chapel.migrated / progress.chapel.total) * 100)
            : 0;

        // Overall progress
        progress.overall.total = progress.memorials.total + progress.chapel.total;
        progress.overall.migrated = progress.memorials.migrated + progress.chapel.migrated;
        progress.overall.pending = progress.overall.total - progress.overall.migrated;
        progress.overall.percentage = progress.overall.total > 0
            ? Math.round((progress.overall.migrated / progress.overall.total) * 100)
            : 0;

        return progress;
    }

    /**
     * Validate data consistency between systems
     */
    async validateConsistency() {
        const issues = [];

        // Check for persons with legacy links but missing legacy records
        const orphanedPersons = await this.query(`
            SELECT 
                p.id,
                p.first_name || ' ' || p.last_name as name,
                p.legacy_memorial_id,
                p.legacy_chapel_app_id
            FROM core.persons p
            WHERE (
                (p.legacy_memorial_id IS NOT NULL AND NOT EXISTS (
                    SELECT 1 FROM bayview.memorials m WHERE m.id = p.legacy_memorial_id
                ))
                OR
                (p.legacy_chapel_app_id IS NOT NULL AND NOT EXISTS (
                    SELECT 1 FROM crouse_chapel.service_applications sa WHERE sa.id = p.legacy_chapel_app_id
                ))
            )
        `);

        if (orphanedPersons.rows.length > 0) {
            issues.push({
                type: 'orphaned_persons',
                description: 'Persons with invalid legacy links',
                count: orphanedPersons.rows.length,
                examples: orphanedPersons.rows.slice(0, 5)
            });
        }

        // Check for data mismatches
        const mismatches = await this.query(`
            SELECT 
                p.id,
                p.first_name as modern_first,
                p.last_name as modern_last,
                m.first_name as legacy_first,
                m.last_name as legacy_last
            FROM core.persons p
            JOIN bayview.memorials m ON p.legacy_memorial_id = m.id
            WHERE p.first_name != m.first_name OR p.last_name != m.last_name
        `);

        if (mismatches.rows.length > 0) {
            issues.push({
                type: 'data_mismatch',
                description: 'Name mismatches between modern and legacy',
                count: mismatches.rows.length,
                examples: mismatches.rows.slice(0, 5)
            });
        }

        return issues;
    }
}