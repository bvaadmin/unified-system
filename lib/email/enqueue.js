import { Client } from 'pg';

/**
 * Enqueue an email for sending
 * @param {Object} emailData - Email configuration
 * @param {string} emailData.to - Recipient email address
 * @param {string} emailData.subject - Email subject
 * @param {string} emailData.text - Plain text body
 * @param {string} [emailData.html] - HTML body (optional)
 * @param {string} [emailData.template] - Template name (optional)
 * @param {Object} [emailData.templateData] - Template variables (optional)
 * @param {number} [emailData.priority] - Priority 1-10 (default 5)
 * @param {Date} [emailData.scheduledFor] - When to send (default: now)
 * @returns {Promise<number>} Email queue ID
 */
export async function enqueueEmail(emailData) {
  const { DATABASE_URL } = process.env;
  
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL not configured');
  }

  const pgClient = new Client({
    connectionString: DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
  });

  try {
    await pgClient.connect();
    
    const result = await pgClient.query(
      `SELECT communications.enqueue_email($1, $2, $3, $4, $5, $6, $7, $8) as email_id`,
      [
        emailData.to,
        emailData.subject,
        emailData.text,
        emailData.html || null,
        emailData.template || null,
        emailData.templateData ? JSON.stringify(emailData.templateData) : null,
        emailData.priority || 5,
        emailData.scheduledFor || null
      ]
    );

    return result.rows[0].email_id;
  } finally {
    await pgClient.end();
  }
}

/**
 * Enqueue a chapel service notification email
 * @param {number} applicationId - Chapel application ID
 * @param {string} type - Notification type (received, approved, etc.)
 * @param {Object} data - Application data for template
 * @returns {Promise<number>} Email queue ID
 */
export async function enqueueChapelNotification(applicationId, type, data) {
  const templates = {
    received: 'chapel_application_received',
    approved: 'chapel_approval',
    rejected: 'chapel_rejection',
    payment_received: 'chapel_payment_received',
    reminder: 'chapel_service_reminder'
  };

  const templateName = templates[type];
  if (!templateName) {
    throw new Error(`Unknown chapel notification type: ${type}`);
  }

  // Format dates for template
  if (data.service_date) {
    data.service_date = new Date(data.service_date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  if (data.service_time) {
    data.service_time = new Date(`2000-01-01 ${data.service_time}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  // Set priority based on type
  const priorities = {
    received: 8,  // High priority for confirmations
    approved: 7,
    rejected: 7,
    payment_received: 6,
    reminder: 5
  };

  return await enqueueEmail({
    to: data.contact_email,
    subject: `Chapel Service - ${type}`,
    text: `Chapel service notification for application #${applicationId}`,
    template: templateName,
    templateData: {
      ...data,
      application_id: applicationId
    },
    priority: priorities[type] || 5
  });
}

/**
 * Enqueue a memorial garden notification email
 * @param {string} submissionId - Memorial submission ID
 * @param {string} type - Notification type (received, approved, etc.)
 * @param {Object} data - Submission data for template
 * @returns {Promise<number>} Email queue ID
 */
export async function enqueueMemorialNotification(submissionId, type, data) {
  const templates = {
    received: 'memorial_garden_received',
    approved: 'memorial_garden_approved',
    info_needed: 'memorial_garden_info_needed'
  };

  const templateName = templates[type];
  if (!templateName) {
    throw new Error(`Unknown memorial notification type: ${type}`);
  }

  return await enqueueEmail({
    to: data.contact_email,
    subject: 'Memorial Garden Application',
    text: `Memorial garden notification for submission ${submissionId}`,
    template: templateName,
    templateData: {
      ...data,
      submission_id: submissionId
    },
    priority: type === 'received' ? 8 : 6
  });
}