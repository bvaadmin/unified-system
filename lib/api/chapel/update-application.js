import { Client } from 'pg';

export default async function handler(req, res) {
  // Set CORS headers
  const allowedOrigins = [
    'https://bvaadmin.github.io',
    'https://vercel.com',
    'http://localhost:3000',
    'http://127.0.0.1:5500'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { applicationId } = req.query;
  const updates = req.body;
  
  if (!applicationId) {
    return res.status(400).json({ error: 'Application ID is required' });
  }

  const DATABASE_URL = process.env.DATABASE_URL_CLEAN || process.env.DATABASE_URL;
  
  const pgClient = new Client({
    connectionString: DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
  });

  try {
    await pgClient.connect();
    
    // Start transaction
    await pgClient.query('BEGIN');
    
    // Update main application
    if (updates.status || updates.approved_by || updates.date_fees_paid || updates.amount_paid) {
      const updateFields = [];
      const updateValues = [];
      let valueIndex = 1;
      
      if (updates.status) {
        updateFields.push(`status = $${valueIndex++}`);
        updateValues.push(updates.status);
      }
      
      if (updates.approved_by) {
        updateFields.push(`approved_by = $${valueIndex++}`);
        updateValues.push(updates.approved_by);
        updateFields.push(`approval_date = $${valueIndex++}`);
        updateValues.push(new Date());
      }
      
      if (updates.date_fees_paid) {
        updateFields.push(`date_fees_paid = $${valueIndex++}`);
        updateValues.push(updates.date_fees_paid);
      }
      
      if (updates.amount_paid) {
        updateFields.push(`amount_paid = $${valueIndex++}`);
        updateValues.push(updates.amount_paid);
      }
      
      if (updates.altar_guild_notified) {
        updateFields.push(`altar_guild_notified = $${valueIndex++}`);
        updateValues.push(updates.altar_guild_notified);
      }
      
      updateValues.push(applicationId);
      
      await pgClient.query(
        `UPDATE crouse_chapel.service_applications 
         SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE id = $${valueIndex}`,
        updateValues
      );
    }
    
    // If approved, send notifications
    if (updates.status === 'approved') {
      // Log altar guild notification
      await pgClient.query(
        `INSERT INTO crouse_chapel.notifications 
         (application_id, notification_type, recipient, sent_by, notes)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          applicationId,
          'altar_guild_notification',
          'Altar Guild Co-Chairs',
          updates.approved_by || 'System',
          'Service approved and scheduled'
        ]
      );
      
      // You could trigger actual email notifications here
      // await sendAltarGuildNotification(applicationId);
    }
    
    await pgClient.query('COMMIT');
    
    return res.status(200).json({
      success: true,
      message: 'Application updated successfully',
      applicationId: applicationId
    });
    
  } catch (error) {
    await pgClient.query('ROLLBACK');
    console.error('Error updating application:', error);
    return res.status(500).json({ error: 'Failed to update application' });
  } finally {
    await pgClient.end();
  }
}