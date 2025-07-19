/**
 * Dual Write Manager
 * Coordinates writes to both legacy and modern systems during migration
 */

import { Client } from 'pg';
import { LegacyAdapter } from './adapters/legacy-adapter.js';
import { ModernAdapter } from './adapters/modern-adapter.js';
import { BridgeAdapter } from './adapters/bridge-adapter.js';

export class DualWriteManager {
    constructor(connectionString) {
        this.connectionString = connectionString;
        this.pgClient = null;
        this.legacy = null;
        this.modern = null;
        this.bridge = null;
        this.isConnected = false;
    }

    /**
     * Initialize the manager and connect to the database
     */
    async connect() {
        if (this.isConnected) return;

        this.pgClient = new Client({
            connectionString: this.connectionString.replace('?sslmode=require', ''),
            ssl: {
                rejectUnauthorized: false
            }
        });

        await this.pgClient.connect();
        
        // Initialize adapters
        this.legacy = new LegacyAdapter(this.pgClient);
        this.modern = new ModernAdapter(this.pgClient);
        this.bridge = new BridgeAdapter(this.pgClient, this.legacy, this.modern);
        
        this.isConnected = true;
    }

    /**
     * Disconnect from the database
     */
    async disconnect() {
        if (this.pgClient) {
            await this.pgClient.end();
            this.isConnected = false;
        }
    }

    /**
     * Create a memorial with dual-write
     */
    async createMemorial(data) {
        await this.connect();
        
        const result = {
            success: false,
            legacy: null,
            modern: null,
            errors: []
        };

        try {
            // Start transaction
            await this.pgClient.query('BEGIN');

            // 1. Create in legacy system first (required for Notion sync)
            try {
                result.legacy = await this.legacy.createMemorial(data);
            } catch (error) {
                result.errors.push({
                    system: 'legacy',
                    message: error.message
                });
                throw error; // Fatal - can't proceed without legacy
            }

            // 2. Create person in modern system
            try {
                const personData = {
                    person_type: 'deceased',
                    first_name: data.first_name,
                    last_name: data.last_name,
                    date_of_birth: data.birth_date,
                    date_of_death: data.death_date,
                    primary_email: data.contact_email || null,
                    primary_phone: data.contact_phone || null,
                    legacy_memorial_id: result.legacy.id,
                    migration_source: 'dual_write'
                };

                result.modern = await this.modern.createPerson(personData);

                // Add contact info if provided
                if (data.contact_name && result.modern) {
                    // Create contact person if they don't exist
                    const contactParts = data.contact_name.split(' ');
                    const contactPerson = await this.modern.createPerson({
                        person_type: 'member',
                        first_name: contactParts[0],
                        last_name: contactParts.slice(1).join(' ') || 'Unknown',
                        primary_email: data.contact_email,
                        primary_phone: data.contact_phone,
                        migration_source: 'memorial_contact'
                    });

                    // Create relationship
                    if (contactPerson) {
                        await this.modern.createFamilyRelationship(
                            result.modern.id,
                            contactPerson.id,
                            'other'
                        );
                    }
                }

                // Create contact methods
                if (data.contact_email) {
                    await this.modern.upsertContactMethod(
                        result.modern.id,
                        'email',
                        data.contact_email,
                        'memorial_contact'
                    );
                }

                if (data.contact_phone) {
                    await this.modern.upsertContactMethod(
                        result.modern.id,
                        'phone',
                        data.contact_phone,
                        'memorial_contact'
                    );
                }

                if (data.contact_address) {
                    await this.modern.upsertContactMethod(
                        result.modern.id,
                        'address',
                        data.contact_address,
                        'memorial_contact'
                    );
                }

            } catch (error) {
                result.errors.push({
                    system: 'modern',
                    message: error.message
                });
                // Non-fatal - we can continue with legacy only
            }

            // Commit transaction
            await this.pgClient.query('COMMIT');
            result.success = true;

        } catch (error) {
            // Rollback on any error
            await this.pgClient.query('ROLLBACK');
            throw error;
        }

        return result;
    }

