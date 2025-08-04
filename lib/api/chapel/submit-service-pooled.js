// api/submit-chapel-service-pooled.js
// API endpoint for Crouse Chapel service applications (wedding, memorial, funeral)
// Updated to use connection pooling to prevent DigitalOcean connection limits

import { withPooledTransaction } from '../../lib/db-pool.js';
import { createNotionPage, toNotionProperty } from '../../lib/notion.js';
import { validateChapelSubmission, ValidationError, SecurityError } from '../../lib/validation.js';

export default async function handler(req, res) {
  // Enable CORS
  const allowedOrigins = [
    'https://bvaadmin.github.io',
    'https://vercel.com',
    'http://localhost:3000',
    'http://127.0.0.1:5500'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://bvaadmin.github.io');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const NOTION_API_KEY = process.env.NOTION_API_KEY;
  const NOTION_DATABASE_ID = process.env.CHAPEL_NOTION_DB_ID || 'your-chapel-notion-db-id';

  try {
    // 🛡️ SECURITY: Validate and sanitize all input data
    const validationResult = validateChapelSubmission(req.body);
    
    if (!validationResult.valid) {
      if (validationResult.error instanceof SecurityError) {
        // Log security attempts but return generic error
        console.error('Security validation failed:', validationResult.error);
        return res.status(400).json({ 
          error: 'Invalid input data',
          message: 'Please check your form data and try again'
        });
      }
      return res.status(400).json({ 
        error: validationResult.error.message,
        field: validationResult.error.field 
      });
    }

    const sanitizedData = validationResult.data;
    
    // Use connection pool for transaction
    const result = await withPooledTransaction(async (client) => {
      // Core service application insert
      const applicationQuery = `
        INSERT INTO crouse_chapel.service_applications (
          form_type, service_type, service_date, service_time,
          contact_name, contact_email, contact_phone, contact_address,
          is_member, member_name, member_relationship,
          celebrant_requested, music_required, livestream_requested,
          service_notes, rehearsal_needed, rehearsal_datetime,
          submission_date, applicant_name, bay_view_host
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, NOW(), $18, $19
        ) RETURNING id`;

      const applicationValues = [
        sanitizedData.formType,
        sanitizedData.serviceType || sanitizedData.formType,
        sanitizedData.serviceDate,
        sanitizedData.serviceTime,
        sanitizedData.contactName,
        sanitizedData.contactEmail,
        sanitizedData.contactPhone,
        sanitizedData.contactAddress,
        sanitizedData.isMember === 'yes',
        sanitizedData.memberName || null,
        sanitizedData.memberRelationship || null,
        sanitizedData.celebrantRequested || null,
        sanitizedData.musicRequired === 'yes',
        sanitizedData.livestreamRequested === 'yes',
        sanitizedData.serviceNotes || null,
        sanitizedData.rehearsalNeeded === 'yes',
        sanitizedData.rehearsalDateTime || null,
        // Use contact name as applicant for now
        sanitizedData.contactName,
        sanitizedData.bayViewHost || null
      ];

      const appResult = await client.query(applicationQuery, applicationValues);
      const applicationId = appResult.rows[0].id;

      // Handle clergy information
      if (sanitizedData.celebrantName || sanitizedData.celebrantRequested) {
        const clergyName = sanitizedData.celebrantName || sanitizedData.celebrantRequested;
        const clergyCheck = await client.query(
          'SELECT id FROM crouse_chapel.clergy WHERE full_name = $1',
          [clergyName]
        );

        let clergyId;
        if (clergyCheck.rows.length === 0) {
          // Insert new clergy
          const clergyInsert = await client.query(
            'INSERT INTO crouse_chapel.clergy (full_name, approval_status) VALUES ($1, $2) RETURNING id',
            [clergyName, 'pending']
          );
          clergyId = clergyInsert.rows[0].id;
        } else {
          clergyId = clergyCheck.rows[0].id;
        }

        // Link clergy to service
        await client.query(
          'INSERT INTO crouse_chapel.service_clergy (service_id, clergy_id, role) VALUES ($1, $2, $3)',
          [applicationId, clergyId, 'celebrant']
        );
      }

      // Form-specific inserts
      switch (sanitizedData.formType) {
        case 'wedding':
          const weddingQuery = `
            INSERT INTO crouse_chapel.wedding_details (
              service_id, couple_names, guest_count, photography_allowed,
              videography_allowed, unity_ceremony_type, communion_required,
              bride_arrival_time, groom_arrival_time, wedding_party_size,
              flower_delivery_time, photographer_arrival_time,
              reception_location, wedding_fee
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`;

          await client.query(weddingQuery, [
            applicationId,
            sanitizedData.coupleNames,
            sanitizedData.guestCount || null,
            sanitizedData.photographyAllowed === 'yes',
            sanitizedData.videographyAllowed === 'yes',
            sanitizedData.unityCeremonyType || null,
            sanitizedData.communionRequired === 'yes',
            sanitizedData.brideArrivalTime || null,
            sanitizedData.groomArrivalTime || null,
            sanitizedData.weddingPartySize || null,
            sanitizedData.flowerDeliveryTime || null,
            sanitizedData.photographerArrivalTime || null,
            sanitizedData.receptionLocation || null,
            sanitizedData.weddingFee || (sanitizedData.isMember === 'yes' ? 300.00 : 750.00)
          ]);
          break;

        case 'memorial-funeral-service':
          const memorialQuery = `
            INSERT INTO crouse_chapel.memorial_details (
              service_id, deceased_name, deceased_date_of_birth,
              deceased_date_of_death, visitation_time,
              interment_location, reception_location,
              memorial_garden_placement
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;

          await client.query(memorialQuery, [
            applicationId,
            sanitizedData.deceasedName,
            sanitizedData.deceasedDateOfBirth || null,
            sanitizedData.deceasedDateOfDeath || null,
            sanitizedData.visitationTime || null,
            sanitizedData.intermentLocation || null,
            sanitizedData.receptionLocation || null,
            sanitizedData.memorialGardenPlacement === 'yes'
          ]);
          break;

        case 'baptism':
          const baptismQuery = `
            INSERT INTO crouse_chapel.baptism_details (
              service_id, child_name, child_date_of_birth,
              parent_names, godparent_names
            ) VALUES ($1, $2, $3, $4, $5)`;

          await client.query(baptismQuery, [
            applicationId,
            sanitizedData.childName,
            sanitizedData.childDateOfBirth || null,
            sanitizedData.parentNames || null,
            sanitizedData.godparentNames || null
          ]);
          break;

        case 'general-service':
          const generalQuery = `
            INSERT INTO crouse_chapel.general_service_details (
              service_id, service_purpose, expected_attendance,
              special_requirements
            ) VALUES ($1, $2, $3, $4)`;

          await client.query(generalQuery, [
            applicationId,
            sanitizedData.servicePurpose || 'General Service',
            sanitizedData.expectedAttendance || null,
            sanitizedData.specialRequirements || null
          ]);
          break;
      }

      // Music requirements
      if (sanitizedData.musicRequired === 'yes') {
        const musicQuery = `
          INSERT INTO crouse_chapel.service_music (
            service_id, organist_needed, organist_name,
            soloist_needed, soloist_name, other_musicians,
            music_selections, chair_setup_type, chair_setup_count
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`;

        await client.query(musicQuery, [
          applicationId,
          sanitizedData.organistNeeded === 'yes',
          sanitizedData.organistName || null,
          sanitizedData.soloistNeeded === 'yes',
          sanitizedData.soloistName || null,
          sanitizedData.otherMusicians || null,
          sanitizedData.musicSelections || null,
          sanitizedData.chairSetupType || 'standard',
          sanitizedData.chairSetupCount || null
        ]);

        // Individual musicians
        if (sanitizedData.musicians && Array.isArray(sanitizedData.musicians)) {
          for (const musician of sanitizedData.musicians) {
            await client.query(
              'INSERT INTO crouse_chapel.service_musicians (service_id, name, instrument) VALUES ($1, $2, $3)',
              [applicationId, musician.name, musician.instrument]
            );
          }
        } else if (sanitizedData.otherMusicians) {
          // Parse other musicians from text
          await client.query(
            'INSERT INTO crouse_chapel.service_musicians (service_id, name, instrument) VALUES ($1, $2, $3)',
            [applicationId, sanitizedData.otherMusicians, 'Various']
          );
        }
      }

      // Equipment needs
      const equipmentQuery = `
        INSERT INTO crouse_chapel.service_equipment (
          service_id, microphones_needed, microphone_count,
          communion_setup, altar_flowers, candles_needed,
          roped_seating_sections, other_equipment
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;

      await client.query(equipmentQuery, [
        applicationId,
        sanitizedData.microphonesNeeded === 'yes',
        sanitizedData.microphoneCount || null,
        sanitizedData.communionSetup === 'yes',
        sanitizedData.altarFlowers === 'yes',
        sanitizedData.candlesNeeded === 'yes',
        sanitizedData.ropedSeatingSections || null,
        sanitizedData.otherEquipment || null
      ]);

      // Policy acknowledgments
      if (sanitizedData.policyAgreement === 'yes') {
        await client.query(
          'INSERT INTO crouse_chapel.policy_acknowledgments (service_id, policy_type, acknowledged_date) VALUES ($1, $2, NOW())',
          [applicationId, sanitizedData.formType]
        );
      }

      // Check and update availability
      const availabilityCheck = await client.query(
        'SELECT crouse_chapel.is_chapel_available($1, $2) as is_available',
        [sanitizedData.serviceDate, sanitizedData.serviceTime]
      );

      if (!availabilityCheck.rows[0].is_available) {
        throw new Error('The selected date and time is no longer available');
      }

      // Mark date as booked
      await client.query(
        'INSERT INTO crouse_chapel.chapel_availability (service_date, service_time, is_available, service_id) VALUES ($1, $2, false, $3)',
        [sanitizedData.serviceDate, sanitizedData.serviceTime, applicationId]
      );

      return { applicationId, submissionDate: new Date() };
    });

    // Save to Notion if configured
    let notionResult = null;
    if (NOTION_API_KEY && NOTION_DATABASE_ID) {
      try {
        // Create Notion page with all form data
        const notionProperties = {
          'Application ID': toNotionProperty(result.applicationId, 'number'),
          'Form Type': toNotionProperty(sanitizedData.formType, 'select'),
          'Service Date': toNotionProperty(sanitizedData.serviceDate, 'date'),
          'Service Time': toNotionProperty(sanitizedData.serviceTime, 'title'),
          'Contact Name': toNotionProperty(sanitizedData.contactName, 'rich_text'),
          'Contact Email': toNotionProperty(sanitizedData.contactEmail, 'email'),
          'Contact Phone': toNotionProperty(sanitizedData.contactPhone, 'phone_number'),
          'Is Member': toNotionProperty(sanitizedData.isMember === 'yes', 'checkbox'),
          'Status': toNotionProperty('Pending Review', 'select'),
          'Submission Date': toNotionProperty(result.submissionDate.toISOString(), 'date')
        };

        // Add form-specific properties
        if (sanitizedData.formType === 'wedding') {
          notionProperties['Couple Names'] = toNotionProperty(sanitizedData.coupleNames, 'rich_text');
          notionProperties['Guest Count'] = toNotionProperty(sanitizedData.guestCount, 'number');
          notionProperties['Wedding Fee'] = toNotionProperty(
            sanitizedData.weddingFee || (sanitizedData.isMember === 'yes' ? 300 : 750),
            'number'
          );
        } else if (sanitizedData.formType === 'memorial-funeral-service') {
          notionProperties['Deceased Name'] = toNotionProperty(sanitizedData.deceasedName, 'rich_text');
          notionProperties['Memorial Garden'] = toNotionProperty(
            sanitizedData.memorialGardenPlacement === 'yes',
            'checkbox'
          );
        }

        notionResult = await createNotionPage(
          NOTION_API_KEY,
          NOTION_DATABASE_ID,
          notionProperties
        );
      } catch (notionError) {
        console.error('Notion sync error:', notionError);
        // Continue - database save was successful
      }
    }

    // Return success with next steps
    return res.status(200).json({
      success: true,
      applicationId: result.applicationId,
      submissionDate: result.submissionDate,
      message: 'Application submitted successfully',
      notionId: notionResult?.id,
      notionUrl: notionResult?.url,
      nextSteps: [
        'Your application will be reviewed by the Director of Worship',
        'You will be contacted within 2-3 business days',
        'Full payment is required to secure your date',
        'Clergy must be approved before the service'
      ]
    });

  } catch (error) {
    console.error('Chapel submission error:', error);
    
    if (error.message?.includes('not available')) {
      return res.status(400).json({
        error: 'Date unavailable',
        message: error.message
      });
    }
    
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process chapel service application',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Configure Vercel function timeout
export const config = {
  maxDuration: 10
};