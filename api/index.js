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
import testDb from '../lib/handlers/test-db.js';
import chapelCheckAvailability from '../lib/handlers/chapel/check-availability.js';
import chapelSubmitService from '../lib/handlers/chapel/submit-service.js';
import fixChapelFunction from '../lib/handlers/admin/fix-chapel-function.js';
import memorialSubmitGarden from '../lib/api/memorial/submit-garden.js';
import verifyPrepayment from '../lib/api/memorial/verify-prepayment.js';
import usePrepayment from '../lib/api/memorial/use-prepayment.js';
import health from '../lib/api/health.js';
import oracleHealth from '../lib/api/diagnostic/oracle-health.js';
import checkDbUrl from './diagnostic/check-db-url.js';
import envCheck from '../lib/api/diagnostic/env-check.js';
import testPg from '../lib/api/diagnostic/test-pg.js';
import oracleSelftest from '../lib/api/diagnostic/oracle-selftest.js';
import oraclePing from '../lib/api/diagnostic/oracle-ping.js';

// Route mapping - ALL API endpoints must be defined here
// Format: 'METHOD /path': handlerFunction
const routes = {
  // Chapel endpoints
  'GET /api/chapel/check-availability': chapelCheckAvailability,
  'OPTIONS /api/chapel/check-availability': chapelCheckAvailability,
  'POST /api/chapel/submit-service': chapelSubmitService,
  'OPTIONS /api/chapel/submit-service': chapelSubmitService,

  // Memorial garden endpoints
  'POST /api/memorial/submit-garden': memorialSubmitGarden,
  'OPTIONS /api/memorial/submit-garden': memorialSubmitGarden,
  'GET /api/memorial/verify-prepayment': verifyPrepayment,
  'OPTIONS /api/memorial/verify-prepayment': verifyPrepayment,
  'POST /api/memorial/use-prepayment': usePrepayment,
  'OPTIONS /api/memorial/use-prepayment': usePrepayment,
  
  // Admin endpoints
  'POST /api/admin/fix-chapel-function': fixChapelFunction,
  
  // Utility endpoints
  'GET /api/test-db': testDb,
  'GET /api/health': health,
  'OPTIONS /api/health': health,
  'GET /api/diagnostic/check-db-url': checkDbUrl,
  'GET /api/diagnostic/env-check': envCheck,
  'GET /api/diagnostic/test-pg': testPg,
  'GET /api/diagnostic/oracle-health': oracleHealth,
  'OPTIONS /api/diagnostic/oracle-health': oracleHealth,
  'POST /api/diagnostic/oracle-selftest': oracleSelftest,
  'OPTIONS /api/diagnostic/oracle-selftest': oracleSelftest,
  'GET /api/diagnostic/oracle-ping': oraclePing,
  'OPTIONS /api/diagnostic/oracle-ping': oraclePing,
  
  // Temporary deployment test
  'GET /api/deployment-test': (req, res) => {
    return res.status(200).json({
      message: 'Direct deployment test',
      timestamp: new Date().toISOString(),
      version: '2025-08-06-21:50-direct',
      hasCleanUrl: !!process.env.DATABASE_URL_CLEAN
    });
  }
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
