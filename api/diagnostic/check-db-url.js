export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const dbUrl = process.env.DATABASE_URL || 'Not set';
  const cleanDbUrl = process.env.DATABASE_URL_CLEAN || 'Not set';
  
  // Mask sensitive parts but show which database is being used
  const maskUrl = (url) => {
    if (url === 'Not set') return url;
    if (url.includes('bayview-association-clean')) {
      return 'Using CLEAN database (bayview-association-clean)';
    } else if (url.includes('bayview-association-db')) {
      return 'Using OLD database (bayview-association-db)';
    }
    return 'Unknown database';
  };
  
  return res.status(200).json({
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown',
    databaseUrl: maskUrl(dbUrl),
    databaseUrlClean: maskUrl(cleanDbUrl),
    usingCleanDb: dbUrl.includes('clean'),
    message: dbUrl.includes('clean') ? 
      '✅ Using the new clean database' : 
      '❌ Still using the old database - Vercel env needs update'
  });
}