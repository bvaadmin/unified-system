const { Client } = require('pg');
const fs = require('fs').promises;
const path = require('path');

// Try to load .env.local file if it exists
try {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (require('fs').existsSync(envPath)) {
    const envContent = require('fs').readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          let value = valueParts.join('=').trim();
          // Remove quotes and escape sequences
          value = value.replace(/^["'](.*)["']$/, '$1');
          value = value.replace(/\\n/g, '');
          if (!process.env[key.trim()]) {
            process.env[key.trim()] = value;
          }
        }
      }
    });
    console.log('Loaded environment variables from .env.local');
  }
} catch (error) {
  // Ignore if file doesn't exist
}

async function addEnhancedTables() {
  const DATABASE_URL = process.env.DATABASE_URL_CLEAN || process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('ERROR: DATABASE_URL environment variable is required');
    console.error('Set it with: export DATABASE_URL="postgresql://user:password@host:port/database"');
    process.exit(1);
  }

  const client = new Client({
    connectionString: DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully');

    // Read SQL file
    const sqlPath = path.join(__dirname, 'sql', 'add-audit-payment-attachments.sql');
    console.log(`Reading SQL from: ${sqlPath}`);
    const sql = await fs.readFile(sqlPath, 'utf8');

    // Execute SQL
    console.log('Executing SQL to add enhanced tables...');
    await client.query(sql);
    console.log('Enhanced tables created successfully!');

    // Verify tables were created
    console.log('\nVerifying new tables...');
    
    const verifyQueries = [
      { name: 'Audit Log', query: 'SELECT COUNT(*) FROM bayview.audit_log' },
      { name: 'Chapel Payments', query: 'SELECT COUNT(*) FROM crouse_chapel.payments' },
      { name: 'Memorial Payments', query: 'SELECT COUNT(*) FROM bayview.memorial_payments' },
      { name: 'Attachments', query: 'SELECT COUNT(*) FROM bayview.attachments' }
    ];

    for (const check of verifyQueries) {
      try {
        const result = await client.query(check.query);
        console.log(`✓ ${check.name} table exists (${result.rows[0].count} records)`);
      } catch (error) {
        console.error(`✗ ${check.name} table verification failed:`, error.message);
      }
    }

    // Test audit trigger
    console.log('\nTesting audit trigger...');
    await client.query('BEGIN');
    
    // Insert a test record
    const testResult = await client.query(`
      INSERT INTO bayview.memorials (
        submission_id, first_name, last_name, contact_name, contact_email
      ) VALUES (
        'TEST-AUDIT-' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS'),
        'Test', 'Audit', 'Test Contact', 'test@example.com'
      ) RETURNING id
    `);
    
    const testId = testResult.rows[0].id;
    
    // Check audit log
    const auditResult = await client.query(
      'SELECT * FROM bayview.audit_log WHERE table_name = $1 AND record_id = $2',
      ['memorials', testId]
    );
    
    if (auditResult.rows.length > 0) {
      console.log('✓ Audit trigger is working correctly');
    } else {
      console.log('✗ Audit trigger test failed');
    }
    
    // Rollback test data
    await client.query('ROLLBACK');
    console.log('Test data rolled back');

    // Show payment summary views
    console.log('\nPayment summary views created:');
    console.log('- crouse_chapel.application_payment_summary');
    console.log('- bayview.memorial_payment_summary');

  } catch (error) {
    console.error('ERROR:', error.message);
    if (error.detail) {
      console.error('Detail:', error.detail);
    }
    if (error.hint) {
      console.error('Hint:', error.hint);
    }
    process.exit(1);
  } finally {
    await client.end();
    console.log('\nDatabase connection closed');
  }
}

// Run if called directly
if (require.main === module) {
  addEnhancedTables();
}

module.exports = { addEnhancedTables };