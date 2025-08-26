// API handler for Crouse Chapel service applications (wedding, memorial, funeral)
// Handles all form fields and distributes them to appropriate database tables

import { withPooledTransaction } from '../../db.js';
import { createNotionPage, toNotionProperty } from '../../notion.js';

export async function handleChapelSubmission(req, res) {
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
    const result = await withPooledTransaction(async (client) => {
      // 1. Insert into service_applications table
      const applicationResult = await client.query(`
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
        formType === 'wedding' ? 'wedding' : 'memorial',
        formData.weddingDate || formData.serviceDate,
        formData.weddingTime || formData.serviceTime,
        formData.contactName,
        formData.contactEmail,
        formData.contactPhone,
        formData.contactAddress,
        formData.contactRelationship || null,
        formData.memberName || null,
        formData.memberRelationship || null,
        formData.rehearsalDate || null,
        formData.rehearsalTime || null,
        formData.specialRequests || '',
        new Date(),
        'pending',
        JSON.stringify(formData) // Store complete form data
      ]);
      
      const applicationId = applicationResult.rows[0].id;
      const submissionDate = applicationResult.rows[0].submission_date;
      
      // 2. Insert form-specific details
      if (formType === 'wedding') {
        // Calculate wedding fee based on membership
        const isMember = formData.isMember === 'yes';
        const baseFee = isMember ? 300 : 750;
        const audioFee = 25; // Always added
        const totalFee = baseFee + audioFee;
        
        await client.query(`
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
          parseInt(formData.guestCount) || 50,
          formData.brideArrival || null,
          formData.dressingAtChapel === 'yes',
          baseFee,
          audioFee,
          totalFee,
          isMember,
          formData.whyBayView || ''
        ]);
      } else {
        await client.query(`
          INSERT INTO crouse_chapel.memorial_details (
            application_id, 
            deceased_name, 
            memorial_garden_placement
          ) VALUES ($1, $2, $3)
        `, [
          applicationId,
          formData.deceasedName,
          formData.memorialGardenPlacement === 'yes'
        ]);
      }
      
      // 3. Handle clergy information
      if (formData.clergyName) {
        // Check if clergy already exists
        const clergyCheck = await client.query(`
          SELECT id FROM crouse_chapel.clergy 
          WHERE LOWER(name) = LOWER($1)
        `, [formData.clergyName]);
        
        let clergyId;
        if (clergyCheck.rows.length === 0) {
          // Create new clergy record
          const clergyResult = await client.query(`
            INSERT INTO crouse_chapel.clergy (
              name, 
              denomination, 
              phone, 
              email, 
              address, 
              approved_status,
              created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING id
          `, [
            formData.clergyName,
            formData.clergyDenomination || null,
            formData.clergyPhone || null,
            formData.clergyEmail || null,
            formData.clergyAddress || null,
            'pending'
          ]);
          clergyId = clergyResult.rows[0].id;
        } else {
          // Update existing clergy with any new contact info
          clergyId = clergyCheck.rows[0].id;
          await client.query(`
            UPDATE crouse_chapel.clergy 
            SET 
              denomination = COALESCE($2, denomination),
              phone = COALESCE($3, phone),
              email = COALESCE($4, email),
              address = COALESCE($5, address),
              updated_at = NOW()
            WHERE id = $1
          `, [
            clergyId,
            formData.clergyDenomination || null,
            formData.clergyPhone || null,
            formData.clergyEmail || null,
            formData.clergyAddress || null
          ]);
        }
        
        // Link clergy to service
        await client.query(`
          INSERT INTO crouse_chapel.service_clergy (service_id, clergy_id)
          VALUES ($1, $2)
        `, [applicationId, clergyId]);
      }
      
      // 4. Handle music requirements
      if (formData.hasMusic === 'on' || formData.hasMusic === 'true') {
        await client.query(`
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
            perform_location,
            organist_name,
            organist_phone,
            organist_email,
            soloist_name,
            other_musicians
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        `, [
          applicationId,
          true, // music_required
          true, // has_music
          formData.needsPiano === 'on',
          formData.needsOrgan === 'on',
          formData.performSanctuary === 'on',
          formData.performBalcony === 'on',
          formData.needsChairs === 'on',
          parseInt(formData.chairCount) || 0,
          formData.chairPlacement || null,
          formData.performSanctuary === 'on' ? 'Sanctuary' : (formData.performBalcony === 'on' ? 'Balcony' : null),
          formData.organistName || null,
          formData.organistPhone || null,
          formData.organistEmail || null,
          formData.soloistName || null,
          formData.otherMusicians || null
        ]);
      }
      
      // 5. Handle equipment needs
      const equipmentData = {
        stand_microphone: formData.standMic === 'on',
        wireless_microphone: formData.wirelessMic === 'on',
        cd_player: formData.cdPlayer === 'on',
        communion_service: formData.communion === 'on',
        guest_book_stand: formData.guestBook === 'on',
        roped_seating: formData.ropedSeating === 'on',
        rows_left: parseInt(formData.rowsLeft) || 0,
        rows_right: parseInt(formData.rowsRight) || 0,
        other_equipment: formData.otherEquipment || null
      };
      
      await client.query(`
        INSERT INTO crouse_chapel.service_equipment (
          application_id, 
          stand_microphone,
          wireless_microphone,
          cd_player,
          communion_service,
          guest_book_stand,
          roped_seating,
          rows_left,
          rows_right,
          other_equipment
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        applicationId,
        equipmentData.stand_microphone,
        equipmentData.wireless_microphone,
        equipmentData.cd_player,
        equipmentData.communion_service,
        equipmentData.guest_book_stand,
        equipmentData.roped_seating,
        equipmentData.rows_left,
        equipmentData.rows_right,
        equipmentData.other_equipment
      ]);
      
      // 6. Handle policy acknowledgments
      if (formData.policyAgreement === 'on' || formData.feeAgreement === 'on') {
        const acknowledgments = [];
        
        if (formData.policyAgreement === 'on') {
          acknowledgments.push(['chapel_policies', applicationId]);
        }
        if (formData.feeAgreement === 'on') {
          acknowledgments.push(['fee_agreement', applicationId]);
        }
        
        if (acknowledgments.length > 0) {
          await client.query(`
            INSERT INTO crouse_chapel.policy_acknowledgments (policy_type, application_id, acknowledged, acknowledged_date)
            VALUES ${acknowledgments.map((_, i) => `($${i*2+1}, $${i*2+2}, true, NOW())`).join(', ')}
          `, acknowledgments.flat());
        }
      }
      
      return {
        applicationId,
        submissionDate
      };
    });

    // 7. Create Notion page for workflow management
    let notionResult = null;
    try {
      const CHAPEL_NOTION_DB_ID = process.env.CHAPEL_NOTION_DB_ID;
      if (CHAPEL_NOTION_DB_ID) {
        const notionData = {
          'Application Type': toNotionProperty('select', formType === 'wedding' ? 'Wedding' : 'Memorial/Funeral'),
          'Service Date': toNotionProperty('date', { 
            start: formData.weddingDate || formData.serviceDate 
          }),
          'Service Time': toNotionProperty('rich_text', 
            formData.weddingTime || formData.serviceTime
          ),
          'Contact Name': toNotionProperty('title', formData.contactName),
          'Contact Email': toNotionProperty('email', formData.contactEmail),
          'Contact Phone': toNotionProperty('phone_number', formData.contactPhone),
          'Bay View Member': toNotionProperty('rich_text', formData.memberName || 'N/A'),
          'Guest Count': toNotionProperty('number', parseInt(formData.guestCount) || 50),
          'Status': toNotionProperty('select', 'Pending Review'),
          'Application ID': toNotionProperty('number', result.applicationId)
        };
        
        if (formType === 'wedding') {
          notionData['Couple Names'] = toNotionProperty('rich_text', formData.coupleNames);
          const isMember = formData.isMember === 'yes';
          const totalFee = (isMember ? 300 : 750) + 25;
          notionData['Wedding Fee'] = toNotionProperty('number', totalFee);
          notionData['Is Member'] = toNotionProperty('checkbox', isMember);
        } else {
          notionData['Deceased Name'] = toNotionProperty('rich_text', formData.deceasedName);
        }
        
        if (formData.clergyName) {
          notionData['Clergy'] = toNotionProperty('rich_text', formData.clergyName);
        }
        
        notionResult = await createNotionPage(CHAPEL_NOTION_DB_ID, notionData);
        
        // Update PostgreSQL with Notion ID
        await withPooledTransaction(async (client) => {
          await client.query(
            'UPDATE crouse_chapel.service_applications SET notion_id = $1 WHERE id = $2',
            [notionResult.id, result.applicationId]
          );
        });
      }
    } catch (notionError) {
      console.error('Notion sync failed:', notionError);
      // Continue without failing the entire request
    }

    // 8. Enqueue confirmation email
    try {
      const { enqueueChapelNotification } = await import('../../email/enqueue.js');
      
      const emailData = {
        contact_name: formData.contactName,
        contact_email: formData.contactEmail,
        service_type: formType === 'wedding' ? 'Wedding' : 'Memorial/Funeral Service',
        service_date: formData.weddingDate || formData.serviceDate,
        service_time: formData.weddingTime || formData.serviceTime,
        next_steps: [
          'Your application will be reviewed by the Director of Worship',
          'You will be contacted within 2-3 business days',
          'Full payment is required to secure your date',
          'Clergy must be approved before the service'
        ].join('\n'),
        next_steps_html: [
          'Your application will be reviewed by the Director of Worship',
          'You will be contacted within 2-3 business days',
          'Full payment is required to secure your date',
          'Clergy must be approved before the service'
        ].join('<br/>')
      };
      
      await enqueueChapelNotification(result.applicationId, 'received', emailData);
    } catch (emailError) {
      console.error('Failed to enqueue confirmation email:', emailError);
      // Continue without failing the entire request
    }
    
    // 9. Return success response
    return res.status(200).json({
      success: true,
      applicationId: result.applicationId,
      submissionDate: result.submissionDate,
      message: 'Application submitted successfully',
      notionId: notionResult?.id,
      notionUrl: notionResult ? `https://www.notion.so/${notionResult.id.replace(/-/g, '')}` : null,
      nextSteps: formType === 'wedding' ? [
        'Your wedding application will be reviewed by the Director of Worship',
        'You will be contacted within 2-3 business days',
        'Full payment is required to secure your date',
        'Clergy must be approved before the service',
        'The Altar Guild will be notified upon approval'
      ] : [
        'Your memorial service application will be reviewed',
        'You will be contacted within 2-3 business days',
        'Clergy arrangements will be confirmed'
      ]
    });
    
  } catch (error) {
    console.error('Error submitting chapel application:', error);
    return res.status(500).json({ 
      error: 'Failed to submit application',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}