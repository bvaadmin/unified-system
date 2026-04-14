// Email batch processor - processes queued emails via SendGrid
// Called by Vercel cron (vercel.json: daily at midnight) and can be triggered manually

import { Client } from 'pg';
import sgMail from '@sendgrid/mail';

export default async function handler(req, res) {
  // Accept both GET (cron) and POST (manual trigger)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const DATABASE_URL = process.env.DATABASE_URL;
  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

  if (!DATABASE_URL) {
    return res.status(500).json({ error: 'DATABASE_URL not configured' });
  }

  if (!SENDGRID_API_KEY) {
    return res.status(500).json({ error: 'SENDGRID_API_KEY not configured' });
  }

  sgMail.setApiKey(SENDGRID_API_KEY);

  const batchSize = (req.body && req.body.batchSize) || 10;
  const pgClient = new Client({
    connectionString: DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
  });

  const results = { processed: 0, sent: 0, failed: 0, errors: [] };

  try {
    await pgClient.connect();

    // Fetch pending emails (atomically marks them as 'sending')
    const pendingResult = await pgClient.query(
      'SELECT * FROM communications.fetch_pending_emails($1)',
      [batchSize]
    );

    const emails = pendingResult.rows;
    results.processed = emails.length;

    if (emails.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No pending emails',
        results
      });
    }

    for (const email of emails) {
      try {
        const msg = {
          to: email.to_email,
          from: {
            email: 'worshipservices@bayviewassociation.org',
            name: 'Bay View Association'
          },
          subject: email.subject,
          text: email.text_body,
          html: email.html_body || undefined,
          trackingSettings: {
            clickTracking: { enable: false },
            openTracking: { enable: false }
          }
        };

        await sgMail.send(msg);
        await pgClient.query(
          'SELECT communications.mark_email_sent($1)',
          [email.id]
        );
        results.sent++;
        console.log(`Email sent: ${email.id} -> ${email.to_email}`);
      } catch (sendError) {
        const errorMsg = sendError.response
          ? JSON.stringify(sendError.response.body)
          : sendError.message;

        await pgClient.query(
          'SELECT communications.mark_email_failed($1, $2)',
          [email.id, errorMsg]
        );
        results.failed++;
        results.errors.push({ id: email.id, to: email.to_email, error: errorMsg });
        console.error(`Email failed: ${email.id} -> ${email.to_email}:`, errorMsg);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Processed ${results.processed} emails`,
      results
    });
  } catch (error) {
    console.error('Email batch processing error:', error);
    return res.status(500).json({
      error: 'Email batch processing failed',
      message: error.message
    });
  } finally {
    try {
      await pgClient.end();
    } catch (e) {
      console.error('Error closing connection:', e);
    }
  }
}
