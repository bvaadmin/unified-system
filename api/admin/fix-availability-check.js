// Admin endpoint to permanently remove chapel availability checking
import { withPooledConnection } from '../../lib/db-pool.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check admin authorization
  const authHeader = req.headers.authorization;
  const adminToken = process.env.ADMIN_TOKEN;
  
  if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.slice(7) !== adminToken) {
    return res.status(401).json({ error: 'Unauthorized - Admin token required' });
  }

  const DATABASE_URL = process.env.DATABASE_URL_CLEAN || process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  try {
    const result = await withPooledConnection(async (pgClient) => {
      const steps = [];
      
      // Step 1: Check if the function exists
      const functionCheck = await pgClient.query(`
        SELECT routine_name, routine_definition 
        FROM information_schema.routines 
        WHERE routine_schema = 'crouse_chapel' 
        AND routine_name = 'is_chapel_available'
      `);
      
      if (functionCheck.rows.length > 0) {
        steps.push('Found is_chapel_available function');
        
        // Step 2: Check for any triggers calling this function
        const triggerCheck = await pgClient.query(`
          SELECT trigger_name, event_object_table, action_statement
          FROM information_schema.triggers 
          WHERE trigger_schema = 'crouse_chapel'
          AND action_statement ILIKE '%is_chapel_available%'
        `);
        
        if (triggerCheck.rows.length > 0) {
          steps.push(`Found ${triggerCheck.rows.length} triggers calling availability function`);
          
          // Drop triggers first
          for (const trigger of triggerCheck.rows) {
            await pgClient.query(`DROP TRIGGER IF EXISTS ${trigger.trigger_name} ON crouse_chapel.${trigger.event_object_table}`);
            steps.push(`Dropped trigger: ${trigger.trigger_name}`);
          }
        } else {
          steps.push('No triggers found calling availability function');
        }
        
        // Step 3: Drop the availability function
        await pgClient.query(`
          DROP FUNCTION IF EXISTS crouse_chapel.is_chapel_available(DATE, TIME);
          DROP FUNCTION IF EXISTS crouse_chapel.is_chapel_available(DATE, TIME, VARCHAR);
        `);
        steps.push('Dropped is_chapel_available function(s)');
        
      } else {
        steps.push('No availability function found');
      }
      
      // Step 4: Check for any constraints that might be calling availability checks
      const constraintCheck = await pgClient.query(`
        SELECT conname, contype, pg_get_constraintdef(oid) as definition
        FROM pg_constraint 
        WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'crouse_chapel')
        AND pg_get_constraintdef(oid) ILIKE '%available%'
      `);
      
      if (constraintCheck.rows.length > 0) {
        steps.push(`Found ${constraintCheck.rows.length} constraints mentioning 'available'`);
        for (const constraint of constraintCheck.rows) {
          steps.push(`Constraint: ${constraint.conname} - ${constraint.definition}`);
        }
      } else {
        steps.push('No constraints found mentioning availability');
      }
      
      // Step 5: Test a simple insert to verify the fix
      steps.push('Testing chapel application insert...');
      
      // Begin a test transaction
      await pgClient.query('SAVEPOINT test_insert');
      
      try {
        const testResult = await pgClient.query(`
          INSERT INTO crouse_chapel.service_applications (
            application_type, service_date, service_time, member_name, 
            member_relationship, contact_name, contact_address, 
            contact_phone, contact_email, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id
        `, [
          'memorial', '2025-08-25', '10:00:00', 'Test Member Fix', 
          'Family', 'Test Contact Fix', '123 Test St', 
          '555-1234', 'test-fix@example.com', 'pending'
        ]);
        
        steps.push(`✅ Test insert successful - Application ID: ${testResult.rows[0].id}`);
        
        // Rollback the test insert
        await pgClient.query('ROLLBACK TO SAVEPOINT test_insert');
        steps.push('Test insert rolled back');
        
      } catch (insertError) {
        await pgClient.query('ROLLBACK TO SAVEPOINT test_insert');
        steps.push(`❌ Test insert failed: ${insertError.message}`);
        
        if (insertError.message.includes('Chapel is not available')) {
          throw new Error('Availability check still active after function removal');
        }
      }
      
      return { steps, success: true };
    });
    
    return res.status(200).json({
      success: true,
      message: 'Chapel availability check removal completed',
      steps: result.steps,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Database fix error:', error);
    return res.status(500).json({
      error: 'Failed to fix availability check',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}