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
      
      return applicationId;
    });

    return res.status(200).json({
      success: true,
      applicationId: applicationId,
      submissionDate: new Date().toISOString(),
      message: 'Application submitted successfully'
    });
    
  } catch (error) {
    console.error('Error submitting application:', error);
    return res.status(500).json({ 
      error: 'Failed to submit application',
      message: error.message 
    });
  }
}
