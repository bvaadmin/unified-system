// Verify prepayment endpoint
// GET /api/memorial/verify-prepayment?submissionId=MG-123456789

import { Client } from 'pg';

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
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only accept GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const DATABASE_URL = process.env.DATABASE_URL_CLEAN || process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  // Get submission ID from query params
  const { submissionId, purchaserPhone, purchaserEmail } = req.query || {};
  
  if (!submissionId && !purchaserPhone && !purchaserEmail) {
    return res.status(400).json({ 
      error: 'Missing required parameter',
      message: 'Please provide submissionId, purchaserPhone, or purchaserEmail'
    });
  }

  const pgClient = new Client({
    connectionString: DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
  });

  try {
    await pgClient.connect();
    console.log('Connected to database for prepayment verification');
    
    // Build query based on provided parameters
    let query = `
      SELECT 
        submission_id,
        placement_type,
        person1_name,
        person2_name,
        purchaser_name,
        purchaser_phone,
        purchaser_email,
        is_member,
        sponsor_member_name,
        amount_paid,
        payment_date,
        status,
        placements_used,
        CASE 
          WHEN placement_type IN ('self_and_other', 'two_others') THEN 2 - placements_used
          ELSE 1 - placements_used
        END as placements_available,
        created_at,
        notes
      FROM bayview.prepayments
      WHERE 1=1
    `;
    
    const values = [];
    let paramCount = 0;
    
    if (submissionId) {
      paramCount++;
      query += ` AND submission_id = $${paramCount}`;
      values.push(submissionId);
    }
    
    if (purchaserPhone) {
      paramCount++;
      query += ` AND purchaser_phone = $${paramCount}`;
      values.push(purchaserPhone);
    }
    
    if (purchaserEmail) {
      paramCount++;
      query += ` AND LOWER(purchaser_email) = LOWER($${paramCount})`;
      values.push(purchaserEmail);
    }
    
    query += ' ORDER BY created_at DESC LIMIT 10';
    
    const result = await pgClient.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No prepayment found with the provided information'
      });
    }
    
    // Return prepayment details
    const prepayments = result.rows.map(row => ({
      submissionId: row.submission_id,
      status: row.status,
      placementType: row.placement_type,
      placementsAvailable: row.placements_available,
      placementsUsed: row.placements_used,
      personsCovered: [row.person1_name, row.person2_name].filter(Boolean),
      purchaser: {
        name: row.purchaser_name,
        phone: row.purchaser_phone,
        email: row.purchaser_email,
        isMember: row.is_member,
        sponsorMember: row.sponsor_member_name
      },
      payment: {
        amount: parseFloat(row.amount_paid),
        date: row.payment_date,
        submitted: row.created_at
      },
      notes: row.notes
    }));
    
    return res.status(200).json({
      success: true,
      count: prepayments.length,
      prepayments: prepayments
    });
    
  } catch (error) {
    console.error('Prepayment verification error:', error);
    return res.status(500).json({
      error: 'Internal server error',
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