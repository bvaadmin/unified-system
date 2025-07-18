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

  const { month, year } = req.query;
  
  const DATABASE_URL = process.env.DATABASE_URL_CLEAN || process.env.DATABASE_URL;
  
  const pgClient = new Client({
    connectionString: DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
  });

  try {
    await pgClient.connect();
    
    // Get all services for the month
    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    
    const result = await pgClient.query(
      `SELECT 
        sa.id,
        sa.service_date,
        sa.service_time,
        sa.application_type,
        sa.status,
        CASE 
          WHEN sa.application_type = 'wedding' THEN wd.couple_names
          WHEN sa.application_type IN ('memorial', 'funeral') THEN md.deceased_name
          ELSE sa.contact_name
        END as service_for,
        c.name as clergy_name
      FROM crouse_chapel.service_applications sa
      LEFT JOIN crouse_chapel.wedding_details wd ON sa.id = wd.application_id
      LEFT JOIN crouse_chapel.memorial_details md ON sa.id = md.application_id
      LEFT JOIN crouse_chapel.service_clergy sc ON sa.id = sc.service_id
      LEFT JOIN crouse_chapel.clergy c ON sc.clergy_id = c.id
      WHERE sa.service_date BETWEEN $1 AND $2
      AND sa.status IN ('approved', 'pending')
      ORDER BY sa.service_date, sa.service_time`,
      [startDate, endDate]
    );
    
    // Get blackout dates for the month
    const blackoutResult = await pgClient.query(
      `SELECT * FROM crouse_chapel.blackout_dates
       WHERE (start_date <= $2 AND end_date >= $1)`,
      [startDate, endDate]
    );
    
    // Format as calendar events
    const events = result.rows.map(row => ({
      id: row.id,
      date: row.service_date,
      time: row.service_time,
      type: row.application_type,
      title: `${row.application_type}: ${row.service_for}`,
      status: row.status,
      clergy: row.clergy_name
    }));
    
    const blackouts = blackoutResult.rows.map(row => ({
      startDate: row.start_date,
      endDate: row.end_date,
      reason: row.reason,
      type: 'blackout'
    }));
    
    return res.status(200).json({
      success: true,
      month: month,
      year: year,
      events: events,
      blackouts: blackouts
    });
    
  } catch (error) {
    console.error('Error retrieving calendar:', error);
    return res.status(500).json({ error: 'Failed to retrieve calendar' });
  } finally {
    await pgClient.end();
  }
}