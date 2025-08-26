/**
 * Test Wedding Form Submission with All Fields
 */
import dotenv from 'dotenv';
import { createDualWriteManager } from '../lib/database/dual-write-manager.js';

// Load environment variables
dotenv.config();

async function testWeddingSubmission() {
    const DATABASE_URL = process.env.DATABASE_URL;
    
    if (!DATABASE_URL) {
        console.error('DATABASE_URL not found in environment variables');
        process.exit(1);
    }

    const manager = createDualWriteManager(DATABASE_URL);

    // Sample form data matching the HTML form
    const formData = {
        formType: 'wedding',
        
        // Wedding Details
        weddingDate: '2025-08-15',
        weddingTime: '14:00',
        rehearsalDate: '2025-08-14',
        rehearsalTime: '17:00',
        coupleNames: 'Sarah Johnson and Michael Smith',
        guestCount: 65,
        brideArrival: '13:30',
        dressingAtChapel: 'yes',
        
        // Member Information
        memberName: 'Elizabeth Johnson',
        memberRelationship: 'Mother of the Bride',
        isMember: 'yes',
        
        // Clergy Information
        clergyName: 'Rev. Dr. James Wilson',
        clergyDenomination: 'United Methodist',
        clergyPhone: '231-555-0123',
        clergyEmail: 'jwilson@church.org',
        clergyAddress: '123 Church Street\nPetoskey, MI 49770',
        
        // Music & Equipment
        hasMusic: 'on',
        needsPiano: 'on',
        needsOrgan: 'on',
        performSanctuary: 'on',
        needsChairs: 'on',
        chairCount: 4,
        chairPlacement: 'Front left for string quartet',
        
        // Equipment Needs
        standMic: 'on',
        wirelessMic: 'on',
        cdPlayer: 'on',
        communion: 'on',
        guestBook: 'on',
        ropedSeating: 'on',
        rowsLeft: 3,
        rowsRight: 3,
        
        // Additional Information
        whyBayView: 'Our family has been coming to Bay View for five generations. Sarah\'s grandparents were married in this chapel in 1962.',
        specialRequests: 'We would like to have the chapel bells rung after the ceremony.',
        
        // Contact Information
        contactName: 'Elizabeth Johnson',
        contactEmail: 'ejohnson@email.com',
        contactPhone: '231-555-0100',
        contactRelationship: 'Mother of the Bride',
        contactAddress: '456 Oak Avenue\nPetoskey, MI 49770',
        
        // Agreements
        policyAgreement: 'on',
        feeAgreement: 'on'
    };

    try {
        await manager.connect();
        console.log('🔗 Connected to database\n');

        // Start transaction
        await manager.pgClient.query('BEGIN');
        
        console.log('📝 Testing wedding submission with all fields...\n');
        
        try {
            // 1. Insert main application
            const applicationResult = await manager.pgClient.query(`
                INSERT INTO crouse_chapel.service_applications (
                    application_type, 
                    service_date, 
                    service_time, 
                    contact_name, 
                    contact_email, 
                    contact_phone, 
                    contact_address,
                    contact_relationship,
                    member_name,
                    member_relationship,
                    rehearsal_date, 
                    rehearsal_time,
                    special_requests, 
                    submission_date,
                    status,
                    form_data
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                RETURNING id, submission_date
            `, [
                'wedding',
                formData.weddingDate,
                formData.weddingTime,
                formData.contactName,
                formData.contactEmail,
                formData.contactPhone,
                formData.contactAddress,
                formData.contactRelationship,
                formData.memberName,
                formData.memberRelationship,
                formData.rehearsalDate,
                formData.rehearsalTime,
                formData.specialRequests,
                new Date(),
                'pending',
                JSON.stringify(formData) // Store complete form data as backup
            ]);
            
            const applicationId = applicationResult.rows[0].id;
            console.log(`✅ Created application ID: ${applicationId}`);
            
            // 2. Insert wedding details
            const isMember = formData.isMember === 'yes';
            const baseFee = isMember ? 300 : 750;
            const audioFee = 25;
            const totalFee = baseFee + audioFee;
            
            await manager.pgClient.query(`
                INSERT INTO crouse_chapel.wedding_details (
                    application_id, 
                    couple_names, 
                    guest_count, 
                    bride_arrival_time, 
                    dressing_at_chapel,
                    base_fee,
                    audio_fee,
                    wedding_fee,
                    is_member,
                    why_bay_view
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [
                applicationId,
                formData.coupleNames,
                parseInt(formData.guestCount),
                formData.brideArrival,
                formData.dressingAtChapel === 'yes',
                baseFee,
                audioFee,
                totalFee,
                isMember,
                formData.whyBayView
            ]);
            console.log(`✅ Added wedding details (Fee: $${totalFee})`);
            
            // 3. Handle clergy
            const clergyResult = await manager.pgClient.query(`
                INSERT INTO crouse_chapel.clergy (
                    name, 
                    denomination, 
                    phone, 
                    email, 
                    address, 
                    approved_status
                ) VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (name) 
                DO UPDATE SET 
                    denomination = EXCLUDED.denomination,
                    phone = EXCLUDED.phone,
                    email = EXCLUDED.email,
                    address = EXCLUDED.address
                RETURNING id
            `, [
                formData.clergyName,
                formData.clergyDenomination,
                formData.clergyPhone,
                formData.clergyEmail,
                formData.clergyAddress,
                'pending'
            ]);
            
            await manager.pgClient.query(`
                INSERT INTO crouse_chapel.service_clergy (service_id, clergy_id)
                VALUES ($1, $2)
            `, [applicationId, clergyResult.rows[0].id]);
            console.log(`✅ Added clergy information`);
            
            // 4. Handle music
            await manager.pgClient.query(`
                INSERT INTO crouse_chapel.service_music (
                    application_id,
                    music_required, 
                    has_music,
                    needs_piano,
                    needs_organ,
                    perform_sanctuary,
                    perform_balcony,
                    additional_chairs,
                    chair_count,
                    chair_placement,
                    perform_location
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            `, [
                applicationId,
                formData.hasMusic === 'on',
                formData.hasMusic === 'on',
                formData.needsPiano === 'on',
                formData.needsOrgan === 'on',
                formData.performSanctuary === 'on',
                formData.performBalcony === 'on',
                formData.needsChairs === 'on',
                parseInt(formData.chairCount) || 0,
                formData.chairPlacement || null,
                formData.performSanctuary === 'on' ? 'Sanctuary' : (formData.performBalcony === 'on' ? 'Balcony' : null)
            ]);
            console.log(`✅ Added music requirements`);
            
            // 5. Handle equipment
            await manager.pgClient.query(`
                INSERT INTO crouse_chapel.service_equipment (
                    application_id, 
                    stand_microphone,
                    wireless_microphone,
                    cd_player,
                    communion_service,
                    guest_book_stand,
                    roped_seating,
                    rows_left,
                    rows_right
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
                applicationId,
                formData.standMic === 'on',
                formData.wirelessMic === 'on',
                formData.cdPlayer === 'on',
                formData.communion === 'on',
                formData.guestBook === 'on',
                formData.ropedSeating === 'on',
                parseInt(formData.rowsLeft) || 0,
                parseInt(formData.rowsRight) || 0
            ]);
            console.log(`✅ Added equipment needs`);
            
            // 6. Handle policy acknowledgments
            await manager.pgClient.query(`
                INSERT INTO crouse_chapel.policy_acknowledgments (
                    policy_type, 
                    application_id,
                    acknowledged,
                    acknowledged_date
                ) VALUES 
                    ('chapel_policies', $1, true, NOW()),
                    ('fee_agreement', $1, true, NOW())
            `, [applicationId]);
            console.log(`✅ Added policy acknowledgments`);
            
            // Retrieve and display the complete submission
            console.log('\n📋 Verifying submission...\n');
            
            const verifyResult = await manager.pgClient.query(`
                SELECT 
                    sa.*,
                    wd.couple_names,
                    wd.wedding_fee,
                    wd.is_member,
                    wd.why_bay_view,
                    c.name as clergy_name,
                    c.denomination,
                    sm.has_music,
                    sm.chair_placement,
                    se.stand_microphone,
                    se.wireless_microphone,
                    se.communion_service,
                    se.roped_seating,
                    se.rows_left,
                    se.rows_right
                FROM crouse_chapel.service_applications sa
                LEFT JOIN crouse_chapel.wedding_details wd ON sa.id = wd.application_id
                LEFT JOIN crouse_chapel.service_clergy scl ON sa.id = scl.service_id
                LEFT JOIN crouse_chapel.clergy c ON scl.clergy_id = c.id
                LEFT JOIN crouse_chapel.service_music sm ON sa.id = sm.application_id
                LEFT JOIN crouse_chapel.service_equipment se ON sa.id = se.application_id
                WHERE sa.id = $1
            `, [applicationId]);
            
            if (verifyResult.rows.length > 0) {
                const submission = verifyResult.rows[0];
                console.log('Wedding Application Summary:');
                console.log('============================');
                console.log(`Application ID: ${submission.id}`);
                console.log(`Couple: ${submission.couple_names}`);
                console.log(`Date: ${submission.service_date.toISOString().split('T')[0]} at ${submission.service_time}`);
                console.log(`Member: ${submission.is_member ? 'Yes' : 'No'}`);
                console.log(`Wedding Fee: $${submission.wedding_fee}`);
                console.log(`Clergy: ${submission.clergy_name} (${submission.denomination})`);
                console.log(`Music: ${submission.has_music ? 'Yes' : 'No'}`);
                console.log(`Chair Setup: ${submission.chair_placement || 'Standard'}`);
                console.log(`Equipment:${submission.stand_microphone ? ' Stand-Mic' : ''}${submission.wireless_microphone ? ' Wireless-Mic' : ''}${submission.communion_service ? ' Communion' : ''}${submission.roped_seating ? ` Roped-Seating(${submission.rows_left}L/${submission.rows_right}R)` : ''}`);
                console.log(`Why Bay View: ${submission.why_bay_view.substring(0, 50)}...`);
            }
            
            // Rollback test data
            await manager.pgClient.query('ROLLBACK');
            console.log('\n✅ Test completed successfully! (Data rolled back)');
            
        } catch (error) {
            await manager.pgClient.query('ROLLBACK');
            throw error;
        }

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

// Run the test
testWeddingSubmission();