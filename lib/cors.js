/**
 * Allowed origins for CORS
 */
export const ALLOWED_ORIGINS = [
  'https://bvaadmin.github.io',
  'https://vercel.com',
  'http://localhost:3000',
  'http://127.0.0.1:5500'
];

/**
 * Apply CORS headers to a response
 * @param {Request} req - The request object
 * @param {Response} res - The response object
 * @param {string[]} methods - Allowed HTTP methods
 */
export function applyCors(req, res, methods = ['GET', 'POST', 'OPTIONS']) {
  const origin = req.headers.origin;
  
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', methods.join(', '));
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  
  return false;
}

/**
 * CORS middleware wrapper for API handlers
 * @param {Function} handler - The API handler function
 * @param {Object} options - Options for CORS
 * @returns {Function} Wrapped handler with CORS
 */
export function withCors(handler, options = {}) {
  const { methods = ['GET', 'POST', 'OPTIONS'] } = options;
  
  return async (req, res) => {
    // Apply CORS headers
    if (applyCors(req, res, methods)) {
      return; // Preflight handled
    }
    
    // Check if method is allowed
    if (!methods.includes(req.method)) {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    // Execute the handler
    return handler(req, res);
  };
}