    /**
     * Create a chapel application with dual-write
     */
    async createChapelApplication(data) {
        await this.connect();
        
        const result = {
            success: false,
            legacy: null,
            modern: null,
            errors: []
        };

        try {
            // Start transaction
            await this.pgClient.query('BEGIN');

            // 1. Create in legacy system
            try {
                // Create chapel application using direct query
                const chapelResult = await this.pgClient.query(`
                    INSERT INTO crouse_chapel.service_applications (
                        application_type, service_date, service_time,
                        rehearsal_date, rehearsal_time,
                        member_name, member_relationship,
                        contact_name, contact_address, contact_phone, contact_email,
                        status, payment_status, submission_date,
                        created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
                    RETURNING *
                `, [
                    data.application_type,
                    data.service_date,
                    data.service_time,
                    data.rehearsal_date,
                    data.rehearsal_time,
                    data.member_name,
                    data.member_relationship,
                    data.contact_name,
                    data.contact_address,
                    data.contact_phone,
                    data.contact_email,
                    data.status || 'pending',
                    data.payment_status || 'pending',
                    data.submission_date || new Date()
                ]);

                result.legacy = chapelResult.rows[0];
            } catch (error) {
                result.errors.push({
                    system: 'legacy',
                    message: error.message
                });
                throw error; // Fatal
            }

            // 2. Create persons in modern system
            try {
                // Create applicant
                const applicantData = {
                    person_type: 'member',
                    first_name: data.contact_name.split(' ')[0],
                    last_name: data.contact_name.split(' ').slice(1).join(' ') || 'Unknown',
                    primary_email: data.contact_email || null,
                    primary_phone: data.contact_phone || null,
                    legacy_chapel_app_id: result.legacy.id,
                    migration_source: 'chapel_applicant'
                };

                result.modern = await this.modern.createPerson(applicantData);

                // Create member sponsor if different
                if (data.member_name && data.member_name !== data.contact_name) {
                    const memberParts = data.member_name.split(' ');
                    const memberPerson = await this.modern.createPerson({
                        person_type: 'member',
                        first_name: memberParts[0],
                        last_name: memberParts.slice(1).join(' ') || 'Unknown',
                        migration_source: 'chapel_member_sponsor'
                    });

                    // Create relationship
                    if (memberPerson && result.modern) {
                        await this.modern.createFamilyRelationship(
                            result.modern.id,
                            memberPerson.id,
                            'other'
                        );
                    }
                }

            } catch (error) {
                result.errors.push({
                    system: 'modern',
                    message: error.message
                });
                // Non-fatal
            }

            // Commit transaction
            await this.pgClient.query('COMMIT');
            result.success = true;

        } catch (error) {
            // Rollback on any error
            await this.pgClient.query('ROLLBACK');
            throw error;
        }

        return result;
    }

    /**
     * Search across both systems
     */
    async search(searchTerm, options = {}) {
        await this.connect();
        return this.bridge.searchEverywhere(searchTerm, options);
    }

    /**
     * Get migration progress
     */
    async getMigrationProgress() {
        await this.connect();
        return this.bridge.getMigrationProgress();
    }

    /**
     * Validate data consistency
     */
    async validateConsistency() {
        await this.connect();
        return this.bridge.validateConsistency();
    }

    /**
     * Get person unified view
     */
    async getPersonUnifiedView(personId) {
        await this.connect();
        return this.bridge.getUnifiedPersonView(personId);
    }

    /**
     * Run a one-time migration of a memorial record
     */
    async migrateMemorial(memorialId) {
        await this.connect();
        
        // Get memorial from legacy
        const memorial = await this.legacy.getMemorial(memorialId);
        if (!memorial) {
            throw new Error(`Memorial ${memorialId} not found`);
        }

        // Check if already migrated
        const existing = await this.modern.getPersonByMemorialId(memorialId);
        if (existing) {
            return {
                status: 'already_migrated',
                person: existing
            };
        }

        // Create person in modern system
        const personData = {
            person_type: 'deceased',
            first_name: memorial.first_name,
            last_name: memorial.last_name,
            date_of_birth: memorial.birth_date,
            date_of_death: memorial.death_date,
            legacy_memorial_id: memorial.id,
            migration_source: 'batch_migration',
            created_at: memorial.created_at
        };

        const person = await this.modern.createPerson(personData);

        return {
            status: 'migrated',
            person: person
        };
    }

    /**
     * Batch migrate all unmigrated memorials
     */
    async batchMigrateMemorials(limit = 100) {
        await this.connect();
        
        const results = {
            total: 0,
            migrated: 0,
            skipped: 0,
            errors: []
        };

        // Get unmigrated memorials
        const unmigrated = await this.pgClient.query(`
            SELECT m.*
            FROM bayview.memorials m
            LEFT JOIN core.persons p ON p.legacy_memorial_id = m.id
            WHERE p.id IS NULL
            ORDER BY m.created_at
            LIMIT $1
        `, [limit]);

        results.total = unmigrated.rows.length;

        for (const memorial of unmigrated.rows) {
            try {
                const result = await this.migrateMemorial(memorial.id);
                if (result.status === 'migrated') {
                    results.migrated++;
                } else {
                    results.skipped++;
                }
            } catch (error) {
                results.errors.push({
                    memorial_id: memorial.id,
                    error: error.message
                });
            }
        }

        return results;
    }
}

/**
 * Create a dual-write manager instance
 */
export function createDualWriteManager(databaseUrl) {
    return new DualWriteManager(databaseUrl);
}