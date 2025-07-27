// api/submit-chapel-service.js
// API endpoint for Crouse Chapel service applications (wedding, memorial, funeral)

import { withPooledTransaction } from '../../db.js';
import { createNotionPage, toNotionProperty } from '../../notion.js';

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

  const { formType, ...formData } = req.body;
  
  if (!formType || !['wedding', 'memorial-funeral-service'].includes(formType)) {
    return res.status(400).json({ error: 'Invalid form type' });
  }

  try {
    const applicationId = await withPooledTransaction(async (client) => {
      // Insert into service_applications table
      const applicationResult = await client.query(`
        INSERT INTO crouse_chapel.service_applications (
          application_type, service_date, service_time, contact_name, 
          contact_email, contact_phone, contact_address, bay_view_member,
          relationship, guest_count, decorations, clergy_requested,
          rehearsal_requested, rehearsal_date, rehearsal_time,
          special_requests, submitted_at, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING id
      `, [
        formType === 'wedding' ? 'wedding' : 'memorial',
        formData.serviceDate,
        formData.serviceTime,
        formData.contactName,
        formData.contactEmail,
        formData.contactPhone,
        formData.contactAddress,
        formData.bayViewMember,
        formData.relationship,
        parseInt(formData.guestCount) || 50,
        formData.decorations || '',
        formData.clergyRequested,
        formData.rehearsalRequested === 'yes',
        formData.rehearsalDate || null,
        formData.rehearsalTime || null,
        formData.specialRequests || '',
        new Date(),
        'pending'
      ]);
      
      const applicationId = applicationResult.rows[0].id;
      
      // Insert form-specific details
      if (formType === 'wedding') {
        await client.query(`
          INSERT INTO crouse_chapel.wedding_details (
            application_id, couple_names, guest_count, bride_arrival_time, wedding_fee
          ) VALUES ($1, $2, $3, $4, $5)
        `, [
          applicationId,
          formData.coupleNames,
          parseInt(formData.guestCount) || 50,
          formData.brideArrivalTime,
          parseFloat(formData.weddingFee) || 0
        ]);
      } else {
        await client.query(`
          INSERT INTO crouse_chapel.memorial_details (
            application_id, deceased_name, memorial_garden_placement
          ) VALUES ($1, $2, $3)
        `, [
          applicationId,
          formData.deceasedName,
          formData.memorialGardenPlacement === 'yes'
        ]);
      }
      
      // Handle clergy
      if (formData.clergyRequested) {
        const clergyResult = await client.query(`
          SELECT id FROM crouse_chapel.clergy WHERE name = $1
        `, [formData.clergyRequested]);
        
        let clergyId;
        if (clergyResult.rows.length === 0) {
          const newClergyResult = await client.query(`
            INSERT INTO crouse_chapel.clergy (name, approval_status, created_at)
            VALUES ($1, 'pending', NOW())
            RETURNING id
          `, [formData.clergyRequested]);
          clergyId = newClergyResult.rows[0].id;
        } else {
          clergyId = clergyResult.rows[0].id;
        }
        
        await client.query(`
          INSERT INTO crouse_chapel.service_clergy (application_id, clergy_id)
          VALUES ($1, $2)
        `, [applicationId, clergyId]);
      }
      
      // Handle music requirements
      if (formData.musicRequirements) {
        await client.query(`
          INSERT INTO crouse_chapel.service_music (
            application_id, music_requirements, chair_setup
          ) VALUES ($1, $2, $3)
        `, [
          applicationId,
          formData.musicRequirements,
          formData.chairSetup || 'standard'
        ]);
      }
      
      // Handle equipment needs
      const equipmentNeeds = {
        microphones: formData.microphones === 'yes',
        communion: formData.communion === 'yes',
        ropedSeating: formData.ropedSeating === 'yes'
      };
      
      await client.query(`
        INSERT INTO crouse_chapel.service_equipment (
          application_id, microphones, communion, roped_seating
        ) VALUES ($1, $2, $3, $4)
      `, [
        applicationId,
        equipmentNeeds.microphones,
        equipmentNeeds.communion,
        equipmentNeeds.ropedSeating
      ]);
      
      return applicationId;
    });

    // Create Notion page for workflow management
    let notionResult = null;
    try {
      const CHAPEL_NOTION_DB_ID = process.env.CHAPEL_NOTION_DB_ID;
      if (CHAPEL_NOTION_DB_ID) {
        const notionData = {
          'Application Type': toNotionProperty('select', formType === 'wedding' ? 'Wedding' : 'Memorial/Funeral'),
          'Service Date': toNotionProperty('date', { start: formData.serviceDate }),
          'Service Time': toNotionProperty('rich_text', formData.serviceTime),
          'Contact Name': toNotionProperty('title', formData.contactName),
          'Contact Email': toNotionProperty('email', formData.contactEmail),
          'Contact Phone': toNotionProperty('phone_number', formData.contactPhone),
          'Bay View Member': toNotionProperty('rich_text', formData.bayViewMember),
          'Guest Count': toNotionProperty('number', parseInt(formData.guestCount) || 50),
          'Status': toNotionProperty('select', 'Pending Review'),
          'Application ID': toNotionProperty('number', applicationId)
        };
        
        if (formType === 'wedding') {
          notionData['Couple Names'] = toNotionProperty('rich_text', formData.coupleNames);
          notionData['Wedding Fee'] = toNotionProperty('number', parseFloat(formData.weddingFee) || 0);
        } else {
          notionData['Deceased Name'] = toNotionProperty('rich_text', formData.deceasedName);
        }
        
        notionResult = await createNotionPage(CHAPEL_NOTION_DB_ID, notionData);
        
        // Update PostgreSQL with Notion ID
        await withPooledTransaction(async (client) => {
          await client.query(
            'UPDATE crouse_chapel.service_applications SET notion_id = $1 WHERE id = $2',
            [notionResult.id, applicationId]
          );
        });
      }
    } catch (notionError) {
      console.error('Notion sync failed:', notionError);
      // Continue without failing the entire request
    }

    return res.status(200).json({
      success: true,
      applicationId: applicationId,
      submissionDate: new Date().toISOString(),
      message: 'Application submitted successfully',
      notionId: notionResult?.id,
      nextSteps: [
        'Your application will be reviewed by the Director of Worship',
        'You will be contacted within 2-3 business days',
        'Full payment is required to secure your date',
        'Clergy must be approved before the service'
      ]
    });
    
  } catch (error) {
    console.error('Error submitting application:', error);
    return res.status(500).json({ 
      error: 'Failed to submit application',
      message: error.message 
    });
  }
}
