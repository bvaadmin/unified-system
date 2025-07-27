import { Client } from 'pg';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Simple auth check
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const DATABASE_URL = process.env.DATABASE_URL_CLEAN || process.env.DATABASE_URL;
  
  const client = new Client({
    connectionString: DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // Create the 3-parameter function
    await client.query(`
      CREATE OR REPLACE FUNCTION crouse_chapel.is_chapel_available(check_date DATE, check_time TIME, event_type VARCHAR DEFAULT 'wedding')
      RETURNS BOOLEAN AS $$
      BEGIN
        RETURN NOT EXISTS (
          SELECT 1 
          FROM crouse_chapel.service_applications sa
          WHERE sa.service_date = check_date
          AND ABS(EXTRACT(EPOCH FROM (sa.service_time - check_time))) < 7200
          AND sa.status IN ('approved', 'pending')
        );
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    await client.end();
    
    return res.status(200).json({
      success: true,
      message: 'Chapel availability function updated successfully'
    });
    
  } catch (error) {
    console.error('Error fixing chapel function:', error);
    await client.end();
    return res.status(500).json({
      error: 'Failed to fix chapel function',
      message: error.message
    });
  }
}