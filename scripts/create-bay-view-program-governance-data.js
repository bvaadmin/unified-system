/**
 * Create Bay View Program Governance Data
 * Demonstrates program directors, committees, and summer events with payment integration
 */
import dotenv from 'dotenv';
import { createDualWriteManager } from '../lib/database/dual-write-manager.js';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function createProgramGovernanceData() {
    const DATABASE_URL = process.env.DATABASE_URL;
    
    if (!DATABASE_URL) {
        console.error('DATABASE_URL not found in environment variables');
        process.exit(1);
    }

    const manager = createDualWriteManager(DATABASE_URL);

    try {
        await manager.connect();
        console.log('🎭 Creating Bay View Program Governance Data\\n');

        // Get existing persons to assign as directors
        const persons = await manager.pgClient.query(`
            SELECT p.*, m.id as member_id, m.member_number
            FROM core.persons p
            LEFT JOIN core.members m ON p.id = m.person_id
            WHERE m.id IS NOT NULL
            ORDER BY p.id
            LIMIT 20
        `);

        if (persons.rows.length < 10) {
            console.error('Not enough members found. Please run member creation first.');
            return;
        }

        // =====================================================
        // 1. ASSIGN PROGRAM DIRECTORS
        // =====================================================
        
        console.log('1. Assigning Program Directors');

        const directorAssignments = [
            {
                area_code: 'WORSHIP',
                director_index: 3,
                director_title: 'Director of Worship',
                director_email: 'worship@bayviewassociation.org',
                annual_budget: 125000.00
            },
            {
                area_code: 'EDUCATION',
                director_index: 4,
                director_title: 'Education Program Director',
                director_email: 'education@bayviewassociation.org',
                annual_budget: 85000.00
            },
            {
                area_code: 'RECREATION',
                director_index: 5,
                director_title: 'Recreation Director',
                director_email: 'recreation@bayviewassociation.org',
                annual_budget: 95000.00
            },
            {
                area_code: 'MUSIC',
                director_index: 6,
                director_title: 'Music Festival Director',
                director_email: 'music@bayviewassociation.org',
                annual_budget: 180000.00
            },
            {
                area_code: 'YOUTH',
                director_index: 7,
                director_title: 'Youth Program Director',
                director_email: 'youth@bayviewassociation.org',
                annual_budget: 65000.00
            }
        ];

        for (const assignment of directorAssignments) {
            const director = persons.rows[assignment.director_index];
            if (director) {
                await manager.pgClient.query(`
                    UPDATE events.program_areas
                    SET current_director_id = $2,
                        director_title = $3,
                        director_start_date = '2025-01-01',
                        director_email = $4,
                        director_phone = $5,
                        annual_budget = $6,
                        budget_year = 2025,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE area_code = $1
                `, [
                    assignment.area_code,
                    director.id,
                    assignment.director_title,
                    assignment.director_email,
                    director.primary_phone,
                    assignment.annual_budget
                ]);
                
                // Add to director history
                await manager.pgClient.query(`
                    INSERT INTO events.program_director_history (
                        program_area_id, director_person_id, start_date, title
                    ) VALUES (
                        (SELECT id FROM events.program_areas WHERE area_code = $1),
                        $2, '2025-01-01', $3
                    )
                `, [assignment.area_code, director.id, assignment.director_title]);
                
                console.log(`   ✅ Assigned ${director.first_name} ${director.last_name} as ${assignment.director_title}`);
            }
        }

        // =====================================================
        // 2. CREATE PROGRAM-SPECIFIC COMMITTEES
        // =====================================================
        
        console.log('\\n2. Creating Program Committees with Members');

        // Add oversight responsibilities to committees
        const committeeUpdates = [
            {
                committee_name: 'Worship Committee',
                area_code: 'WORSHIP',
                responsibilities: 'Oversee worship services, select preachers, approve special services, guide spiritual programming'
            },
            {
                committee_name: 'Recreation Committee', 
                area_code: 'RECREATION',
                responsibilities: 'Develop recreation programs, maintain facilities, approve new activities, set participation policies'
            },
            {
                committee_name: 'Education Committee',
                area_code: 'EDUCATION',
                responsibilities: 'Plan educational programs, select speakers, oversee youth education, approve curriculum'
            },
            {
                committee_name: 'Music Committee',
                area_code: 'MUSIC',
                responsibilities: 'Plan Bay View Music Festival, select performers, oversee music education, manage concert series'
            }
        ];

        // Check if Education Committee exists
        let eduCommittee = await manager.pgClient.query(
            "SELECT id FROM core.committees WHERE committee_name = 'Education Committee'"
        );
        
        if (eduCommittee.rows.length === 0) {
            eduCommittee = await manager.pgClient.query(`
                INSERT INTO core.committees (committee_name, committee_type, description, is_active)
                VALUES ('Education Committee', 'standing', 'Oversees educational programs and lectures', TRUE)
                RETURNING id
            `);
        }

        // Check if Music Committee exists
        let musicCommittee = await manager.pgClient.query(
            "SELECT id FROM core.committees WHERE committee_name = 'Music Committee'"
        );
        
        if (musicCommittee.rows.length === 0) {
            musicCommittee = await manager.pgClient.query(`
                INSERT INTO core.committees (committee_name, committee_type, description, is_active)
                VALUES ('Music Committee', 'standing', 'Oversees Bay View Music Festival and music programs', TRUE)
                RETURNING id
            `);
        }

        for (const update of committeeUpdates) {
            await manager.pgClient.query(`
                UPDATE core.committees c
                SET program_area_id = pa.id,
                    oversight_responsibilities = $2,
                    chair_person_id = $3,
                    updated_at = CURRENT_TIMESTAMP
                FROM events.program_areas pa
                WHERE c.committee_name = $1
                  AND pa.area_code = $4
            `, [
                update.committee_name,
                update.responsibilities,
                persons.rows[Math.floor(Math.random() * 10)].id, // Random chair
                update.area_code
            ]);
            
            console.log(`   ✅ Updated ${update.committee_name} with program oversight`);
        }

        // =====================================================
        // 3. CREATE SUMMER 2025 EVENTS FROM PROGRAM CHUNKS
        // =====================================================
        
        console.log('\\n3. Creating Summer 2025 Events');

        // Based on the summer program chunks structure
        const summerEvents = [
            // WORSHIP EVENTS
            {
                facility_code: 'CROUSE-CHAPEL',
                event_name: 'Sunday Worship Service - Rev. Dr. James Patterson',
                event_type: 'worship',
                event_date: '2025-06-29',
                start_time: '10:45',
                end_time: '12:00',
                expected_attendance: 250,
                program_area: 'WORSHIP',
                requires_payment: false
            },
            {
                facility_code: 'CROUSE-CHAPEL',
                event_name: 'Vespers Service',
                event_type: 'worship',
                event_date: '2025-06-29',
                start_time: '20:00',
                end_time: '21:00',
                expected_attendance: 150,
                program_area: 'WORSHIP',
                requires_payment: false
            },
            // EDUCATION EVENTS
            {
                facility_code: 'HALL-AUD',
                event_name: 'Bay View Forum: Climate Change and the Great Lakes',
                event_type: 'lecture',
                event_date: '2025-07-08',
                start_time: '10:00',
                end_time: '11:30',
                expected_attendance: 400,
                program_area: 'EDUCATION',
                requires_payment: true,
                member_price: 15.00,
                non_member_price: 25.00
            },
            {
                facility_code: 'VOORHIES-A',
                event_name: 'Writing Workshop: Memoir Writing',
                event_type: 'class',
                event_date: '2025-07-10',
                start_time: '14:00',
                end_time: '16:00',
                expected_attendance: 20,
                program_area: 'EDUCATION',
                requires_payment: true,
                member_price: 50.00,
                non_member_price: 75.00
            },
            // RECREATION EVENTS
            {
                facility_code: 'TENNIS',
                event_name: 'Bay View Tennis Tournament - Mixed Doubles',
                event_type: 'recreation',
                event_date: '2025-07-19',
                start_time: '09:00',
                end_time: '17:00',
                expected_attendance: 32,
                program_area: 'RECREATION',
                requires_payment: true,
                member_price: 25.00,
                non_member_price: 40.00
            },
            {
                facility_code: 'BEACH',
                event_name: 'Beach Volleyball Tournament',
                event_type: 'recreation',
                event_date: '2025-07-26',
                start_time: '10:00',
                end_time: '14:00',
                expected_attendance: 48,
                program_area: 'RECREATION',
                requires_payment: true,
                member_price: 10.00,
                non_member_price: 15.00
            },
            // MUSIC EVENTS
            {
                facility_code: 'HALL-AUD',
                event_name: 'Bay View Music Festival: Opening Gala Concert',
                event_type: 'concert',
                event_date: '2025-07-12',
                start_time: '20:00',
                end_time: '22:00',
                expected_attendance: 1200,
                program_area: 'MUSIC',
                requires_payment: true,
                member_price: 35.00,
                non_member_price: 50.00
            },
            {
                facility_code: 'HALL-AUD',
                event_name: 'Rising Stars Concert Series',
                event_type: 'concert',
                event_date: '2025-07-16',
                start_time: '19:30',
                end_time: '21:00',
                expected_attendance: 800,
                program_area: 'MUSIC',
                requires_payment: true,
                member_price: 20.00,
                non_member_price: 30.00
            },
            // YOUTH EVENTS
            {
                facility_code: 'BEACH',
                event_name: 'Fawns Youth Beach Day',
                event_type: 'recreation',
                event_date: '2025-07-15',
                start_time: '10:00',
                end_time: '15:00',
                expected_attendance: 60,
                program_area: 'YOUTH',
                requires_payment: false
            },
            {
                facility_code: 'EVELYN-HALL',
                event_name: 'Youth Talent Show',
                event_type: 'community_event',
                event_date: '2025-08-01',
                start_time: '19:00',
                end_time: '21:00',
                expected_attendance: 150,
                program_area: 'YOUTH',
                requires_payment: false
            }
        ];

        for (const event of summerEvents) {
            // Get facility
            const facility = await manager.pgClient.query(
                'SELECT id FROM events.facilities WHERE facility_code = $1',
                [event.facility_code]
            );

            if (facility.rows.length === 0) {
                console.log(`   ⚠️  Facility ${event.facility_code} not found`);
                continue;
            }

            // Get program area
            const programArea = await manager.pgClient.query(
                'SELECT id, current_director_id FROM events.program_areas WHERE area_code = $1',
                [event.program_area]
            );

            if (programArea.rows.length === 0) {
                console.log(`   ⚠️  Program area ${event.program_area} not found`);
                continue;
            }

            // Create booking
            const booking = await manager.pgClient.query(`
                INSERT INTO events.bookings (
                    facility_id, event_name, event_type, organizer_person_id,
                    organizer_name, organizer_email, event_date, start_time, end_time,
                    expected_attendance, rental_fee, status, is_bay_view_event
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0.00, 'confirmed', true
                ) RETURNING id
            `, [
                facility.rows[0].id, event.event_name, event.event_type,
                programArea.rows[0].current_director_id,
                event.program_area + ' Department',
                event.program_area.toLowerCase() + '@bayviewassociation.org',
                event.event_date, event.start_time, event.end_time,
                event.expected_attendance
            ]);

            // Add pricing if required
            if (event.requires_payment) {
                await manager.pgClient.query(`
                    INSERT INTO events.event_pricing (
                        booking_id, member_price, non_member_price,
                        refund_policy, refund_deadline_days, is_active
                    ) VALUES ($1, $2, $3, 'standard', 7, true)
                `, [
                    booking.rows[0].id,
                    event.member_price,
                    event.non_member_price
                ]);
            }

            console.log(`   ✅ Created event: ${event.event_name}`);
        }

        // =====================================================
        // 4. CREATE SAMPLE PAYMENT TRANSACTIONS
        // =====================================================
        
        console.log('\\n4. Creating Sample Payment Transactions');

        // Get some registrations to add payments
        const registrations = await manager.pgClient.query(`
            SELECT r.*, p.first_name, p.last_name, a.id as account_id
            FROM events.registrations r
            JOIN core.persons p ON r.person_id = p.id
            LEFT JOIN finance.accounts a ON p.id = a.person_id
            WHERE r.payment_status = 'paid'
            LIMIT 5
        `);

        const stripeProvider = await manager.pgClient.query(
            "SELECT id FROM finance.payment_providers WHERE provider_name = 'stripe'"
        );

        for (const reg of registrations.rows) {
            // Create payment transaction
            await manager.pgClient.query(`
                INSERT INTO finance.payment_transactions (
                    account_id, registration_id, amount, payment_provider_id,
                    provider_transaction_id, transaction_type, status,
                    description, initiated_at, completed_at
                ) VALUES (
                    $1, $2, $3, $4, $5, 'charge', 'succeeded', $6,
                    CURRENT_TIMESTAMP - INTERVAL '30 days',
                    CURRENT_TIMESTAMP - INTERVAL '30 days' + INTERVAL '2 seconds'
                )
            `, [
                reg.account_id,
                reg.id,
                reg.total_fee,
                stripeProvider.rows[0].id,
                'ch_' + Math.random().toString(36).substring(2, 15), // Fake Stripe ID
                `Payment for registration by ${reg.first_name} ${reg.last_name}`
            ]);
            
            console.log(`   ✅ Created payment for ${reg.first_name} ${reg.last_name}: $${reg.total_fee}`);
        }

        // =====================================================
        // 5. CREATE PAYMENT METHODS FOR SOME MEMBERS
        // =====================================================
        
        console.log('\\n5. Creating Sample Payment Methods');

        const paymentMethods = [
            {
                person_index: 0,
                method_type: 'card',
                display_name: 'Visa ending in 4242',
                is_default: true,
                provider: 'stripe'
            },
            {
                person_index: 1,
                method_type: 'card',
                display_name: 'Mastercard ending in 5555',
                is_default: true,
                provider: 'stripe'
            },
            {
                person_index: 2,
                method_type: 'bank_account',
                display_name: 'Bank account ending in 1234',
                is_default: true,
                provider: 'stripe'
            }
        ];

        for (const method of paymentMethods) {
            const person = persons.rows[method.person_index];
            const provider = await manager.pgClient.query(
                "SELECT id FROM finance.payment_providers WHERE provider_name = $1",
                [method.provider]
            );

            if (person && provider.rows.length > 0) {
                await manager.pgClient.query(`
                    INSERT INTO finance.payment_methods (
                        person_id, payment_provider_id, method_type,
                        display_name, provider_method_id, is_default,
                        is_active, verified
                    ) VALUES ($1, $2, $3, $4, $5, $6, true, true)
                `, [
                    person.id,
                    provider.rows[0].id,
                    method.method_type,
                    method.display_name,
                    'pm_' + Math.random().toString(36).substring(2, 15),
                    method.is_default
                ]);
                
                console.log(`   ✅ Added payment method for ${person.first_name} ${person.last_name}`);
            }
        }

        // =====================================================
        // 6. GENERATE SUMMARY REPORT
        // =====================================================
        
        console.log('\\n📊 Bay View Program Governance Summary:');
        
        // Program governance stats
        const govStats = await manager.pgClient.query(`
            SELECT 
                COUNT(DISTINCT pa.id) as program_areas,
                COUNT(DISTINCT pa.id) FILTER (WHERE pa.current_director_id IS NOT NULL) as areas_with_directors,
                COUNT(DISTINCT c.id) FILTER (WHERE c.program_area_id IS NOT NULL) as committees_with_programs,
                SUM(pa.annual_budget) as total_budget
            FROM events.program_areas pa
            LEFT JOIN core.committees c ON pa.committee_id = c.id
        `);

        // Director overview
        const directors = await manager.pgClient.query(`
            SELECT * FROM events.program_governance_overview
            ORDER BY area_name
        `);

        // Payment stats
        const paymentStats = await manager.pgClient.query(`
            SELECT 
                COUNT(*) as total_transactions,
                SUM(amount) as total_processed,
                SUM(net_amount) as net_revenue,
                COUNT(DISTINCT account_id) as unique_payers
            FROM finance.payment_transactions
            WHERE status = 'succeeded'
        `);

        // Upcoming paid events
        const paidEvents = await manager.pgClient.query(`
            SELECT 
                b.event_name,
                b.event_date,
                b.expected_attendance,
                ep.member_price,
                ep.non_member_price,
                pa.area_name
            FROM events.bookings b
            JOIN events.event_pricing ep ON b.id = ep.booking_id
            LEFT JOIN events.program_areas pa ON b.organizer_person_id = pa.current_director_id
            WHERE b.event_date >= CURRENT_DATE
              AND b.status = 'confirmed'
              AND ep.is_active = TRUE
            ORDER BY b.event_date
            LIMIT 5
        `);

        const gStats = govStats.rows[0];
        const pStats = paymentStats.rows[0];

        console.log('\\nProgram Areas:');
        console.log(`  Total Areas: ${gStats.program_areas}`);
        console.log(`  Areas with Directors: ${gStats.areas_with_directors}`);
        console.log(`  Committees with Oversight: ${gStats.committees_with_programs}`);
        console.log(`  Total Annual Budget: $${parseFloat(gStats.total_budget || 0).toLocaleString()}`);

        console.log('\\nProgram Directors:');
        directors.rows.forEach(dir => {
            console.log(`  ${dir.area_name}: ${dir.current_director || 'TBD'} (${dir.director_title || 'Director'})`);
            if (dir.committee_name) {
                console.log(`    Committee: ${dir.committee_name}, Chair: ${dir.committee_chair || 'TBD'}`);
            }
        });

        console.log('\\nPayment Processing:');
        console.log(`  Total Transactions: ${pStats.total_transactions}`);
        console.log(`  Total Processed: $${parseFloat(pStats.total_processed || 0).toLocaleString()}`);
        console.log(`  Net Revenue: $${parseFloat(pStats.net_revenue || 0).toLocaleString()}`);
        console.log(`  Unique Payers: ${pStats.unique_payers}`);

        console.log('\\n💰 Upcoming Ticketed Events:');
        paidEvents.rows.forEach(event => {
            console.log(`  ${event.event_name}`);
            console.log(`    Date: ${new Date(event.event_date).toLocaleDateString()}`);
            console.log(`    Pricing: $${event.member_price} (members) / $${event.non_member_price} (non-members)`);
            console.log(`    Expected: ${event.expected_attendance} attendees`);
        });

        console.log('\\n🎉 Bay View Program Governance data created successfully!');
        console.log('\\nThis demonstrates:');
        console.log('• Program directors for all major areas');
        console.log('• Committee oversight structure');
        console.log('• Summer 2025 events from all program areas');
        console.log('• Payment integration with Stripe');
        console.log('• Event pricing tiers (member/non-member)');
        console.log('• Payment methods and transaction tracking');

    } catch (error) {
        console.error('Program governance data creation failed:', error.message);
        console.error(error.stack);
    } finally {
        await manager.disconnect();
    }
}

createProgramGovernanceData();