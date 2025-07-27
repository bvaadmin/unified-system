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

  const { date, time } = req.query;
  
  if (!date || !time) {
    return res.status(400).json({ error: 'Date and time are required' });
  }

  const DATABASE_URL = process.env.DATABASE_URL_CLEAN || process.env.DATABASE_URL;
  
  const pgClient = new Client({
    connectionString: DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
  });

  try {
    await pgClient.connect();
    
    // Check if date/time is available (with default event type)
    const availabilityResult = await pgClient.query(
      'SELECT crouse_chapel.is_chapel_available($1, $2, $3) as available',
      [date, time, 'general']
    );
    
    const isAvailable = availabilityResult.rows[0].available;
    
    // Get existing bookings for that day
    const bookingsResult = await pgClient.query(
      `SELECT 
        sa.service_time,
        sa.application_type,
        CASE 
          WHEN sa.application_type = 'wedding' THEN wd.couple_names
          WHEN sa.application_type IN ('memorial', 'funeral') THEN md.deceased_name
          ELSE sa.contact_name
        END as service_for
      FROM crouse_chapel.service_applications sa
      LEFT JOIN crouse_chapel.wedding_details wd ON sa.id = wd.application_id
      LEFT JOIN crouse_chapel.memorial_details md ON sa.id = md.application_id
      WHERE sa.service_date = $1 
      AND sa.status IN ('approved', 'pending')
      ORDER BY sa.service_time`,
      [date]
    );
    
    return res.status(200).json({
      available: isAvailable,
      date: date,
      time: time,
      existingBookings: bookingsResult.rows,
      suggestedTimes: getSuggestedTimes(date, bookingsResult.rows)
    });
    
  } catch (error) {
    console.error('Error checking availability:', error);
    return res.status(500).json({ error: 'Failed to check availability' });
  } finally {
    await pgClient.end();
  }
}

// Helper function to suggest available times
function getSuggestedTimes(date, existingBookings) {
  const commonTimes = ['10:00', '11:00', '14:00', '15:00', '16:00'];
  const bookedTimes = existingBookings.map(b => b.service_time);
  
  return commonTimes.filter(time => {
    // Check if time is not already booked
    const isBooked = bookedTimes.some(booked => {
      const bookedHour = parseInt(booked.split(':')[0]);
      const checkHour = parseInt(time.split(':')[0]);
      // Don't suggest times within 2 hours of existing bookings
      return Math.abs(bookedHour - checkHour) < 2;
    });
    return !isBooked;
  });
}