export default function handler(req, res) {
  res.status(200).json({
    message: 'Deployment test endpoint',
    timestamp: new Date().toISOString(),
    version: '2025-08-13-17:45-minimal-db',
    environment: {
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasDatabaseUrlClean: !!process.env.DATABASE_URL_CLEAN,
      nodeVersion: process.version
    }
  });
}