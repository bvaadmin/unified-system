/**
 * Chapel Service Submission API v2
 * Uses dual-write pattern to save to both legacy and modern systems
 */

import { applyCors } from '../../lib/cors.js';
import { createDualWriteManager } from '../../lib/database/dual-write-manager.js';
import { createNotionPage } from '../../lib/notion.js';

export default async function handler(req, res) {
    // Apply CORS
    applyCors(req, res);

    // Only accept POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const DATABASE_URL = process.env.DATABASE_URL;
    const NOTION_API_KEY = process.env.NOTION_API_KEY;
    const CHAPEL_NOTION_DB_ID = process.env.CHAPEL_NOTION_DB_ID;

    if (!DATABASE_URL) {
        console.error('DATABASE_URL not configured');
        return res.status(500).json({ 
            error: 'Internal server error',
            message: 'Database configuration missing'
        });
    }

    const manager = createDualWriteManager(DATABASE_URL);

    try {
        // Extract and validate data
        const {
            applicationType,
            serviceDate,
            serviceTime,
            rehearsalDate,
            rehearsalTime,
            memberName,
            memberRelationship,
            contactName,
            contactAddress,
            contactPhone,
            contactEmail,
            // Type-specific details
            coupleNames,
            guestCount,
            brideArrivalTime,
            weddingFee,
            deceasedName,
            memorialGardenPlacement,
            eventType,
            organizationName,
            eventDescription,
            expectedAttendance,
            baptismCandidateName,
            parentsNames,
            witnesses,
            baptismType
        } = req.body;

        // Basic validation
        if (!applicationType || !serviceDate || !serviceTime || !contactName || !memberName) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                message: 'Application type, service date, service time, contact name, and member name are required'
            });
        }

        // Validate application type and normalize
        const validTypesMap = {
            'wedding': 'wedding',
            'memorial-funeral-service': 'memorial',
            'memorial': 'memorial',
            'funeral': 'funeral',
            'baptism': 'baptism',
            'general-use': 'general_use',
            'general_use': 'general_use'
        };
        
        if (!validTypesMap[applicationType]) {
            return res.status(400).json({
                error: 'Invalid application type',
                message: `Application type must be one of: ${Object.keys(validTypesMap).join(', ')}`
            });
        }
        
        const normalizedType = validTypesMap[applicationType];

        console.log(`Creating ${applicationType} chapel application with dual-write...`);

        // Prepare chapel application data
        const chapelData = {
            application_type: normalizedType,
            service_date: serviceDate,
            service_time: serviceTime,
            rehearsal_date: rehearsalDate || null,
            rehearsal_time: rehearsalTime || null,
            member_name: memberName,
            member_relationship: memberRelationship || '',
            contact_name: contactName,
            contact_address: contactAddress || '',
            contact_phone: contactPhone || '',
            contact_email: contactEmail || '',
            status: 'pending',
            payment_status: 'pending',
            submission_date: new Date()
        };

        // Create in both systems using dual-write
        const result = await manager.createChapelApplication(chapelData);

        if (!result.success) {
            throw new Error('Failed to create chapel application: ' + JSON.stringify(result.errors));
        }

        console.log(`Created chapel application - Legacy ID: ${result.legacy?.id}, Modern ID: ${result.modern?.id}`);

        // Create type-specific details in legacy system
        await manager.connect();
        const legacyAdapter = manager.legacy;

        switch (normalizedType) {
            case 'wedding':
                if (coupleNames) {
                    await legacyAdapter.query(`
                        INSERT INTO crouse_chapel.wedding_details (
                            application_id, couple_names, guest_count, 
                            bride_arrival_time, wedding_fee, dressing_at_chapel
                        ) VALUES ($1, $2, $3, $4, $5, $6)
                    `, [
                        result.legacy.id,
                        coupleNames,
                        guestCount || null,
                        brideArrivalTime || null,
                        weddingFee || null,
                        false
                    ]);
                }
                break;

            case 'memorial':
                if (deceasedName) {
                    await legacyAdapter.query(`
                        INSERT INTO crouse_chapel.memorial_details (
                            application_id, deceased_name, memorial_garden_placement
                        ) VALUES ($1, $2, $3)
                    `, [
                        result.legacy.id,
                        deceasedName,
                        memorialGardenPlacement || false
                    ]);
                }
                break;

            case 'baptism':
                if (baptismCandidateName) {
                    await legacyAdapter.query(`
                        INSERT INTO crouse_chapel.baptism_details (
                            application_id, baptism_candidate_name, 
                            parents_names, witnesses, baptism_type
                        ) VALUES ($1, $2, $3, $4, $5)
                    `, [
                        result.legacy.id,
                        baptismCandidateName,
                        parentsNames || null,
                        witnesses || null,
                        baptismType || 'infant'
                    ]);
                }
                break;

            case 'general_use':
                if (eventType) {
                    await legacyAdapter.query(`
                        INSERT INTO crouse_chapel.general_use_details (
                            application_id, event_type, organization_name,
                            event_description, expected_attendance
                        ) VALUES ($1, $2, $3, $4, $5)
                    `, [
                        result.legacy.id,
                        eventType,
                        organizationName || null,
                        eventDescription || null,
                        expectedAttendance || null
                    ]);
                }
                break;
        }

        // Create in Notion if configured
        let notionResult = null;
        if (NOTION_API_KEY && CHAPEL_NOTION_DB_ID) {
            try {
                const notionData = {
                    'Service Type': {
                        select: { name: applicationType }
                    },
                    'Contact Name': {
                        title: [{
                            text: { content: contactName }
                        }]
                    },
                    'Service Date': {
                        date: { start: serviceDate }
                    },
                    'Service Time': {
                        rich_text: [{
                            text: { content: serviceTime }
                        }]
                    },
                    'Member Name': {
                        rich_text: [{
                            text: { content: memberName }
                        }]
                    },
                    'Status': {
                        select: { name: 'Pending Review' }
                    },
                    'Contact Email': contactEmail ? {
                        email: contactEmail
                    } : undefined,
                    'Contact Phone': contactPhone ? {
                        phone_number: contactPhone
                    } : undefined,
                    'Legacy ID': {
                        number: result.legacy?.id
                    },
                    'Modern ID': {
                        number: result.modern?.id
                    },
                    'Submission Date': {
                        date: { start: new Date().toISOString() }
                    }
                };

                // Add type-specific fields
                if (applicationType === 'wedding' && coupleNames) {
                    notionData['Couple Names'] = {
                        rich_text: [{ text: { content: coupleNames } }]
                    };
                } else if (applicationType === 'memorial-funeral-service' && deceasedName) {
                    notionData['Deceased Name'] = {
                        rich_text: [{ text: { content: deceasedName } }]
                    };
                } else if (applicationType === 'baptism' && baptismCandidateName) {
                    notionData['Baptism Candidate'] = {
                        rich_text: [{ text: { content: baptismCandidateName } }]
                    };
                } else if (applicationType === 'general-use' && eventType) {
                    notionData['Event Type'] = {
                        rich_text: [{ text: { content: eventType } }]
                    };
                }

                // Remove undefined properties
                Object.keys(notionData).forEach(key => 
                    notionData[key] === undefined && delete notionData[key]
                );

                notionResult = await createNotionPage(CHAPEL_NOTION_DB_ID, notionData);
                console.log(`Created Notion page: ${notionResult.id}`);

                // Update legacy record with Notion ID
                await legacyAdapter.query(`
                    UPDATE crouse_chapel.service_applications 
                    SET notion_id = $1 
                    WHERE id = $2
                `, [notionResult.id, result.legacy.id]);

            } catch (notionError) {
                console.error('Notion creation error:', notionError);
                // Non-fatal - continue without Notion
            }
        }

        // Return success response
        const response = {
            success: true,
            applicationId: result.legacy?.id,
            modernId: result.modern?.id,
            submissionDate: new Date().toISOString(),
            notionId: notionResult?.id,
            notionUrl: notionResult?.url,
            message: 'Chapel service application submitted successfully',
            syncStatus: result.modern ? 'complete' : 'legacy_only',
            nextSteps: [
                'Your application will be reviewed by the Director of Worship',
                'You will be contacted within 2-3 business days',
                'Full payment is required to secure your date',
                'Clergy must be approved before the service'
            ]
        };

        return res.status(200).json(response);

    } catch (error) {
        console.error('Chapel submission error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to submit chapel service application',
            details: error.message
        });
    } finally {
        await manager.disconnect();
    }
}