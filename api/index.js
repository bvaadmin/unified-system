/**
 * UNIFIED API ROUTER - DO NOT CREATE NEW FILES IN /api DIRECTORY!
 * 
 * This is the ONLY serverless function deployed to Vercel.
 * All API endpoints are routed through this single file to stay within
 * Vercel's hobby plan limit of 12 functions.
 * 
 * TO ADD A NEW ENDPOINT:
 * 1. Create your handler in /lib/api/
 * 2. Import it below
 * 3. Add it to the routes object
 * 
 * See API-ARCHITECTURE.md for detailed instructions.
 */

// Import API handlers
import chapelSubmitService from '../lib/handlers/chapel/submit-service.js';
import memorialSubmitGarden from '../lib/api/memorial/submit-garden.js';
import preacherSubmitRecommendation from '../lib/api/preachers/submit-recommendation.js';
import health from '../lib/api/health.js';

// Route mapping - ALL API endpoints must be defined here
// Format: 'METHOD /path': handlerFunction
const routes = {
  'POST /api/chapel/submit-service': chapelSubmitService,
  'POST /api/memorial/submit-garden': memorialSubmitGarden,
  'POST /api/preachers/submit-recommendation': preacherSubmitRecommendation,
  'GET /api/health': health
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
