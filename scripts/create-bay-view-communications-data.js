/**
 * Create Bay View Association Communications Sample Data
 * Demonstrates notifications, announcements, and member directory
 */
import dotenv from 'dotenv';
import { createDualWriteManager } from '../lib/database/dual-write-manager.js';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function createBayViewCommunicationsData() {
    const DATABASE_URL = process.env.DATABASE_URL;
    
    if (!DATABASE_URL) {
        console.error('DATABASE_URL not found in environment variables');
        process.exit(1);
    }

    const manager = createDualWriteManager(DATABASE_URL);

    try {
        await manager.connect();
        console.log('📢 Creating Bay View Association Communications Data\\n');

        // Get existing persons for relationships
        const persons = await manager.pgClient.query(`
            SELECT p.*, m.id as member_id, m.member_number
            FROM core.persons p
            LEFT JOIN core.members m ON p.id = m.person_id
            ORDER BY p.id
            LIMIT 20
        `);

        if (persons.rows.length === 0) {
            console.error('No persons found. Please run sample data creation first.');
            return;
        }

        // =====================================================
        // 1. CREATE COMMUNICATION PREFERENCES
        // =====================================================
        
        console.log('1. Setting Communication Preferences for Members');

        // Check if preferences already exist (trigger should create them)
        const prefsCheck = await manager.pgClient.query(
            'SELECT COUNT(*) as count FROM communications.preferences'
        );

        console.log(`   Found ${prefsCheck.rows[0].count} existing preferences`);

        // Update some preferences with specific settings
        const preferenceUpdates = [
            {
                person_index: 0,
                email_frequency: 'immediate',
                cottage_notices: true,
                sms_enabled: true,
                sms_phone: '231-555-0001'
            },
            {
                person_index: 1,
                email_frequency: 'daily_digest',
                worship_updates: false,
                mail_enabled: false
            },
            {
                person_index: 2,
                email_frequency: 'weekly_digest',
                vacation_mode: true,
                vacation_start: '2025-07-15',
                vacation_end: '2025-07-30'
            }
        ];

        for (const pref of preferenceUpdates) {
            const person = persons.rows[pref.person_index];
            if (person) {
                await manager.pgClient.query(`
                    UPDATE communications.preferences
                    SET email_frequency = $2,
                        cottage_notices = $3,
                        worship_updates = $4,
                        sms_enabled = $5,
                        sms_phone = $6,
                        mail_enabled = $7,
                        vacation_mode = $8,
                        vacation_start = $9,
                        vacation_end = $10,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE person_id = $1
                `, [
                    person.id,
                    pref.email_frequency,
                    pref.cottage_notices !== undefined ? pref.cottage_notices : true,
                    pref.worship_updates !== undefined ? pref.worship_updates : true,
                    pref.sms_enabled || false,
                    pref.sms_phone || null,
                    pref.mail_enabled !== undefined ? pref.mail_enabled : true,
                    pref.vacation_mode || false,
                    pref.vacation_start || null,
                    pref.vacation_end || null
                ]);
                
                console.log(`   ✅ Updated preferences for ${person.first_name} ${person.last_name}`);
            }
        }

        // =====================================================
        // 2. CREATE DIRECTORY SETTINGS
        // =====================================================
        
        console.log('\\n2. Configuring Member Directory Settings');

        const directorySettings = [
            {
                person_index: 0,
                preferred_name: 'Bill Taylor',
                professional_title: 'Retired Professor',
                bio: 'Long-time Bay View member and cottage owner. Former chair of Buildings & Grounds.',
                interests: 'Sailing, woodworking, Bay View history',
                show_cottage_address: true
            },
            {
                person_index: 1,
                preferred_name: 'Margaret Williams',
                professional_title: 'Artist',
                bio: 'Watercolor artist specializing in Bay View scenes. Member since 1955.',
                interests: 'Art, gardening, choir',
                show_email: false
            },
            {
                person_index: 2,
                preferred_name: 'Dr. John Hartford',
                professional_title: 'Physician',
                bio: 'Family medicine physician. New cottage owner as of 2010.',
                interests: 'Tennis, sailing, classical music',
                show_phone: false
            }
        ];

        for (const setting of directorySettings) {
            const person = persons.rows[setting.person_index];
            if (person) {
                await manager.pgClient.query(`
                    UPDATE communications.directory_settings
                    SET preferred_name = $2,
                        professional_title = $3,
                        bio = $4,
                        interests = $5,
                        show_cottage_address = $6,
                        show_email = $7,
                        show_phone = $8,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE person_id = $1
                `, [
                    person.id,
                    setting.preferred_name,
                    setting.professional_title,
                    setting.bio,
                    setting.interests,
                    setting.show_cottage_address !== undefined ? setting.show_cottage_address : true,
                    setting.show_email !== undefined ? setting.show_email : true,
                    setting.show_phone !== undefined ? setting.show_phone : true
                ]);
                
                console.log(`   ✅ Updated directory for ${setting.preferred_name}`);
            }
        }

        // =====================================================
        // 3. CREATE ANNOUNCEMENTS
        // =====================================================
        
        console.log('\\n3. Creating Bay View Announcements');

        const announcements = [
            {
                title: 'Bay View 2025 Season Opening',
                summary: 'Join us for the official opening of the 2025 Bay View season with special events throughout opening weekend.',
                content: `The Bay View Association is pleased to announce the opening of our 2025 season!

Opening Weekend Schedule:
- Friday, June 20: Board Reception at Campus Club (6:00 PM)
- Saturday, June 21: Cottage Tours (10:00 AM - 2:00 PM)
- Sunday, June 22: Opening Worship Service at Crouse Chapel (10:45 AM)
- Sunday, June 22: Community Picnic at Waterfront Park (12:30 PM)

All members and their guests are welcome to attend these events. We look forward to another wonderful summer at Bay View!`,
                announcement_type: 'seasonal',
                priority: 10,
                publish_date: '2025-06-01',
                expiration_date: '2025-06-23',
                audience: 'all',
                author_name: 'Bay View Board of Trustees',
                status: 'published'
            },
            {
                title: 'Cottage Maintenance Reminder',
                summary: 'Annual cottage inspections will begin July 1. Please ensure your cottage is ready.',
                content: `Dear Cottage Leaseholders,

Annual cottage inspections will begin July 1, 2025. Please ensure your cottage meets all Bay View standards:

- Exterior paint and trim in good condition
- Gutters clean and functional
- Steps and railings secure
- Fire extinguishers current
- Smoke detectors operational

Inspection schedules will be sent to individual cottages by June 15. If you need to schedule repairs, our approved contractor list is available at the Bay View office.

Thank you for maintaining the beauty and safety of our historic community.`,
                announcement_type: 'maintenance',
                priority: 7,
                publish_date: '2025-05-15',
                expiration_date: '2025-07-31',
                audience: 'cottage_owners',
                author_name: 'Buildings and Grounds Committee',
                author_title: 'Committee Chair',
                status: 'published'
            },
            {
                title: 'Youth Choir Registration Open',
                summary: 'Register now for the 2025 Bay View Youth Choir. Limited spaces available!',
                content: `The Bay View Youth Choir is now accepting registrations for the 2025 season!

This 75-year tradition continues to inspire young musicians ages 10-18. The choir performs at Sunday worship services and special concerts throughout the summer.

Details:
- Ages: 10-18
- Rehearsals: Tuesdays & Thursdays, 10:00 AM
- Season: June 22 - August 31
- Fee: $50 (members), $100 (non-members)
- Director: Sarah Morrison

Register online at bayviewassociation.org/youth-choir or at the Bay View office.

Spaces are limited - register today!`,
                announcement_type: 'event',
                priority: 8,
                publish_date: '2025-03-15',
                expiration_date: '2025-06-22',
                audience: 'all',
                author_name: 'Music Department',
                status: 'published'
            },
            {
                title: 'Memorial Garden Dedication Ceremony',
                summary: 'Annual dedication ceremony for new memorial placements will be held July 28.',
                content: `The annual Bay View Memorial Garden Dedication Ceremony will be held Sunday, July 28, 2025, at 2:00 PM.

This sacred service honors those whose ashes have been placed in the Memorial Garden during the past year. Family members and friends are invited to attend this meaningful ceremony.

The service will include:
- Opening prayer and scripture
- Reading of names
- Musical selections by the Bay View Choir
- Individual rose placement
- Closing benediction

A reception will follow in Evelyn Hall. Please RSVP to the Bay View office if you plan to attend.`,
                announcement_type: 'memorial',
                priority: 6,
                publish_date: '2025-07-01',
                expiration_date: '2025-07-29',
                audience: 'all',
                author_name: 'Rev. Dr. James Patterson',
                author_title: 'Director of Worship',
                status: 'published'
            },
            {
                title: 'Board of Trustees Election Notice',
                summary: 'Nominations for the 2026 Board of Trustees are now being accepted.',
                content: `The Bay View Association Nominating Committee is accepting nominations for the 2026 Board of Trustees.

Three positions will be filled in this year's election:
- 2 Member-at-Large positions (3-year terms)
- 1 Treasurer position (3-year term)

Eligibility Requirements:
- Active Bay View member in good standing
- Demonstrated commitment to Bay View's mission
- Ability to attend monthly board meetings

Nomination forms are available at bayviewassociation.org/elections or at the Bay View office. All nominations must be received by August 1, 2025.

Elections will be held at the Annual Meeting on August 20, 2025.`,
                announcement_type: 'board',
                priority: 9,
                publish_date: '2025-07-01',
                expiration_date: '2025-08-01',
                audience: 'members_only',
                author_name: 'Nominating Committee',
                status: 'published'
            }
        ];

        for (const announcement of announcements) {
            await manager.pgClient.query(`
                INSERT INTO communications.announcements (
                    title, summary, content, announcement_type, priority,
                    publish_date, expiration_date, audience,
                    author_name, author_title, status,
                    approved_by, approval_date
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
                )
            `, [
                announcement.title, announcement.summary, announcement.content,
                announcement.announcement_type, announcement.priority,
                announcement.publish_date, announcement.expiration_date,
                announcement.audience, announcement.author_name,
                announcement.author_title || null, announcement.status,
                1, // Approved by system
                '2025-03-01'
            ]);
            
            console.log(`   ✅ Created announcement: ${announcement.title}`);
        }

        // =====================================================
        // 4. QUEUE NOTIFICATIONS
        // =====================================================
        
        console.log('\\n4. Queueing Notifications');

        // Get upcoming events and programs
        const upcomingEvents = await manager.pgClient.query(`
            SELECT b.*, f.facility_name 
            FROM events.bookings b
            JOIN events.facilities f ON b.facility_id = f.id
            WHERE b.event_date >= CURRENT_DATE
              AND b.status = 'confirmed'
            LIMIT 3
        `);

        const programRegistrations = await manager.pgClient.query(`
            SELECT r.*, ps.session_name, p.first_name, p.last_name, p.primary_email
            FROM events.registrations r
            JOIN events.program_sessions ps ON r.program_session_id = ps.id
            JOIN core.persons p ON r.person_id = p.id
            WHERE r.status = 'registered'
            LIMIT 3
        `);

        // Queue event reminders
        for (const event of upcomingEvents.rows) {
            if (event.organizer_person_id) {
                const notificationId = await manager.pgClient.query(`
                    SELECT communications.queue_notification(
                        $1, 'email', $2, $3, 'events', 'normal', 
                        (SELECT id FROM communications.email_templates WHERE template_code = 'event_booking_confirmed'),
                        $4
                    )
                `, [
                    event.organizer_person_id,
                    `Reminder: ${event.event_name}`,
                    `Your event "${event.event_name}" is scheduled for ${event.event_date} at ${event.facility_name}.`,
                    JSON.stringify({
                        event_name: event.event_name,
                        event_date: event.event_date,
                        start_time: event.start_time,
                        end_time: event.end_time,
                        facility_name: event.facility_name,
                        organizer_name: event.organizer_name
                    })
                ]);
                
                console.log(`   ✅ Queued event reminder for ${event.event_name}`);
            }
        }

        // Queue program confirmations
        for (const reg of programRegistrations.rows) {
            const notificationId = await manager.pgClient.query(`
                SELECT communications.queue_notification(
                    $1, 'email', $2, $3, 'programs', 'normal'
                )
            `, [
                reg.person_id,
                `Registration Confirmation: ${reg.session_name}`,
                `Thank you for registering for ${reg.session_name}. Your registration is confirmed.`
            ]);
            
            console.log(`   ✅ Queued registration confirmation for ${reg.first_name} ${reg.last_name}`);
        }

        // Queue cottage assessment notices
        const cottageAssessments = await manager.pgClient.query(`
            SELECT 
                a.*, 
                l.block_number, 
                l.lot_number,
                lh.person_id,
                p.first_name || ' ' || p.last_name as leaseholder_name
            FROM property.assessments a
            JOIN property.locations l ON a.property_id = l.id
            JOIN property.leaseholds lh ON l.id = lh.property_id AND lh.is_primary_leaseholder = true
            JOIN core.persons p ON lh.person_id = p.id
            WHERE a.assessment_year = 2025
              AND a.assessment_type = 'annual_lease_fee'
            LIMIT 3
        `);

        for (const assessment of cottageAssessments.rows) {
            const notificationId = await manager.pgClient.query(`
                SELECT communications.queue_notification(
                    $1, 'email', $2, $3, 'financial', 'normal',
                    (SELECT id FROM communications.email_templates WHERE template_code = 'cottage_assessment'),
                    $4
                )
            `, [
                assessment.person_id,
                `2025 Cottage Assessment - Block ${assessment.block_number} Lot ${assessment.lot_number}`,
                `Your annual cottage lease fee of $${assessment.base_amount} is due ${assessment.due_date}.`,
                JSON.stringify({
                    leaseholder_name: assessment.leaseholder_name,
                    year: '2025',
                    block_number: assessment.block_number,
                    lot_number: assessment.lot_number,
                    lease_fee: assessment.base_amount,
                    due_date: assessment.due_date
                })
            ]);
            
            console.log(`   ✅ Queued assessment notice for Block ${assessment.block_number} Lot ${assessment.lot_number}`);
        }

        // =====================================================
        // 5. GENERATE SUMMARY REPORT
        // =====================================================
        
        console.log('\\n📊 Bay View Communications Summary:');
        
        // Communication stats
        const commStats = await manager.pgClient.query(`
            SELECT 
                (SELECT COUNT(*) FROM communications.preferences) as total_preferences,
                (SELECT COUNT(*) FROM communications.preferences WHERE vacation_mode = true) as on_vacation,
                (SELECT COUNT(*) FROM communications.preferences WHERE email_frequency = 'immediate') as immediate_email,
                (SELECT COUNT(*) FROM communications.preferences WHERE sms_enabled = true) as sms_enabled
        `);

        // Directory stats
        const dirStats = await manager.pgClient.query(`
            SELECT 
                COUNT(*) as total_in_directory,
                COUNT(CASE WHEN bio IS NOT NULL THEN 1 END) as with_bio,
                COUNT(CASE WHEN show_cottage_address = true THEN 1 END) as showing_cottage
            FROM communications.directory_settings
            WHERE show_in_directory = true
        `);

        // Announcement stats
        const announceStats = await manager.pgClient.query(`
            SELECT 
                announcement_type,
                COUNT(*) as count
            FROM communications.announcements
            WHERE status = 'published'
              AND publish_date <= CURRENT_DATE
              AND (expiration_date IS NULL OR expiration_date >= CURRENT_DATE)
            GROUP BY announcement_type
            ORDER BY count DESC
        `);

        // Notification stats
        const notifStats = await manager.pgClient.query(`
            SELECT 
                category,
                COUNT(*) as count,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent
            FROM communications.notifications
            GROUP BY category
            ORDER BY count DESC
        `);

        const cStats = commStats.rows[0];
        const dStats = dirStats.rows[0];

        console.log('\\nCommunication Preferences:');
        console.log(`  Total Members with Preferences: ${cStats.total_preferences}`);
        console.log(`  On Vacation Mode: ${cStats.on_vacation}`);
        console.log(`  Immediate Email: ${cStats.immediate_email}`);
        console.log(`  SMS Enabled: ${cStats.sms_enabled}`);

        console.log('\\nMember Directory:');
        console.log(`  Listed in Directory: ${dStats.total_in_directory}`);
        console.log(`  With Bio: ${dStats.with_bio}`);
        console.log(`  Showing Cottage Address: ${dStats.showing_cottage}`);

        console.log('\\nActive Announcements by Type:');
        announceStats.rows.forEach(stat => {
            console.log(`  ${stat.announcement_type}: ${stat.count}`);
        });

        console.log('\\nNotifications by Category:');
        notifStats.rows.forEach(stat => {
            console.log(`  ${stat.category}: ${stat.count} total (${stat.pending} pending, ${stat.sent} sent)`);
        });

        // Show member directory sample
        console.log('\\n👥 Sample Member Directory:');
        const directory = await manager.pgClient.query(`
            SELECT * FROM communications.member_directory
            LIMIT 5
        `);

        directory.rows.forEach(member => {
            console.log(`  ${member.display_name}${member.professional_title ? ' - ' + member.professional_title : ''}`);
            if (member.cottage_address) {
                console.log(`    ${member.cottage_address}`);
            }
        });

        console.log('\\n🎉 Bay View Communications data created successfully!');
        console.log('\\nThis demonstrates:');
        console.log('• Communication preferences with vacation mode');
        console.log('• Member directory with privacy settings');
        console.log('• 5 types of announcements (seasonal, maintenance, events, memorial, board)');
        console.log('• Email notifications for events, programs, and assessments');
        console.log('• Template-based email system');
        console.log('• Full-text search on announcements');

    } catch (error) {
        console.error('Bay View communications data creation failed:', error.message);
        console.error(error.stack);
    } finally {
        await manager.disconnect();
    }
}

createBayViewCommunicationsData();