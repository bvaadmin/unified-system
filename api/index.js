// Unified API endpoint - handles all routes through a single function
// This solves Vercel's 12-function limit on hobby plan

// Import API handlers
import testDb from '../lib/handlers/test-db.js';
import chapelCheckAvailability from '../lib/handlers/chapel/check-availability.js';
import chapelSubmitService from '../lib/handlers/chapel/submit-service.js';
import fixChapelFunction from '../lib/handlers/admin/fix-chapel-function.js';
import memorialSubmitGarden from '../lib/api/memorial/submit-garden.js';
import health from '../lib/api/health.js';

// Route mapping
const routes = {
  // Chapel endpoints
  'GET /api/chapel/check-availability': chapelCheckAvailability,
  'POST /api/chapel/submit-service': chapelSubmitService,
  
  // Memorial garden endpoints
  'POST /api/memorial/submit-garden': memorialSubmitGarden,
  'OPTIONS /api/memorial/submit-garden': memorialSubmitGarden,
  
  // Admin endpoints
  'POST /api/admin/fix-chapel-function': fixChapelFunction,
  
  // Utility endpoints
  'GET /api/test-db': testDb,
  'GET /api/health': health,
  'OPTIONS /api/health': health,
};

export default async function handler(req, res) {
  // Enable CORS for all routes
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
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Extract path from URL
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  
  // Build route key
  const routeKey = `${req.method} ${path}`;
  
  // Find handler
  const handler = routes[routeKey];
  
  if (!handler) {
    // Try without trailing slash
    const routeKeyNoSlash = `${req.method} ${path.replace(/\/$/, '')}`;
    const handlerNoSlash = routes[routeKeyNoSlash];
    
    if (handlerNoSlash) {
      return handlerNoSlash(req, res);
    }
    
    return res.status(404).json({ 
      error: 'Not found',
      path: path,
      method: req.method,
      available_routes: Object.keys(routes)
    });
  }
  
  // Execute handler
  try {
    return await handler(req, res);
  } catch (error) {
    console.error(`Error in ${routeKey}:`, error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}