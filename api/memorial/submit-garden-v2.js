/**
 * Memorial Garden Submission API v2
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
    const MEMORIAL_NOTION_DB_ID = process.env.MEMORIAL_NOTION_DB_ID || 'e438c3bd041a4977baacde59ea4cc1e7';

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
            firstName,
            lastName,
            birthDate,
            deathDate,
            message,
            contactName,
            contactEmail,
            contactPhone,
            contactAddress
        } = req.body;

        // Basic validation
        if (!firstName || !lastName) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                message: 'First name and last name are required'
            });
        }

        // Prepare memorial data
        const memorialData = {
            first_name: firstName,
            last_name: lastName,
            birth_date: birthDate || null,
            death_date: deathDate || null,
            message: message || '',
            contact_name: contactName,
            contact_email: contactEmail,
            contact_phone: contactPhone,
            contact_address: contactAddress
        };

        // Create in both systems using dual-write
        console.log('Creating memorial with dual-write...');
        const result = await manager.createMemorial(memorialData);

        if (!result.success) {
            throw new Error('Failed to create memorial: ' + JSON.stringify(result.errors));
        }

        console.log(`Created memorial - Legacy ID: ${result.legacy?.id}, Modern ID: ${result.modern?.id}`);

        // Create in Notion if configured
        let notionResult = null;
        if (NOTION_API_KEY && MEMORIAL_NOTION_DB_ID) {
            try {
                const notionData = {
                    'Name': {
                        title: [{
                            text: { content: `${firstName} ${lastName}` }
                        }]
                    },
                    'First Name': {
                        rich_text: [{
                            text: { content: firstName }
                        }]
                    },
                    'Last Name': {
                        rich_text: [{
                            text: { content: lastName }
                        }]
                    },
                    'Birth Date': birthDate ? {
                        date: { start: birthDate }
                    } : undefined,
                    'Death Date': deathDate ? {
                        date: { start: deathDate }
                    } : undefined,
                    'Message': message ? {
                        rich_text: [{
                            text: { content: message }
                        }]
                    } : undefined,
                    'Contact Name': contactName ? {
                        rich_text: [{
                            text: { content: contactName }
                        }]
                    } : undefined,
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

                // Remove undefined properties
                Object.keys(notionData).forEach(key => 
                    notionData[key] === undefined && delete notionData[key]
                );

                notionResult = await createNotionPage(MEMORIAL_NOTION_DB_ID, notionData);
                console.log(`Created Notion page: ${notionResult.id}`);
            } catch (notionError) {
                console.error('Notion creation error:', notionError);
                // Non-fatal - continue without Notion
            }
        }

        // Return success response
        return res.status(200).json({
            success: true,
            submissionId: `MEM-${result.legacy?.id}`,
            legacyId: result.legacy?.id,
            modernId: result.modern?.id,
            notionId: notionResult?.id,
            notionUrl: notionResult?.url,
            message: 'Memorial garden application submitted successfully',
            syncStatus: result.modern ? 'complete' : 'legacy_only'
        });

    } catch (error) {
        console.error('Memorial submission error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to submit memorial garden application',
            details: error.message
        });
    } finally {
        await manager.disconnect();
    }
}