/**
 * Create Bay View Association Events and Programs Sample Data
 * Demonstrates the full events system with facilities, programs, and registrations
 */
import dotenv from 'dotenv';
import { createDualWriteManager } from '../lib/database/dual-write-manager.js';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function createBayViewEventsData() {
    const DATABASE_URL = process.env.DATABASE_URL;
    
    if (!DATABASE_URL) {
        console.error('DATABASE_URL not found in environment variables');
        process.exit(1);
    }

    const manager = createDualWriteManager(DATABASE_URL);

    try {
        await manager.connect();
        console.log('🎪 Creating Bay View Association Events and Programs Data\\n');

        // Get existing persons and members for relationships
        const persons = await manager.pgClient.query(`
            SELECT p.*, m.id as member_id 
            FROM core.persons p
            LEFT JOIN core.members m ON p.id = m.person_id
            ORDER BY p.id
            LIMIT 10
        `);

        if (persons.rows.length === 0) {
            console.error('No persons found. Please run sample data creation first.');
            return;
        }

        // =====================================================
        // 1. CREATE FACILITY BOOKINGS
        // =====================================================
        
        console.log('1. Creating Bay View Facility Bookings');

        const bookings = [
            // Chapel wedding (integrated with chapel system)
            {
                facility_code: 'CROUSE-CHAPEL',
                event_name: 'Smith-Johnson Wedding',
                event_type: 'wedding',
                organizer_person_id: persons.rows[0].id,
                organizer_name: persons.rows[0].first_name + ' ' + persons.rows[0].last_name,
                organizer_email: persons.rows[0].primary_email,
                event_date: '2025-08-15',
                start_time: '14:00',
                end_time: '16:00',
                setup_start_time: '12:00',
                cleanup_end_time: '17:00',
                expected_attendance: 200,
                rental_fee: 750.00,
                status: 'confirmed'
            },
            // Hall Auditorium concert
            {
                facility_code: 'HALL-AUD',
                event_name: 'Bay View Music Festival: Opening Concert',
                event_type: 'concert',
                organizer_person_id: persons.rows[1].id,
                organizer_name: 'Bay View Music Department',
                organizer_email: 'music@bayviewassociation.org',
                event_date: '2025-07-04',
                start_time: '19:30',
                end_time: '21:30',
                expected_attendance: 1200,
                rental_fee: 0.00, // Bay View event
                equipment_fee: 200.00,
                status: 'confirmed'
            },
            // Evelyn Hall reception
            {
                facility_code: 'EVELYN-HALL',
                event_name: 'Williams Family 50th Anniversary Reception',
                event_type: 'reception',
                organizer_person_id: persons.rows[2].id,
                organizer_name: persons.rows[2].first_name + ' ' + persons.rows[2].last_name,
                organizer_email: persons.rows[2].primary_email,
                sponsor_member_id: persons.rows[2].member_id,
                event_date: '2025-07-20',
                start_time: '17:00',
                end_time: '20:00',
                expected_attendance: 150,
                rental_fee: 75.00,
                cleaning_fee: 50.00,
                status: 'confirmed'
            },
            // Library committee meeting
            {
                facility_code: 'LIBRARY-MTG',
                event_name: 'Historical Society Monthly Meeting',
                event_type: 'meeting',
                organizer_person_id: persons.rows[3].id,
                organizer_name: 'Bay View Historical Society',
                event_date: '2025-07-10',
                start_time: '10:00',
                end_time: '12:00',
                expected_attendance: 15,
                rental_fee: 0.00, // Free for committees
                status: 'confirmed'
            },
            // Campus Club event
            {
                facility_code: 'CAMPUS-CLUB',
                event_name: 'New Member Welcome Reception',
                event_type: 'reception',
                organizer_name: 'Bay View Membership Committee',
                event_date: '2025-06-28',
                start_time: '16:00',
                end_time: '18:00',
                expected_attendance: 75,
                rental_fee: 100.00,
                status: 'confirmed'
            }
        ];

        for (const booking of bookings) {
            // Get facility ID
            const facility = await manager.pgClient.query(
                'SELECT id FROM events.facilities WHERE facility_code = $1',
                [booking.facility_code]
            );

            if (facility.rows.length > 0) {
                await manager.pgClient.query(`
                    INSERT INTO events.bookings (
                        facility_id, event_name, event_type, organizer_person_id,
                        organizer_name, organizer_email, sponsor_member_id,
                        event_date, start_time, end_time, setup_start_time, cleanup_end_time,
                        expected_attendance, rental_fee, cleaning_fee, equipment_fee,
                        status, is_bay_view_event
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
                    )
                `, [
                    facility.rows[0].id, booking.event_name, booking.event_type,
                    booking.organizer_person_id, booking.organizer_name, booking.organizer_email,
                    booking.sponsor_member_id, booking.event_date, booking.start_time,
                    booking.end_time, booking.setup_start_time, booking.cleanup_end_time,
                    booking.expected_attendance, booking.rental_fee || 0,
                    booking.cleaning_fee || 0, booking.equipment_fee || 0,
                    booking.status, booking.rental_fee === 0
                ]);
                
                console.log(`   ✅ Created booking: ${booking.event_name} at ${booking.facility_code}`);
            }
        }

        // =====================================================
        // 2. CREATE BAY VIEW PROGRAMS
        // =====================================================
        
        console.log('\\n2. Creating Bay View Programs');

        const programs = [
            {
                program_name: 'Junior Tennis Academy',
                program_code: 'TENNIS-JR-2025',
                program_type: 'recreation',
                description: 'Comprehensive tennis instruction for youth ages 8-16',
                target_audience: 'Youth',
                min_age: 8,
                max_age: 16,
                min_participants: 4,
                max_participants: 12,
                program_duration_weeks: 8,
                sessions_per_week: 3,
                minutes_per_session: 90,
                member_fee: 250.00,
                non_member_fee: 400.00,
                bay_view_tradition: true,
                years_offered: 45
            },
            {
                program_name: 'Morning Yoga on the Green',
                program_code: 'YOGA-MORN-2025',
                program_type: 'wellness',
                description: 'Gentle yoga sessions overlooking Little Traverse Bay',
                target_audience: 'Adults',
                min_age: 18,
                min_participants: 5,
                max_participants: 25,
                program_duration_weeks: 10,
                sessions_per_week: 5,
                minutes_per_session: 60,
                member_fee: 100.00,
                non_member_fee: 150.00,
                drop_in_fee: 15.00,
                bay_view_tradition: false,
                years_offered: 8
            },
            {
                program_name: 'Bay View Youth Choir',
                program_code: 'CHOIR-YOUTH-2025',
                program_type: 'music',
                description: 'Youth choir performing at Sunday services and special events',
                target_audience: 'Youth',
                min_age: 10,
                max_age: 18,
                min_participants: 12,
                max_participants: 40,
                program_duration_weeks: 10,
                sessions_per_week: 2,
                minutes_per_session: 90,
                member_fee: 50.00,
                non_member_fee: 100.00,
                bay_view_tradition: true,
                years_offered: 75
            },
            {
                program_name: 'Watercolor Workshop',
                program_code: 'ART-WATER-2025',
                program_type: 'arts',
                description: 'Learn watercolor techniques while painting Bay View scenes',
                target_audience: 'Adults',
                min_age: 16,
                min_participants: 6,
                max_participants: 15,
                program_duration_weeks: 4,
                sessions_per_week: 2,
                minutes_per_session: 120,
                member_fee: 125.00,
                non_member_fee: 175.00,
                materials_fee: 35.00,
                bay_view_tradition: false,
                years_offered: 12
            },
            {
                program_name: 'Tot Lot Summer Program',
                program_code: 'TOTS-SUMMER-2025',
                program_type: 'youth',
                description: 'Morning activities for Bay View youngest residents',
                target_audience: 'Children',
                min_age: 3,
                max_age: 6,
                min_participants: 8,
                max_participants: 20,
                program_duration_weeks: 8,
                sessions_per_week: 5,
                minutes_per_session: 180,
                member_fee: 300.00,
                non_member_fee: 450.00,
                bay_view_tradition: true,
                years_offered: 60
            }
        ];

        const createdPrograms = [];
        for (const program of programs) {
            // Get appropriate facility
            let facilityId = null;
            if (program.program_type === 'recreation' && program.program_name.includes('Tennis')) {
                const tennis = await manager.pgClient.query(
                    "SELECT id FROM events.facilities WHERE facility_code = 'TENNIS'"
                );
                facilityId = tennis.rows[0]?.id;
            }

            const result = await manager.pgClient.query(`
                INSERT INTO events.programs (
                    program_name, program_code, program_type, description,
                    target_audience, min_age, max_age, min_participants, max_participants,
                    program_duration_weeks, sessions_per_week, minutes_per_session,
                    default_facility_id, member_fee, non_member_fee, materials_fee, drop_in_fee,
                    bay_view_tradition, years_offered, is_active, requires_registration
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
                ) RETURNING *
            `, [
                program.program_name, program.program_code, program.program_type, program.description,
                program.target_audience, program.min_age, program.max_age, program.min_participants,
                program.max_participants, program.program_duration_weeks, program.sessions_per_week,
                program.minutes_per_session, facilityId, program.member_fee, program.non_member_fee,
                program.materials_fee || 0, program.drop_in_fee || null, program.bay_view_tradition,
                program.years_offered, true, true
            ]);
            
            createdPrograms.push(result.rows[0]);
            console.log(`   ✅ Created program: ${program.program_name}`);
        }

        // =====================================================
        // 3. CREATE PROGRAM SESSIONS (Summer 2025)
        // =====================================================
        
        console.log('\\n3. Creating Summer 2025 Program Sessions');

        const sessions = [
            {
                program_index: 0, // Junior Tennis
                session_name: 'Junior Tennis Academy - Summer 2025',
                session_code: 'JR-TENNIS-SUM25',
                start_date: '2025-06-23',
                end_date: '2025-08-15',
                schedule_pattern: 'mwf',
                max_participants: 12,
                registration_opens: '2025-04-01',
                registration_closes: '2025-06-20',
                early_bird_deadline: '2025-05-15',
                early_bird_discount: 25.00,
                status: 'open'
            },
            {
                program_index: 1, // Morning Yoga
                session_name: 'Morning Yoga - Full Summer',
                session_code: 'YOGA-FULL-SUM25',
                start_date: '2025-06-16',
                end_date: '2025-08-22',
                schedule_pattern: 'weekdays',
                max_participants: 25,
                registration_opens: '2025-05-01',
                registration_closes: '2025-06-14',
                status: 'open'
            },
            {
                program_index: 2, // Youth Choir
                session_name: 'Bay View Youth Choir 2025',
                session_code: 'CHOIR-Y-2025',
                start_date: '2025-06-22',
                end_date: '2025-08-31',
                schedule_pattern: 'custom',
                schedule_details: {"days": ["Tuesday", "Thursday"], "time": "10:00 AM"},
                max_participants: 40,
                registration_opens: '2025-03-15',
                status: 'open'
            },
            {
                program_index: 3, // Watercolor
                session_name: 'Watercolor Workshop - July Session',
                session_code: 'WATER-JUL-2025',
                start_date: '2025-07-07',
                end_date: '2025-07-28',
                schedule_pattern: 'custom',
                schedule_details: {"days": ["Monday", "Wednesday"], "time": "2:00 PM"},
                max_participants: 15,
                registration_opens: '2025-06-01',
                status: 'open'
            },
            {
                program_index: 4, // Tot Lot
                session_name: 'Tot Lot Summer Fun 2025',
                session_code: 'TOTS-2025',
                start_date: '2025-06-23',
                end_date: '2025-08-15',
                schedule_pattern: 'weekdays',
                max_participants: 20,
                registration_opens: '2025-04-01',
                early_bird_deadline: '2025-05-01',
                early_bird_discount: 50.00,
                status: 'full'
            }
        ];

        const createdSessions = [];
        for (const session of sessions) {
            const program = createdPrograms[session.program_index];
            
            const result = await manager.pgClient.query(`
                INSERT INTO events.program_sessions (
                    program_id, session_name, session_code, start_date, end_date,
                    schedule_pattern, schedule_details, facility_id, max_participants,
                    session_member_fee, session_non_member_fee,
                    registration_opens, registration_closes, early_bird_deadline,
                    early_bird_discount, status
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
                ) RETURNING *
            `, [
                program.id, session.session_name, session.session_code, session.start_date,
                session.end_date, session.schedule_pattern, 
                JSON.stringify(session.schedule_details || {}), program.default_facility_id,
                session.max_participants || program.max_participants,
                program.member_fee, program.non_member_fee, session.registration_opens,
                session.registration_closes || null, session.early_bird_deadline || null,
                session.early_bird_discount || 0, session.status
            ]);
            
            createdSessions.push(result.rows[0]);
            console.log(`   ✅ Created session: ${session.session_name}`);
        }

        // =====================================================
        // 4. CREATE PROGRAM REGISTRATIONS
        // =====================================================
        
        console.log('\\n4. Creating Program Registrations');

        // Register some people for programs
        const registrations = [
            // Tennis registrations
            {
                session_index: 0,
                person_index: 4,
                is_member: true,
                payment_status: 'paid'
            },
            {
                session_index: 0,
                person_index: 5,
                is_member: false,
                payment_status: 'pending'
            },
            // Yoga registrations
            {
                session_index: 1,
                person_index: 0,
                is_member: true,
                payment_status: 'paid'
            },
            {
                session_index: 1,
                person_index: 1,
                is_member: true,
                payment_status: 'paid'
            },
            {
                session_index: 1,
                person_index: 2,
                is_member: true,
                payment_status: 'paid'
            },
            // Youth Choir
            {
                session_index: 2,
                person_index: 6,
                is_member: true,
                payment_status: 'paid'
            },
            // Tot Lot (full program)
            {
                session_index: 4,
                person_index: 7,
                is_member: true,
                payment_status: 'paid',
                registration_type: 'wait_list' // Program is full
            }
        ];

        for (const reg of registrations) {
            const session = createdSessions[reg.session_index];
            const person = persons.rows[reg.person_index] || persons.rows[0];
            const program = createdPrograms[reg.session_index];
            
            // Calculate fees (need to get from session, not program directly)
            const sessionData = await manager.pgClient.query(`
                SELECT ps.*, p.member_fee, p.non_member_fee, p.materials_fee 
                FROM events.program_sessions ps
                JOIN events.programs p ON ps.program_id = p.id
                WHERE ps.id = $1
            `, [session.id]);
            
            const programData = sessionData.rows[0];
            const baseFee = reg.is_member ? 
                parseFloat(programData.session_member_fee || programData.member_fee) : 
                parseFloat(programData.session_non_member_fee || programData.non_member_fee);
            const materialsFee = parseFloat(programData.materials_fee || 0);
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
                session.id, person.id, reg.registration_type || 'participant',
                reg.is_member, reg.is_member ? person.member_id : null,
                baseFee, materialsFee, totalFee, reg.payment_status,
                reg.payment_status === 'paid' ? '2025-05-15' : null,
                reg.registration_type === 'wait_list' ? 'registered' : 'registered',
                'Emergency Contact', '231-555-9999'
            ]);
            
            console.log(`   ✅ Registered ${person.first_name} ${person.last_name} for ${program.program_name}`);
        }

        // =====================================================
        // 5. CREATE FACILITY MAINTENANCE SCHEDULE
        // =====================================================
        
        console.log('\\n5. Creating Facility Maintenance Schedule');

        const maintenance = [
            {
                facility_code: 'HALL-AUD',
                maintenance_type: 'inspection',
                scheduled_date: '2025-06-01',
                description: 'Annual fire safety and electrical inspection',
                contractor_name: 'Northern Michigan Safety Services',
                estimated_cost: 500.00,
                facility_closed: false,
                partial_availability: 'Facility open except backstage areas'
            },
            {
                facility_code: 'TENNIS',
                maintenance_type: 'seasonal_prep',
                scheduled_date: '2025-05-15',
                description: 'Court resurfacing and net replacement',
                contractor_name: 'Great Lakes Tennis Courts',
                estimated_cost: 8500.00,
                facility_closed: true
            },
            {
                facility_code: 'CROUSE-CHAPEL',
                maintenance_type: 'routine',
                scheduled_date: '2025-09-15',
                description: 'Organ tuning and maintenance',
                contractor_name: 'Michigan Organ Works',
                estimated_cost: 1200.00,
                facility_closed: false,
                partial_availability: 'Chapel open, organ unavailable'
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
                        facility_closed, partial_availability, status
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled')
                `, [
                    facility.rows[0].id, maint.maintenance_type, maint.scheduled_date,
                    maint.description, maint.contractor_name, maint.estimated_cost,
                    maint.facility_closed, maint.partial_availability
                ]);
                
                console.log(`   ✅ Scheduled maintenance for ${maint.facility_code}: ${maint.description}`);
            }
        }

        // =====================================================
        // 6. GENERATE SUMMARY REPORT
        // =====================================================
        
        console.log('\\n📊 Bay View Events and Programs Summary:');
        
        // Facility usage stats
        const facilityStats = await manager.pgClient.query(`
            SELECT 
                COUNT(DISTINCT f.id) as total_facilities,
                COUNT(DISTINCT b.id) as total_bookings,
                COUNT(DISTINCT CASE WHEN b.event_date >= CURRENT_DATE THEN b.id END) as upcoming_bookings,
                SUM(b.rental_fee + b.cleaning_fee + b.equipment_fee) as total_revenue
            FROM events.facilities f
            LEFT JOIN events.bookings b ON f.id = b.facility_id
        `);

        // Program stats
        const programStats = await manager.pgClient.query(`
            SELECT 
                COUNT(DISTINCT p.id) as total_programs,
                COUNT(DISTINCT ps.id) as active_sessions,
                COUNT(DISTINCT r.id) as total_registrations,
                SUM(r.total_fee) as registration_revenue,
                COUNT(DISTINCT CASE WHEN p.bay_view_tradition THEN p.id END) as traditional_programs
            FROM events.programs p
            LEFT JOIN events.program_sessions ps ON p.id = ps.program_id
            LEFT JOIN events.registrations r ON ps.id = r.program_session_id
        `);

        // Popular programs
        const popularPrograms = await manager.pgClient.query(`
            SELECT 
                p.program_name,
                ps.session_name,
                COUNT(r.id) as registrations,
                ps.max_participants,
                ps.status
            FROM events.programs p
            JOIN events.program_sessions ps ON p.id = ps.program_id
            LEFT JOIN events.registrations r ON ps.id = r.program_session_id
            GROUP BY p.id, p.program_name, ps.id, ps.session_name, ps.max_participants, ps.status
            ORDER BY COUNT(r.id) DESC
            LIMIT 5
        `);

        const fStats = facilityStats.rows[0];
        const pStats = programStats.rows[0];

        console.log('\\nFacility Overview:');
        console.log(`  Total Facilities: ${fStats.total_facilities}`);
        console.log(`  Total Bookings: ${fStats.total_bookings}`);
        console.log(`  Upcoming Events: ${fStats.upcoming_bookings}`);
        console.log(`  Booking Revenue: $${parseFloat(fStats.total_revenue || 0).toLocaleString()}`);

        console.log('\\nProgram Overview:');
        console.log(`  Total Programs: ${pStats.total_programs}`);
        console.log(`  Active Sessions: ${pStats.active_sessions}`);
        console.log(`  Total Registrations: ${pStats.total_registrations}`);
        console.log(`  Registration Revenue: $${parseFloat(pStats.registration_revenue || 0).toLocaleString()}`);
        console.log(`  Traditional Programs: ${pStats.traditional_programs}`);

        console.log('\\nPopular Programs:');
        popularPrograms.rows.forEach(prog => {
            const capacity = prog.max_participants ? 
                `${prog.registrations}/${prog.max_participants}` : 
                `${prog.registrations}`;
            console.log(`  ${prog.program_name}: ${capacity} registrations (${prog.status})`);
        });

        // Upcoming events
        console.log('\\n📅 Upcoming Events:');
        const upcomingEvents = await manager.pgClient.query(`
            SELECT 
                f.facility_name,
                b.event_name,
                b.event_date,
                b.start_time,
                b.expected_attendance
            FROM events.bookings b
            JOIN events.facilities f ON b.facility_id = f.id
            WHERE b.event_date >= CURRENT_DATE
              AND b.status = 'confirmed'
            ORDER BY b.event_date, b.start_time
            LIMIT 5
        `);

        upcomingEvents.rows.forEach(event => {
            const date = new Date(event.event_date).toLocaleDateString();
            console.log(`  ${date} - ${event.event_name} at ${event.facility_name}`);
        });

        console.log('\\n🎉 Bay View Events and Programs data created successfully!');
        console.log('\\nThis demonstrates:');
        console.log('• Full facility management with 10 Bay View venues');
        console.log('• Event bookings including chapel integration');
        console.log('• Traditional Bay View programs (Tennis, Choir, Tot Lot)');
        console.log('• Summer 2025 program sessions with registrations');
        console.log('• Facility maintenance scheduling');
        console.log('• Member vs non-member pricing');
        console.log('• Wait list management for full programs');

    } catch (error) {
        console.error('Bay View events data creation failed:', error.message);
        console.error(error.stack);
    } finally {
        await manager.disconnect();
    }
}

createBayViewEventsData();