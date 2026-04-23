// Test file to trigger Claude Code Review workflow
// This file should trigger the workflow due to path filtering on api/**/*.js

export default async function handler(req, res) {
  // Test CORS handling - this should be reviewed by Claude
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Test database connection pattern - should be reviewed
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }  // SSL configuration
    });
    
    // Test error handling - should be reviewed  
    const result = await pool.query('SELECT NOW()');
    
    res.status(200).json({
      success: true,
      timestamp: result.rows[0].now,
      message: 'Workflow test endpoint'
    });
    
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}