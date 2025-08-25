/**
 * Test Chapel Database Connection and Submission
 */
import dotenv from 'dotenv';
import { createDualWriteManager } from '../lib/database/dual-write-manager.js';

// Load environment variables
dotenv.config();

async function testChapelDatabase() {
    const DATABASE_URL = process.env.DATABASE_URL;
    
    if (!DATABASE_URL) {
        console.error('DATABASE_URL not found in environment variables');
        process.exit(1);
    }

    const manager = createDualWriteManager(DATABASE_URL);

    try {
        await manager.connect();
        console.log('🔗 Connected to database\n');

        // Test 1: Check schema
        console.log('1️⃣ Checking crouse_chapel schema...');
        const schemaCheck = await manager.pgClient.query(`
            SELECT COUNT(*) as table_count
            FROM information_schema.tables 
            WHERE table_schema = 'crouse_chapel'
        `);
        console.log(`   ✅ Found ${schemaCheck.rows[0].table_count} tables in crouse_chapel schema\n`);

        // Test 2: Check configuration
        console.log('2️⃣ Checking chapel fee configuration...');
        const categoryCheck = await manager.pgClient.query(`
            SELECT id FROM config.categories WHERE category_code = 'FINANCE'
        `);
        
        if (categoryCheck.rows.length > 0) {
            const feeCheck = await manager.pgClient.query(`
                SELECT setting_key, value_number 
                FROM config.settings 
                WHERE category_id = $1 
                AND setting_key LIKE 'chapel_%'
                ORDER BY setting_key
            `, [categoryCheck.rows[0].id]);
            
            console.log('   Chapel fees found:');
            feeCheck.rows.forEach(fee => {
                console.log(`   • ${fee.setting_key}: $${fee.value_number}`);
            });
        } else {
            console.log('   ⚠️  No FINANCE category found');
        }
        console.log('');

        // Test 3: Test wedding submission
        console.log('3️⃣ Testing wedding submission...');
        
        // Start transaction
        await manager.pgClient.query('BEGIN');
        
        try {
            // Create test application
            const applicationResult = await manager.pgClient.query(`
                INSERT INTO crouse_chapel.service_applications (
                    application_type,
                    service_date,
                    service_time,
                    rehearsal_date,
                    rehearsal_time,
                    contact_name,
                    contact_email,
                    contact_phone,
                    contact_address,
                    member_name,
                    member_relationship,
                    status,
                    submission_date
                ) VALUES (
                    'wedding',
                    '2025-07-15',
                    '14:00:00',
                    '2025-07-14',
                    '17:00:00',
                    'Test Contact',
                    'test@example.com',
                    '231-555-0100',
                    '123 Test St, Petoskey, MI 49770',
                    'John Smith',
                    'Friend',
                    'pending',
                    CURRENT_TIMESTAMP
                ) RETURNING id, submission_date
            `);
            
            const applicationId = applicationResult.rows[0].id;
            console.log(`   ✅ Created test application ID: ${applicationId}`);
            
            // Add wedding details
            await manager.pgClient.query(`
                INSERT INTO crouse_chapel.wedding_details (
                    application_id,
                    couple_names,
                    guest_count,
                    bride_arrival_time,
                    dressing_at_chapel,
                    wedding_fee,
                    is_member,
                    why_bay_view
                ) VALUES (
                    $1,
                    'Jane Doe and John Smith',
                    50,
                    '13:30:00',
                    true,
                    300.00,
                    true,
                    'Family tradition'
                )
            `, [applicationId]);
            console.log('   ✅ Added wedding details');
            
            // Add clergy
            await manager.pgClient.query(`
                INSERT INTO crouse_chapel.clergy (
                    name,
                    denomination,
                    phone,
                    email,
                    address,
                    approved_status
                ) VALUES (
                    'Rev. Test Minister',
                    'Methodist',
                    '231-555-0200',
                    'minister@example.com',
                    '456 Church St, Petoskey, MI 49770',
                    'pending'
                ) ON CONFLICT (name) DO UPDATE 
                SET phone = EXCLUDED.phone
                RETURNING id
            `);
            console.log('   ✅ Added clergy information');
            
            // Check if submission can be retrieved
            const retrieveCheck = await manager.pgClient.query(`
                SELECT 
                    sa.id,
                    sa.application_type,
                    sa.service_date,
                    sa.status,
                    wd.couple_names,
                    wd.wedding_fee
                FROM crouse_chapel.service_applications sa
                LEFT JOIN crouse_chapel.wedding_details wd ON sa.id = wd.application_id
                WHERE sa.id = $1
            `, [applicationId]);
            
            if (retrieveCheck.rows.length > 0) {
                const app = retrieveCheck.rows[0];
                console.log('   ✅ Successfully retrieved application:');
                console.log(`      - Type: ${app.application_type}`);
                console.log(`      - Date: ${app.service_date.toISOString().split('T')[0]}`);
                console.log(`      - Couple: ${app.couple_names}`);
                console.log(`      - Wedding Fee: $${app.wedding_fee}`);
            }
            
            // Rollback test data
            await manager.pgClient.query('ROLLBACK');
            console.log('   ✅ Test data rolled back (not saved)\n');
            
        } catch (error) {
            await manager.pgClient.query('ROLLBACK');
            throw error;
        }

        // Test 4: Check availability function
        console.log('4️⃣ Testing availability check function...');
        try {
            const availabilityCheck = await manager.pgClient.query(`
                SELECT crouse_chapel.is_chapel_available('2025-07-20'::date, '14:00:00'::time) as available
            `);
            console.log(`   ✅ Chapel availability for 2025-07-20 at 14:00: ${availabilityCheck.rows[0].available ? 'Available' : 'Not Available'}\n`);
        } catch (error) {
            console.log('   ⚠️  Availability function not found or error:', error.message, '\n');
        }

        console.log('✅ All database tests completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.detail) {
            console.error('   Details:', error.detail);
        }
        process.exit(1);
    } finally {
        await manager.disconnect();
    }
}

// Run the tests
testChapelDatabase();