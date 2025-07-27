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

  const DATABASE_URL = process.env.DATABASE_URL_CLEAN || process.env.DATABASE_URL;
  
  const pgClient = new Client({
    connectionString: DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Client created successfully');
    
    await pgClient.connect();
    console.log('Connection successful');
    
    const result = await pgClient.query('SELECT 1 as test');
    console.log('Query successful');
    
    // Check if our schema exists
    const schemaResult = await pgClient.query(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'bayview';"
    );
    
    const schemaExists = schemaResult.rows.length > 0;
    console.log(`Schema exists: ${schemaExists}`);
    
    // Get memorial count
    let memorialCount = 0;
    if (schemaExists) {
      const countResult = await pgClient.query('SELECT COUNT(*) as count FROM bayview.memorials');
      memorialCount = parseInt(countResult.rows[0].count);
      console.log(`Memorial records: ${memorialCount}`);
    }
    
    await pgClient.end();
    console.log('Connection closed');
    
    res.status(200).json({
      success: true,
      message: 'Database connection successful',
      timestamp: new Date().toISOString(),
      test: result.rows[0],
      schema_exists: schemaExists,
      memorial_count: memorialCount
    });
    
  } catch (error) {
    console.error('Database error:', error);
    
    await pgClient.end().catch(() => {});
    
    res.status(500).json({
      success: false,
      error: 'Database connection failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}