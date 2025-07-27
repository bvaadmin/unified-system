import { withPooledConnection } from '../../db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await withPooledConnection(async (client) => {
      // Fix the chapel availability function to use 3 parameters
      await client.query(`
        CREATE OR REPLACE FUNCTION crouse_chapel.is_chapel_available(
          check_date DATE, 
          check_time TIME, 
          event_type VARCHAR DEFAULT 'wedding'
        )
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
      
      return { success: true, message: 'Function updated successfully' };
    });
    
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('Fix availability function error:', error);
    return res.status(500).json({
      error: 'Failed to fix availability function',
      message: error.message
    });
  }
}
