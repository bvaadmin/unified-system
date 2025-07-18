// api/submit-chapel-service.js
// API endpoint for Crouse Chapel service applications (wedding, memorial, funeral)

import { Client } from 'pg';
import { createNotionPage, toNotionProperty } from '../lib/notion.js';

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

  const DATABASE_URL = process.env.DATABASE_URL_CLEAN || process.env.DATABASE_URL;
  const NOTION_API_KEY = process.env.NOTION_API_KEY;
  const NOTION_DATABASE_ID = process.env.CHAPEL_NOTION_DB_ID || 'your-chapel-notion-db-id';

  if (!DATABASE_URL) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const pgClient = new Client({
    connectionString: DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
  });

  try {
    const { formType, data } = req.body;
    
    // Validate form type
    if (!['wedding', 'memorial-funeral-service'].includes(formType)) {
      return res.status(400).json({ error: 'Invalid form type' });
    }

    await pgClient.connect();
    
    // Start transaction
    await pgClient.query('BEGIN');
    
    try {
      // 1. Insert main service application
      const applicationQuery = `
        INSERT INTO crouse_chapel.service_applications (
          application_type,
          service_date,
          service_time,
          rehearsal_date,
          rehearsal_time,
          member_name,
          member_relationship,
          contact_name,
          contact_address,
          contact_phone,
          contact_email,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id, submission_date
      `;
      
      const applicationType = formType === 'wedding' ? 'wedding' : 
        (data.serviceType || 'memorial');
      
      const applicationValues = [
        applicationType,
        data.weddingDate || data.serviceDate,
        data.ceremonyTime || data.serviceTime,
        data.rehearsalDate || null,
        data.rehearsalTime || null,
        data.bayViewMember,
        data.relationship,
        data.contactName,
        data.contactAddress,
        data.contactPhone,
        data.contactEmail || null,
        'pending'
      ];
      
      const appResult = await pgClient.query(applicationQuery, applicationValues);
      const applicationId = appResult.rows[0].id;
      
      // 2. Handle clergy information
      if (data.clergyName) {
        // Check if clergy exists
        const clergyCheck = await pgClient.query(
          'SELECT id FROM crouse_chapel.clergy WHERE name = $1',
          [data.clergyName]
        );
        
        let clergyId;
        if (clergyCheck.rows.length > 0) {
          clergyId = clergyCheck.rows[0].id;
        } else {
          // Insert new clergy
          const clergyInsert = await pgClient.query(
            `INSERT INTO crouse_chapel.clergy (name, denomination, address, phone, email, approved_status)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [data.clergyName, data.denomination || null, data.clergyAddress || null, 
             data.clergyPhone || null, data.clergyEmail || null, 'pending']
          );
          clergyId = clergyInsert.rows[0].id;
        }
        
        // Link clergy to service
        await pgClient.query(
          'INSERT INTO crouse_chapel.service_clergy (service_id, clergy_id) VALUES ($1, $2)',
          [applicationId, clergyId]
        );
      }
      
      // 3. Insert type-specific details
      if (formType === 'wedding') {
        const weddingQuery = `
          INSERT INTO crouse_chapel.wedding_details (
            application_id,
            couple_names,
            guest_count,
            bride_arrival_time,
            dressing_at_chapel,
            why_bay_view,
            is_member,
            wedding_fee
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `;
        
        const isMember = true; // All chapel users must be members or relatives
        const weddingFee = isMember ? 300.00 : 750.00;
        
        await pgClient.query(weddingQuery, [
          applicationId,
          data.coupleNames,
          parseInt(data.guestCount),
          data.brideArrival || null,
          data.dressingAtChapel === 'yes',
          data.whyBayView,
          isMember,
          weddingFee
        ]);
      } else {
        // Memorial/Funeral service
        const memorialQuery = `
          INSERT INTO crouse_chapel.memorial_details (
            application_id,
            deceased_name,
            memorial_garden_placement,
            placement_date,
            placement_time
          ) VALUES ($1, $2, $3, $4, $5)
        `;
        
        await pgClient.query(memorialQuery, [
          applicationId,
          data.deceasedName,
          data.memorialGarden === 'yes',
          data.placementDate || null,
          data.placementTime || null
        ]);
      }
      
      // 4. Insert music requirements
      if (data.hasMusic || data.needsPiano || data.needsOrgan) {
        const musicQuery = `
          INSERT INTO crouse_chapel.service_music (
            application_id,
            has_music,
            needs_piano,
            needs_organ,
            perform_sanctuary,
            perform_balcony,
            additional_chairs,
            chair_count,
            chair_placement
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `;
        
        await pgClient.query(musicQuery, [
          applicationId,
          data.hasMusic || false,
          data.needsPiano || false,
          data.needsOrgan || false,
          data.performSanctuary || false,
          data.performBalcony || false,
          data.additionalChairs || false,
          data.chairNumber ? parseInt(data.chairNumber) : null,
          data.chairPlacement || null
        ]);
      }
      
      // 5. Insert musicians
      if (data.musicians && data.musicians.length > 0) {
        for (const musician of data.musicians) {
          if (musician && musician.trim()) {
            await pgClient.query(
              'INSERT INTO crouse_chapel.service_musicians (application_id, musician_name) VALUES ($1, $2)',
              [applicationId, musician.trim()]
            );
          }
        }
      } else if (data.musicianNames) {
        // Handle textarea format (one per line)
        const musicians = data.musicianNames.split('\n').filter(m => m.trim());
        for (const musician of musicians) {
          await pgClient.query(
            'INSERT INTO crouse_chapel.service_musicians (application_id, musician_name) VALUES ($1, $2)',
            [applicationId, musician.trim()]
          );
        }
      }
      
      // 6. Insert equipment needs
      const equipmentQuery = `
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
      `;
      
      await pgClient.query(equipmentQuery, [
        applicationId,
        data.standMic || false,
        data.wirelessMic || false,
        data.cdPlayer || false,
        data.communion || false,
        data.guestBookStand || false,
        data.ropedSeating || false,
        data.rowsLeft ? parseInt(data.rowsLeft) : 0,
        data.rowsRight ? parseInt(data.rowsRight) : 0
      ]);
      
      // 7. Insert policy acknowledgment
      if (data.policyAgreement) {
        await pgClient.query(
          `INSERT INTO crouse_chapel.policy_acknowledgments 
           (application_id, policy_type, acknowledged, acknowledged_date, acknowledged_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [applicationId, formType + '_policies', true, new Date(), data.contactName]
        );
      }
      
      // 8. Check and mark chapel availability
      const serviceDate = data.weddingDate || data.serviceDate;
      const serviceTime = data.ceremonyTime || data.serviceTime;
      
      const availabilityCheck = await pgClient.query(
        'SELECT crouse_chapel.is_chapel_available($1, $2) as available',
        [serviceDate, serviceTime]
      );
      
      if (!availabilityCheck.rows[0].available) {
        throw new Error('Chapel is not available at the requested date and time');
      }
      
      // Mark as unavailable
      await pgClient.query(
        `INSERT INTO crouse_chapel.chapel_availability (date, time_slot, available, service_id)
         VALUES ($1, $2, false, $3)
         ON CONFLICT (date, time_slot) 
         DO UPDATE SET available = false, service_id = $3`,
        [serviceDate, serviceTime, applicationId]
      );
      
      // Commit transaction
      await pgClient.query('COMMIT');
      
      // 9. Save to Notion (optional, for workflow management)
      if (NOTION_API_KEY && NOTION_DATABASE_ID) {
        try {
          const notionProperties = {
            'Application ID': toNotionProperty(applicationId.toString(), 'title'),
            'Type': toNotionProperty(applicationType, 'select'),
            'Service Date': toNotionProperty(serviceDate, 'date'),
            'Service Time': toNotionProperty(serviceTime, 'rich_text'),
            'Contact Name': toNotionProperty(data.contactName, 'rich_text'),
            'Contact Email': toNotionProperty(data.contactEmail, 'email'),
            'Contact Phone': toNotionProperty(data.contactPhone, 'phone_number'),
            'Bay View Member': toNotionProperty(data.memberName, 'rich_text'),
            'Status': toNotionProperty('Pending', 'select'),
            'Submitted': toNotionProperty(new Date().toISOString(), 'date'),
            'Clergy Name': toNotionProperty(data.clergyName, 'rich_text'),
            'Clergy Email': toNotionProperty(data.clergyEmail, 'email'),
            'Clergy Phone': toNotionProperty(data.clergyPhone, 'phone_number'),
            'Database ID': toNotionProperty(applicationId.toString(), 'rich_text')
          };
          
          // Add type-specific fields
          if (formType === 'wedding') {
            notionProperties['Couple Names'] = toNotionProperty(data.coupleNames, 'rich_text');
            notionProperties['Guest Count'] = toNotionProperty(parseInt(data.guestCount), 'number');
            notionProperties['Wedding Fee'] = toNotionProperty(weddingFee, 'number');
            notionProperties['Bride Arrival Time'] = toNotionProperty(data.brideArrival, 'rich_text');
          } else {
            notionProperties['Deceased Name'] = toNotionProperty(data.deceasedName, 'rich_text');
            notionProperties['Memorial Garden Placement'] = toNotionProperty(data.memorialGarden === 'yes', 'checkbox');
          }
          
          // Add music fields
          if (data.hasMusic || data.needsPiano || data.needsOrgan) {
            notionProperties['Has Music'] = toNotionProperty(data.hasMusic || false, 'checkbox');
            notionProperties['Needs Piano'] = toNotionProperty(data.needsPiano || false, 'checkbox');
            notionProperties['Needs Organ'] = toNotionProperty(data.needsOrgan || false, 'checkbox');
          }
          
          // Add equipment fields
          notionProperties['Stand Microphone'] = toNotionProperty(data.standMic || false, 'checkbox');
          notionProperties['Wireless Microphone'] = toNotionProperty(data.wirelessMic || false, 'checkbox');
          notionProperties['CD Player'] = toNotionProperty(data.cdPlayer || false, 'checkbox');
          notionProperties['Communion Service'] = toNotionProperty(data.communion || false, 'checkbox');
          notionProperties['Guest Book Stand'] = toNotionProperty(data.guestBookStand || false, 'checkbox');
          notionProperties['Roped Seating'] = toNotionProperty(data.ropedSeating || false, 'checkbox');
          
          // Create the Notion page
          const notionPage = await createNotionPage(NOTION_DATABASE_ID, notionProperties);
          console.log('Successfully created Notion page:', notionPage.id);
        } catch (notionError) {
          console.error('Notion save failed:', notionError);
          // Don't fail the whole request if Notion fails
        }
      }
      
      return res.status(200).json({
        success: true,
        applicationId: applicationId,
        submissionDate: appResult.rows[0].submission_date,
        message: 'Application submitted successfully',
        nextSteps: [
          'Your application will be reviewed by the Director of Worship',
          'You will be contacted within 2-3 business days',
          'Full payment is required to secure your date',
          'Clergy must be approved before the service'
        ]
      });
      
    } catch (error) {
      await pgClient.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('Error processing chapel application:', error);
    return res.status(500).json({
      error: 'Failed to submit application',
      message: error.message
    });
  } finally {
    await pgClient.end();
  }
}