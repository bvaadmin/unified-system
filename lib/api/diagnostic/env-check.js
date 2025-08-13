// Diagnostic endpoint to check environment variables in Vercel
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Check which environment variables are set
  const envStatus = {
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL_ENV || 'unknown',
    hasNotionKey: !!process.env.NOTION_API_KEY,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasDatabaseUrlClean: !!process.env.DATABASE_URL_CLEAN,
    hasChapelNotionDb: !!process.env.CHAPEL_NOTION_DB_ID,
    hasMemorialNotionDb: !!process.env.MEMORIAL_NOTION_DB_ID,
    hasAdminToken: !!process.env.ADMIN_TOKEN,
    // Show partial database URL if it exists (hide password)
    databaseUrlPreview: process.env.DATABASE_URL ? 
      process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@').substring(0, 50) + '...' : 
      'not set',
    databaseUrlCleanPreview: process.env.DATABASE_URL_CLEAN ? 
      process.env.DATABASE_URL_CLEAN.replace(/:[^:@]+@/, ':****@').substring(0, 50) + '...' : 
      'not set',
    // List all env var keys (not values)
    allEnvKeys: Object.keys(process.env).filter(key => 
      !key.includes('SECRET') && 
      !key.includes('PASSWORD') && 
      !key.includes('KEY') &&
      !key.includes('TOKEN')
    ).sort()
  };

  return res.status(200).json(envStatus);
}