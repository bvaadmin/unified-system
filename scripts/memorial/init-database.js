import { getConnection, closePool } from '../../lib/database/adapters/oracle-adapter.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initializeDatabase() {
  // Database connection string
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('ERROR: DATABASE_URL environment variable is required');
    process.exit(1);
  }

  let connection;

  try {
    console.log('Connecting to database...');
    connection = await getConnection();
    console.log('Connected successfully!');

    // Read SQL file
    const sqlFile = path.join(__dirname, 'init-database.sql');
    let sql = await fs.readFile(sqlFile, 'utf8');

    // Remove SQL comments before splitting to avoid ORA-00900 on stray lines
    // - Strip block comments /* ... */ and single-line comments starting with --
    sql = sql.replace(/\/\*[\s\S]*?\*\//g, '');
    sql = sql.replace(/^\s*--.*$/gm, '');

    // Build executable statements with awareness of PL/SQL blocks
    console.log('Initializing database schema...');
    const statements = [];
    {
      const lines = sql.split(/\r?\n/);
      let buf = [];
      let inProc = false;
      for (let raw of lines) {
        const line = raw; // keep original spacing for DDL
        if (!inProc) {
          if (/^\s*create\s+or\s+replace\s+procedure\b/i.test(line)) {
            inProc = true;
            buf.push(line);
            continue;
          }
          // outside proc: accumulate until ';'
          buf.push(line);
          if (line.includes(';')) {
            const chunk = buf.join('\n').trim();
            if (chunk) statements.push(chunk);
            buf = [];
          }
        } else {
          // inside procedure: keep lines until END;
          buf.push(line);
          if (/^\s*end\s*;\s*$/i.test(line)) {
            const chunk = buf.join('\n').trim();
            if (chunk) statements.push(chunk);
            buf = [];
            inProc = false;
          }
        }
      }
      const tail = buf.join('\n').trim();
      if (tail) statements.push(tail);
    }
    for (const statement of statements) {
      if (!statement || !statement.trim()) continue;
      const stmtClean = statement.replace(/;\s*$/, '');
      const preview = (stmtClean.split('\n').find(l => l.trim().length) || '').trim().slice(0, 120);
      console.log('Executing:', preview + ';');
      try {
        await connection.execute(stmtClean);
      } catch (err) {
        console.error('Failed statement was:\n' + statement + '\n');
        // Special-case: if CREATE TABLE already exists but driver reports ORA-00922, skip
        if ((err.errorNum === 922 || /ORA-00922/.test(err.message)) && /CREATE\s+TABLE\s+BAYVIEW_MEMORIALS/i.test(statement)) {
          console.log('Skipping CREATE TABLE BAYVIEW_MEMORIALS due to ORA-00922 (assume already created).');
          continue;
        }
        if (err && (
          err.errorNum === 955 || /ORA-00955/.test(err.message) || // name already used
          err.errorNum === 1408 || /ORA-01408/.test(err.message) ||    // such column list already indexed
          err.errorNum === 1430 || /ORA-01430/.test(err.message)       // column already exists
        )) {
          console.log('Skipping existing object for statement:', preview);
          continue;
        }
        throw err;
      }
    }
    
    console.log('Database initialized successfully!');
    
    // Verify the setup
    const result = await connection.execute('SELECT COUNT(*) FROM BAYVIEW_MEMORIALS');
    console.log(`Total memorials in database: ${result.rows[0][0]}`);

  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection:', err.message);
      }
    }
    await closePool();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase();
}

export { initializeDatabase };
