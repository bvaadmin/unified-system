import { Client } from 'pg';
import sgMail from '@sendgrid/mail';

export const maxDuration = 10;

export default async function handler(req, res) {
  // Apply CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Optional admin token protection
  const authHeader = req.headers.authorization;
  if (process.env.REQUIRE_EMAIL_AUTH === 'true') {
    if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_TOKEN}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const { DATABASE_URL, SENDGRID_API_KEY } = process.env;

  if (!DATABASE_URL || !SENDGRID_API_KEY) {
    return res.status(500).json({ error: 'Missing configuration' });
  }

  // Initialize SendGrid
  sgMail.setApiKey(SENDGRID_API_KEY);

  const pgClient = new Client({
    connectionString: DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
  });

  try {
    await pgClient.connect();
    
    // Get batch of emails to send (default 10)
    const batchSize = req.body?.batchSize || 10;
    
    const emailBatch = await pgClient.query(
      'SELECT * FROM communications.get_email_batch($1)',
      [batchSize]
    );

    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      errors: []
    };

    // Process each email
    for (const email of emailBatch.rows) {
      results.processed++;
      
      try {
        // Apply template if specified
        let subject = email.subject;
        let text = email.body_text;
        let html = email.body_html;

        if (email.template_name && email.template_data) {
          const templateResult = await pgClient.query(
            'SELECT * FROM communications.email_templates WHERE name = $1',
            [email.template_name]
          );

          if (templateResult.rows.length > 0) {
            const template = templateResult.rows[0];
            const data = email.template_data;

            // Simple template replacement
            subject = replaceTemplateVars(template.subject_template, data);
            text = replaceTemplateVars(template.body_text_template, data);
            if (template.body_html_template) {
              html = replaceTemplateVars(template.body_html_template, data);
            }
          }
        }

        // Construct SendGrid message
        const msg = {
          to: email.to_email,
          from: email.from_email || 'noreply@bayviewassociation.org',
          subject: subject,
          text: text
        };

        if (html) {
          msg.html = html;
        }

        if (email.cc_email) {
          msg.cc = email.cc_email;
        }

        if (email.bcc_email) {
          msg.bcc = email.bcc_email;
        }

        if (email.reply_to) {
          msg.replyTo = email.reply_to;
        }

        // Send email via SendGrid
        await sgMail.send(msg);

        // Mark as sent
        await pgClient.query(
          'SELECT communications.mark_email_sent($1)',
          [email.id]
        );

        results.sent++;

      } catch (error) {
        console.error(`Failed to send email ${email.id}:`, error);
        
        // Mark as failed with retry logic
        await pgClient.query(
          'SELECT communications.mark_email_failed($1, $2)',
          [email.id, error.message || 'Unknown error']
        );

        results.failed++;
        results.errors.push({
          emailId: email.id,
          to: email.to_email,
          error: error.message
        });
      }
    }

    return res.status(200).json({
      success: true,
      results: results,
      message: `Processed ${results.processed} emails: ${results.sent} sent, ${results.failed} failed`
    });

  } catch (error) {
    console.error('Email batch processing error:', error);
    return res.status(500).json({
      error: 'Failed to process email batch',
      message: error.message
    });
  } finally {
    await pgClient.end();
  }
}

// Helper function for template variable replacement
function replaceTemplateVars(template, data) {
  let result = template;
  
  // Replace {{variable}} with data values
  Object.keys(data).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, data[key] || '');
  });
  
  return result;
}