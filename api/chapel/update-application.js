import { withPooledTransaction } from '../../lib/db.js';
import { applyCors } from '../../lib/cors.js';

export default async function handler(req, res) {
  // Apply CORS
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { applicationId } = req.query;
  if (!applicationId) {
    return res.status(400).json({ error: 'Application ID is required' });
  }

  try {
    const updateData = req.body;
    
    await withPooledTransaction(async (pgClient) => {
      // Update main application
      if (updateData.status) {
        await pgClient.query(
          `UPDATE crouse_chapel.service_applications 
           SET status = $1, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $2`,
          [updateData.status, applicationId]
        );
      }
      
      // Update approval information
      if (updateData.approved_by) {
        await pgClient.query(
          `UPDATE crouse_chapel.service_applications 
           SET approved_by = $1, approved_date = $2, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $3`,
          [updateData.approved_by, updateData.approved_date || new Date(), applicationId]
        );
      }
      
      // Update payment information
      if (updateData.payment_received !== undefined) {
        await pgClient.query(
          `UPDATE crouse_chapel.service_applications 
           SET payment_received = $1, payment_date = $2, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $3`,
          [updateData.payment_received, updateData.payment_date, applicationId]
        );
      }
      
      // Handle clergy approval
      if (updateData.clergy_approved !== undefined) {
        const clergyResult = await pgClient.query(
          `SELECT c.id FROM crouse_chapel.clergy c
           JOIN crouse_chapel.service_clergy sc ON c.id = sc.clergy_id
           WHERE sc.service_id = $1`,
          [applicationId]
        );
        
        if (clergyResult.rows.length > 0) {
          await pgClient.query(
            `UPDATE crouse_chapel.clergy 
             SET approved_status = $1, approved_date = $2, approved_by = $3
             WHERE id = $4`,
            [
              updateData.clergy_approved ? 'approved' : 'rejected',
              new Date(),
              updateData.approved_by,
              clergyResult.rows[0].id
            ]
          );
        }
      }
      
      // Log notification if altar guild needs to be notified
      if (updateData.notify_altar_guild && updateData.status === 'approved') {
        await pgClient.query(
          `INSERT INTO crouse_chapel.notifications 
           (service_id, notification_type, recipient, message, created_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
          [
            applicationId,
            'altar_guild_notification',
            'altar_guild@bayviewassociation.org',
            `Service approved for application ${applicationId} - please prepare chapel`
          ]
        );
      }
    }).then(() => {
      return res.status(200).json({
        success: true,
        message: 'Application updated successfully',
        applicationId: parseInt(applicationId)
      });
    }).catch(async (error) => {
      console.error('Error updating application:', error);
      return res.status(500).json({ error: 'Failed to update application' });
    });
    
  } catch (error) {
    console.error('Update application error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
