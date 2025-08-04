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
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { 
    type, 
    status, 
    startDate, 
    endDate, 
    applicationId 
  } = req.query;

  const DATABASE_URL = process.env.DATABASE_URL_CLEAN || process.env.DATABASE_URL;
  
  const pgClient = new Client({
    connectionString: DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
  });

  try {
    await pgClient.connect();
    
    let query = `
      SELECT 
        sa.*,
        c.name as clergy_name,
        c.denomination,
        json_build_object(
          'has_music', sm.has_music,
          'needs_piano', sm.needs_piano,
          'needs_organ', sm.needs_organ,
          'musicians', (
            SELECT json_agg(musician_name) 
            FROM crouse_chapel.service_musicians 
            WHERE application_id = sa.id
          )
        ) as music_details,
        json_build_object(
          'stand_microphone', se.stand_microphone,
          'wireless_microphone', se.wireless_microphone,
          'cd_player', se.cd_player,
          'communion_service', se.communion_service,
          'guest_book_stand', se.guest_book_stand,
          'roped_seating', se.roped_seating,
          'rows_left', se.rows_left,
          'rows_right', se.rows_right
        ) as equipment_details
      FROM crouse_chapel.service_applications sa
      LEFT JOIN crouse_chapel.service_clergy sc ON sa.id = sc.service_id
      LEFT JOIN crouse_chapel.clergy c ON sc.clergy_id = c.id
      LEFT JOIN crouse_chapel.service_music sm ON sa.id = sm.application_id
      LEFT JOIN crouse_chapel.service_equipment se ON sa.id = se.application_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;
    
    // Add filters
    if (applicationId) {
      query += ` AND sa.id = $${++paramCount}`;
      params.push(applicationId);
    }
    
    if (type) {
      query += ` AND sa.application_type = $${++paramCount}`;
      params.push(type);
    }
    
    if (status) {
      query += ` AND sa.status = $${++paramCount}`;
      params.push(status);
    }
    
    if (startDate) {
      query += ` AND sa.service_date >= $${++paramCount}`;
      params.push(startDate);
    }
    
    if (endDate) {
      query += ` AND sa.service_date <= $${++paramCount}`;
      params.push(endDate);
    }
    
    query += ' ORDER BY sa.service_date, sa.service_time';
    
    const result = await pgClient.query(query, params);
    
    // Add type-specific details
    for (let app of result.rows) {
      if (app.application_type === 'wedding') {
        const weddingDetails = await pgClient.query(
          'SELECT * FROM crouse_chapel.wedding_details WHERE application_id = $1',
          [app.id]
        );
        app.wedding_details = weddingDetails.rows[0] || null;
      } else if (['memorial', 'funeral'].includes(app.application_type)) {
        const memorialDetails = await pgClient.query(
          'SELECT * FROM crouse_chapel.memorial_details WHERE application_id = $1',
          [app.id]
        );
        app.memorial_details = memorialDetails.rows[0] || null;
      }
    }
    
    return res.status(200).json({
      success: true,
      count: result.rows.length,
      applications: result.rows
    });
    
  } catch (error) {
    console.error('Error retrieving applications:', error);
    return res.status(500).json({ error: 'Failed to retrieve applications' });
  } finally {
    await pgClient.end();
  }
}