// api/db/init.js
// Database initialization endpoint

import { Client } from 'pg';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check for admin authorization (you should add proper auth)
  const authHeader = req.headers.authorization;
  const adminToken = process.env.ADMIN_TOKEN || 'your-admin-token';
  
  if (authHeader !== `Bearer ${adminToken}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();

    // Create schema
    await client.query('CREATE SCHEMA IF NOT EXISTS bayview');
    
    // Set search path
    await client.query('SET search_path TO bayview');

    // Create memorials table
    await client.query(`
      CREATE TABLE IF NOT EXISTS memorials (
        id SERIAL PRIMARY KEY,
        submission_id VARCHAR(50) UNIQUE,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        middle_name VARCHAR(100),
        maiden_name VARCHAR(100),
        birth_date DATE,
        death_date DATE,
        birth_place VARCHAR(255),
        home_address TEXT,
        bayview_address TEXT,
        mother_name VARCHAR(200),
        father_name VARCHAR(200),
        message TEXT,
        bayview_history TEXT,
        application_type VARCHAR(100),
        is_member BOOLEAN DEFAULT false,
        member_name VARCHAR(200),
        member_relationship VARCHAR(200),
        contact_name VARCHAR(200),
        contact_email VARCHAR(200),
        contact_phone VARCHAR(50),
        contact_address TEXT,
        service_date DATE,
        celebrant_requested VARCHAR(100),
        fee_amount DECIMAL(10, 2),
        payment_status VARCHAR(50) DEFAULT 'pending',
        notion_id VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_memorials_last_name ON memorials(last_name)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_memorials_first_name ON memorials(first_name)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_memorials_submission_id ON memorials(submission_id)');

    // Create update trigger
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_memorials_updated_at ON memorials
    `);

    await client.query(`
      CREATE TRIGGER update_memorials_updated_at 
      BEFORE UPDATE ON memorials 
      FOR EACH ROW 
      EXECUTE PROCEDURE update_updated_at_column()
    `);

    // Grant permissions
    await client.query('GRANT ALL PRIVILEGES ON SCHEMA bayview TO doadmin');
    await client.query('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA bayview TO doadmin');
    await client.query('GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA bayview TO doadmin');

    // Check if table was created successfully
    const result = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'bayview' 
      AND table_name = 'memorials'
    `);

    return res.status(200).json({
      success: true,
      message: 'Database initialized successfully',
      tableExists: result.rows[0].count > 0
    });

  } catch (error) {
    console.error('Database initialization error:', error);
    return res.status(500).json({
      error: 'Failed to initialize database',
      details: error.message
    });
  } finally {
    await client.end();
  }
}