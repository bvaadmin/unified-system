/**
 * Create Bay View Events Registrations
 * Adds registrations to existing programs and sessions
 */
import dotenv from 'dotenv';
import { createDualWriteManager } from '../lib/database/dual-write-manager.js';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function createEventsRegistrations() {
    const DATABASE_URL = process.env.DATABASE_URL;
    
    if (!DATABASE_URL) {
        console.error('DATABASE_URL not found in environment variables');
        process.exit(1);
    }

    const manager = createDualWriteManager(DATABASE_URL);

    try {
        await manager.connect();
        console.log('📝 Creating Bay View Events Registrations\\n');

        // Get existing persons
        const persons = await manager.pgClient.query(`
            SELECT p.*, m.id as member_id 
            FROM core.persons p
            LEFT JOIN core.members m ON p.id = m.person_id
            ORDER BY p.id
            LIMIT 10
        `);

        // Get existing sessions
        const sessions = await manager.pgClient.query(`
            SELECT ps.*, p.program_name, p.member_fee, p.non_member_fee, p.materials_fee
            FROM events.program_sessions ps
            JOIN events.programs p ON ps.program_id = p.id
            WHERE ps.status = 'open'
            ORDER BY ps.start_date
        `);

        console.log(`Found ${persons.rows.length} persons and ${sessions.rows.length} open sessions\\n`);

        // Create registrations
        const registrations = [
            // Junior Tennis registrations
            {
                program_name: 'Junior Tennis Academy',
                person_index: 0,
                is_member: true,
                payment_status: 'paid'
            },
            {
                program_name: 'Junior Tennis Academy', 
                person_index: 1,
                is_member: true,
                payment_status: 'paid'
            },
            // Morning Yoga registrations
            {
                program_name: 'Morning Yoga',
                person_index: 0,
                is_member: true,
                payment_status: 'paid'
            },
            {
                program_name: 'Morning Yoga',
                person_index: 2,
                is_member: true,
                payment_status: 'paid'
            },
            {
                program_name: 'Morning Yoga',
                person_index: 3,
                is_member: false,
                payment_status: 'pending'
            },
            // Youth Choir
            {
                program_name: 'Bay View Youth Choir',
                person_index: 4,
                is_member: true,
                payment_status: 'paid'
            },
            // Watercolor Workshop
            {
                program_name: 'Watercolor Workshop',
                person_index: 1,
                is_member: true,
                payment_status: 'paid'
            },
            {
                program_name: 'Watercolor Workshop',
                person_index: 5,
                is_member: false,
                payment_status: 'paid'
            }
        ];

        let successCount = 0;
        for (const reg of registrations) {
            // Find matching session
            const session = sessions.rows.find(s => s.program_name.includes(reg.program_name));
            if (!session) {
                console.log(`   ⚠️  No session found for ${reg.program_name}`);
                continue;
            }

            const person = persons.rows[reg.person_index];
            if (!person) {
                console.log(`   ⚠️  No person at index ${reg.person_index}`);
                continue;
            }

            // Check if already registered
            const existing = await manager.pgClient.query(`
                SELECT id FROM events.registrations 
                WHERE program_session_id = $1 AND person_id = $2
            `, [session.id, person.id]);

            if (existing.rows.length > 0) {
                console.log(`   ℹ️  ${person.first_name} ${person.last_name} already registered for ${session.program_name}`);
                continue;
            }

            // Calculate fees
            const baseFee = reg.is_member ? 
                parseFloat(session.session_member_fee || session.member_fee) : 
                parseFloat(session.session_non_member_fee || session.non_member_fee);
            const materialsFee = parseFloat(session.materials_fee || 0);
            const totalFee = baseFee + materialsFee;

            await manager.pgClient.query(`
                INSERT INTO events.registrations (
                    program_session_id, person_id, registration_type,
                    is_member, member_id, base_fee, materials_fee, total_fee,
                    payment_status, payment_date, status,
                    emergency_contact_name, emergency_contact_phone
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
                )
            `, [
                session.id, person.id, 'participant',
                reg.is_member, reg.is_member ? person.member_id : null,
                baseFee, materialsFee, totalFee, reg.payment_status,
                reg.payment_status === 'paid' ? '2025-05-15' : null,
                'registered',
                'Emergency Contact', '231-555-9999'
            ]);
            
            console.log(`   ✅ Registered ${person.first_name} ${person.last_name} for ${session.program_name} ($${totalFee})`);
            successCount++;
        }

        // Add facility maintenance if not exists
        console.log('\\n🔧 Creating Facility Maintenance Schedule');

        const maintenanceExists = await manager.pgClient.query(
            'SELECT COUNT(*) as count FROM events.facility_maintenance'
        );

        if (maintenanceExists.rows[0].count === '0') {
            const maintenance = [
                {
                    facility_code: 'HALL-AUD',
                    maintenance_type: 'inspection',
                    scheduled_date: '2025-06-01',
                    description: 'Annual fire safety and electrical inspection',
                    contractor_name: 'Northern Michigan Safety Services',
                    estimated_cost: 500.00
                },
                {
                    facility_code: 'TENNIS',
                    maintenance_type: 'seasonal_prep',
                    scheduled_date: '2025-05-15',
                    description: 'Court resurfacing and net replacement',
                    contractor_name: 'Great Lakes Tennis Courts',
                    estimated_cost: 8500.00
                }
            ];

            for (const maint of maintenance) {
                const facility = await manager.pgClient.query(
                    'SELECT id FROM events.facilities WHERE facility_code = $1',
                    [maint.facility_code]
                );

                if (facility.rows.length > 0) {
                    await manager.pgClient.query(`
                        INSERT INTO events.facility_maintenance (
                            facility_id, maintenance_type, scheduled_date,
                            description, contractor_name, estimated_cost,
                            facility_closed, status
                        ) VALUES ($1, $2, $3, $4, $5, $6, true, 'scheduled')
                    `, [
                        facility.rows[0].id, maint.maintenance_type, maint.scheduled_date,
                        maint.description, maint.contractor_name, maint.estimated_cost
                    ]);
                    
                    console.log(`   ✅ Scheduled maintenance for ${maint.facility_code}`);
                }
            }
        }

        // Summary
        console.log('\\n📊 Registration Summary:');
        
        const regStats = await manager.pgClient.query(`
            SELECT 
                p.program_name,
                COUNT(r.id) as registrations,
                SUM(CASE WHEN r.is_member THEN 1 ELSE 0 END) as member_registrations,
                SUM(r.total_fee) as total_revenue
            FROM events.registrations r
            JOIN events.program_sessions ps ON r.program_session_id = ps.id
            JOIN events.programs p ON ps.program_id = p.id
            GROUP BY p.program_name
            ORDER BY COUNT(r.id) DESC
        `);

        console.table(regStats.rows);

        console.log(`\\n✅ Created ${successCount} new registrations successfully!`);

    } catch (error) {
        console.error('Registration creation failed:', error.message);
        console.error(error.stack);
    } finally {
        await manager.disconnect();
    }
}

createEventsRegistrations();