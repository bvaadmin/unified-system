// Use prepayment endpoint
// POST /api/memorial/use-prepayment
// Links a prepayment to an actual memorial application

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
  
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const DATABASE_URL = process.env.DATABASE_URL_CLEAN || process.env.DATABASE_URL;
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
  
  if (!DATABASE_URL) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  // Check authorization (optional - remove if not needed)
  const authHeader = req.headers.authorization;
  if (ADMIN_TOKEN && authHeader !== `Bearer ${ADMIN_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { 
    prepaymentSubmissionId, 
    memorialId,
    personName,
    notes 
  } = req.body;
  
  if (!prepaymentSubmissionId || !memorialId) {
    return res.status(400).json({ 
      error: 'Missing required parameters',
      message: 'Both prepaymentSubmissionId and memorialId are required'
    });
  }

  const pgClient = new Client({
    connectionString: DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
  });

  try {
    await pgClient.connect();
    console.log('Connected to database for prepayment usage');
    
    // Start transaction
    await pgClient.query('BEGIN');
    
    // 1. Get prepayment details
    const prepaymentQuery = `
      SELECT 
        id,
        placement_type,
        person1_name,
        person2_name,
        status,
        placements_used,
        linked_memorial_id1,
        linked_memorial_id2,
        CASE 
          WHEN placement_type IN ('self_and_other', 'two_others') THEN 2
          ELSE 1
        END as max_placements
      FROM bayview.prepayments
      WHERE submission_id = $1
      FOR UPDATE
    `;
    
    const prepaymentResult = await pgClient.query(prepaymentQuery, [prepaymentSubmissionId]);
    
    if (prepaymentResult.rows.length === 0) {
      await pgClient.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Prepayment not found',
        message: `No prepayment found with submission ID: ${prepaymentSubmissionId}`
      });
    }
    
    const prepayment = prepaymentResult.rows[0];
    
    // 2. Check if prepayment can be used
    if (prepayment.status === 'cancelled' || prepayment.status === 'refunded') {
      await pgClient.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Prepayment not available',
        message: `This prepayment has been ${prepayment.status}`
      });
    }
    
    if (prepayment.placements_used >= prepayment.max_placements) {
      await pgClient.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'No placements available',
        message: 'All placements from this prepayment have been used'
      });
    }
    
    // 3. Verify memorial record exists
    const memorialCheck = await pgClient.query(
      'SELECT id, first_name, last_name FROM bayview.memorials WHERE id = $1',
      [memorialId]
    );
    
    if (memorialCheck.rows.length === 0) {
      await pgClient.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Memorial record not found',
        message: `No memorial record found with ID: ${memorialId}`
      });
    }
    
    const memorial = memorialCheck.rows[0];
    
    // 4. Update prepayment record
    const newPlacementsUsed = prepayment.placements_used + 1;
    const newStatus = newPlacementsUsed >= prepayment.max_placements ? 'fully_used' : 'partially_used';
    
    const updateQuery = `
      UPDATE bayview.prepayments
      SET 
        placements_used = $1,
        status = $2,
        linked_memorial_id1 = CASE 
          WHEN linked_memorial_id1 IS NULL THEN $3 
          ELSE linked_memorial_id1 
        END,
        linked_memorial_id2 = CASE 
          WHEN linked_memorial_id1 IS NOT NULL AND linked_memorial_id2 IS NULL THEN $3 
          ELSE linked_memorial_id2 
        END,
        first_use_date = CASE 
          WHEN first_use_date IS NULL THEN CURRENT_DATE 
          ELSE first_use_date 
        END,
        second_use_date = CASE 
          WHEN first_use_date IS NOT NULL AND second_use_date IS NULL THEN CURRENT_DATE 
          ELSE second_use_date 
        END,
        notes = CASE 
          WHEN $4 IS NOT NULL THEN COALESCE(notes || E'\\n', '') || $4
          ELSE notes
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `;
    
    const usageNote = notes || `Used for memorial ID ${memorialId} (${memorial.first_name} ${memorial.last_name}) on ${new Date().toISOString().split('T')[0]}`;
    
    const updateResult = await pgClient.query(updateQuery, [
      newPlacementsUsed,
      newStatus,
      memorialId,
      usageNote,
      prepayment.id
    ]);
    
    // 5. Update memorial record to note prepayment usage
    await pgClient.query(
      `UPDATE bayview.memorials 
       SET 
         prepayment_used = true,
         prepayment_submission_id = $1,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [prepaymentSubmissionId, memorialId]
    );
    
    // Commit transaction
    await pgClient.query('COMMIT');
    
    const updatedPrepayment = updateResult.rows[0];
    
    return res.status(200).json({
      success: true,
      message: 'Prepayment successfully applied to memorial record',
      prepayment: {
        submissionId: prepaymentSubmissionId,
        status: updatedPrepayment.status,
        placementsUsed: updatedPrepayment.placements_used,
        placementsRemaining: updatedPrepayment.max_placements - updatedPrepayment.placements_used,
        linkedMemorials: [
          updatedPrepayment.linked_memorial_id1,
          updatedPrepayment.linked_memorial_id2
        ].filter(Boolean)
      },
      memorial: {
        id: memorialId,
        name: `${memorial.first_name} ${memorial.last_name}`
      }
    });
    
  } catch (error) {
    // Rollback on error
    try {
      await pgClient.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback error:', rollbackError);
    }
    
    console.error('Prepayment usage error:', error);
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