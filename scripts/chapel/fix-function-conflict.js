const { Client } = require('pg');

async function fixFunctionConflict() {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('ERROR: DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const client = new Client({
    connectionString: DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected successfully!');

    // Drop existing function versions
    console.log('Dropping existing is_chapel_available functions...');
    await client.query(`
      DROP FUNCTION IF EXISTS crouse_chapel.is_chapel_available(DATE, TIME);
      DROP FUNCTION IF EXISTS crouse_chapel.is_chapel_available(DATE, TIME, VARCHAR);
    `);

    // Create the correct function with proper signature
    console.log('Creating new is_chapel_available function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION crouse_chapel.is_chapel_available(check_date DATE, check_time TIME, event_type VARCHAR DEFAULT 'wedding')
      RETURNS BOOLEAN AS $$
      DECLARE
          is_available BOOLEAN := true;
          buffer_hours INTEGER;
      BEGIN
          -- Set buffer time based on event type
          CASE event_type
              WHEN 'wedding' THEN buffer_hours := 2;
              WHEN 'memorial' THEN buffer_hours := 2;
              WHEN 'funeral' THEN buffer_hours := 2;
              WHEN 'baptism' THEN buffer_hours := 1;
              WHEN 'general_use' THEN buffer_hours := 3;
              ELSE buffer_hours := 2;
          END CASE;

          -- Check if date is in blackout period
          IF EXISTS (
              SELECT 1 FROM crouse_chapel.blackout_dates
              WHERE check_date BETWEEN start_date AND end_date
          ) THEN
              RETURN false;
          END IF;
          
          -- Check if time slot is already booked
          IF EXISTS (
              SELECT 1 FROM crouse_chapel.service_applications
              WHERE service_date = check_date
              AND service_time = check_time
              AND status NOT IN ('rejected', 'cancelled')
          ) THEN
              RETURN false;
          END IF;
          
          -- Check for buffer time
          IF EXISTS (
              SELECT 1 FROM crouse_chapel.service_applications
              WHERE service_date = check_date
              AND status NOT IN ('rejected', 'cancelled')
              AND (
                  (service_time BETWEEN check_time - INTERVAL '1 hour' * buffer_hours 
                      AND check_time + INTERVAL '1 hour' * buffer_hours)
                  OR (check_time BETWEEN service_time - INTERVAL '1 hour' * buffer_hours 
                      AND service_time + INTERVAL '1 hour' * buffer_hours)
              )
          ) THEN
              RETURN false;
          END IF;
          
          RETURN true;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    console.log('Function conflict resolved successfully!');

  } catch (error) {
    console.error(`Error: ${error.message}`);
  } finally {
    await client.end();
  }
}

// Run if called directly
if (require.main === module) {
  fixFunctionConflict();
}

module.exports = { fixFunctionConflict };