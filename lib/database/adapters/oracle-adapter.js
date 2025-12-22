// Oracle Database Adapter
// Handles connection pooling and transaction management for Oracle Autonomous Database

import oracledb from 'oracledb';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

// New: Vercel serverless functions have a writeable /tmp directory
const VERCEL_TMP_DIR = '/tmp';
const WALLET_DIR = path.join(VERCEL_TMP_DIR, 'oracle_wallet');

// Crucial: Initialize oracledb with the config directory
// This must be done BEFORE any other oracledb calls that require tnsnames.ora
oracledb.initOracleClient({ configDir: WALLET_DIR });

// Configure Oracle client: use arrays; some callers depend on array rows
oracledb.outFormat = oracledb.OUT_FORMAT_ARRAY;

let pool = null;

// New: Log the presence of wallet content environment variables
console.log('Environment variables loaded:');
console.log('ORACLE_USER:', process.env.ORACLE_USER);
console.log('ORACLE_PASSWORD:', process.env.ORACLE_PASSWORD ? '[SET]' : '[NOT SET]');
console.log('ORACLE_CONNECT_STRING:', process.env.ORACLE_CONNECT_STRING);
console.log('ORACLE_TNSNAMES_ORA_B64 (present):', !!process.env.ORACLE_TNSNAMES_ORA_B64);
console.log('ORACLE_SQLNET_ORA_B64 (present):', !!process.env.ORACLE_SQLNET_ORA_B64);
console.log('ORACLE_WALLET_LOCATION:', process.env.ORACLE_WALLET_LOCATION);
console.log('ORACLE_WALLET_PASSWORD:', process.env.ORACLE_WALLET_PASSWORD ? '[SET]' : '[NOT SET]');
console.log('ORACLE_TNS_ADMIN:', process.env.ORACLE_TNS_ADMIN);
console.log('ORACLE_TNS_ALIAS:', process.env.ORACLE_TNS_ALIAS);
console.log('ORACLE_ONE_WAY_TLS:', process.env.ORACLE_ONE_WAY_TLS);


// Function to write wallet files from Base64 environment variables
async function writeWalletFilesFromEnv() {
  try {
    const tnsnames = process.env.ORACLE_TNSNAMES_ORA_B64;
    const sqlnet = process.env.ORACLE_SQLNET_ORA_B64;

    if (tnsnames && sqlnet) {
      if (!fs.existsSync(WALLET_DIR)) {
        fs.mkdirSync(WALLET_DIR, { recursive: true });
        console.log(`Created wallet directory: ${WALLET_DIR}`);
      }

      fs.writeFileSync(path.join(WALLET_DIR, 'tnsnames.ora'), Buffer.from(tnsnames, 'base64').toString('utf-8'));
      fs.writeFileSync(path.join(WALLET_DIR, 'sqlnet.ora'), Buffer.from(sqlnet, 'base64').toString('utf-8'));
      
      console.log('Successfully wrote Oracle wallet files to /tmp/oracle_wallet');
      return WALLET_DIR;
    }
  } catch (error) {
    console.error('Error writing wallet files from environment variables:', error);
  }
  return null;
}

// Oracle connection configuration for Thin mode (no client installation required)
const oracleConfig = {
  user: process.env.ORACLE_USER || 'ADMIN',
  password: process.env.ORACLE_PASSWORD,
  // Use full TNS connection string for Thin mode
  connectString: process.env.ORACLE_CONNECT_STRING || 
    '(description= (retry_count=20)(retry_delay=3)(address=(protocol=tcps)(port=1522)(host=adb.us-chicago-1.oraclecloud.com))(connect_data=(service_name=gfca71b2aacce62_mainbase_high.adb.oraclecloud.com))(security=(ssl_server_dn_match=yes)))',
  walletLocation: process.env.ORACLE_WALLET_LOCATION,
  walletPassword: process.env.ORACLE_WALLET_PASSWORD,
  tnsAdmin: process.env.ORACLE_TNS_ADMIN || process.env.ORACLE_NETWORK_CONFIG_DIR,
  tnsAlias: process.env.ORACLE_TNS_ALIAS,
  oneWayTLS: String(process.env.ORACLE_ONE_WAY_TLS || '').toLowerCase() === 'true',
  poolMin: 2,
  poolMax: 10,
  poolIncrement: 2,
  poolTimeout: 300 // seconds
};

function parseTnsAliases(configDir) {
  try {
    if (!configDir) return [];
    const tnsPath = path.join(configDir, 'tnsnames.ora');
    if (!fs.existsSync(tnsPath)) return [];
    const text = fs.readFileSync(tnsPath, 'utf8');
    const aliases = [];
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('(')) continue;
      const m = trimmed.match(/^([A-Za-z0-9_.:-]+)\s*=\s*\(.*/);
      if (m) aliases.push(m[1]);
    }
    return aliases;
  } catch {
    return [];
  }
}

function deriveConnectStringInfo() {
  // Prefer explicit TNS alias if provided
  if (oracleConfig.tnsAlias) return { value: oracleConfig.tnsAlias, source: 'env-alias' };

  // If ORACLE_CONNECT_STRING appears to be a simple alias (no '(' and no host=), use it
  const ocs = process.env.ORACLE_CONNECT_STRING;
  if (ocs && !ocs.includes('(') && !/host=|port=|service_name=/i.test(ocs)) {
    return { value: ocs.trim(), source: 'ocs-alias' };
  }

  // Try parsing alias from DATABASE_URL: e.g. oracle+oracledb://user:pass@mainbase_high
  const dbUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_CLEAN;
  if (dbUrl) {
    const atIdx = dbUrl.lastIndexOf('@');
    if (atIdx !== -1) {
      // extract until end or until first '?' or '/'
      const after = dbUrl.slice(atIdx + 1);
      const alias = after.split(/[?\/]/)[0];
      if (alias && !alias.includes(':') && !alias.includes('(')) {
        return { value: alias.trim(), source: 'database-url' };
      }
    }
  }

  // If a TNS admin dir exists, try to auto-pick a sensible alias
  const aliases = parseTnsAliases(oracleConfig.tnsAdmin || oracleConfig.walletLocation || WALLET_DIR);
  if (aliases.length) {
    const preference = (process.env.ORACLE_TNS_PREFERENCE || 'high,medium,low,tpurgent,tp')
      .split(',').map(s => s.trim().toLowerCase());
    for (const pref of preference) {
      const match = aliases.find(a => a.toLowerCase().endsWith(pref));
      if (match) return { value: match, source: 'tnsnames-auto' };
    }
    // fallback to first alias
    return { value: aliases[0], source: 'tnsnames-first' };
  }

  // Fall back to the full connect descriptor (hardcoded or env)
  return { value: oracleConfig.connectString, source: 'hardcoded' };
}

function deriveConnectString() {
  return deriveConnectStringInfo().value;
}

export function getResolvedConnectInfo() {
  const info = deriveConnectStringInfo();
  const usingMTLS = !!(oracleConfig.walletLocation && oracleConfig.walletPassword && !oracleConfig.oneWayTLS);
  const usingOneWayTLS = !!(oracleConfig.oneWayTLS || (oracleConfig.tnsAdmin && !oracleConfig.walletPassword));
  const mode = usingMTLS ? 'mtls' : (usingOneWayTLS ? 'one-way-tls' : 'standard');
  return {
    mode,
    connectString: info.value,
    source: info.source,
    tnsAdmin: oracleConfig.tnsAdmin || WALLET_DIR || null
  };
}

/**
 * Initialize Oracle connection pool (Thin mode - no client libraries required)
 */
export async function initializePool() {
  try {
    if (!pool) {
      console.log('Creating Oracle connection pool (Thin mode)...');

      // Crucial: Write wallet files from environment variables if present
      await writeWalletFilesFromEnv();

      // Determine mode and build pool configuration
      const usingMTLS = !!(oracleConfig.walletLocation && oracleConfig.walletPassword && !oracleConfig.oneWayTLS);
      const usingOneWayTLS = !!(oracleConfig.oneWayTLS || (oracleConfig.tnsAdmin && !oracleConfig.walletPassword));

      try {
        const info = getResolvedConnectInfo();
        console.log('Resolved connect info:', info);
      } catch {}

      let poolConfig;

      if (usingMTLS) {
        console.log('Setting up wallet-based mTLS authentication (OCI wallet)...');
        poolConfig = {
          user: oracleConfig.user,
          password: oracleConfig.password,
          connectString: deriveConnectString(),
          poolMin: oracleConfig.poolMin,
          poolMax: oracleConfig.poolMax,
          poolIncrement: oracleConfig.poolIncrement,
          poolTimeout: oracleConfig.poolTimeout,
          walletLocation: oracleConfig.walletLocation || WALLET_DIR,
          walletPassword: oracleConfig.walletPassword
        };
      } else if (usingOneWayTLS) {
        console.log('Setting up one-way TLS using TNS admin directory (OCI TNS)...');
        poolConfig = {
          user: oracleConfig.user,
          password: oracleConfig.password,
          connectString: deriveConnectString(),
          poolMin: oracleConfig.poolMin,
          poolMax: oracleConfig.poolMax,
          poolIncrement: oracleConfig.poolIncrement,
          poolTimeout: oracleConfig.poolTimeout,
          configDir: oracleConfig.tnsAdmin || WALLET_DIR
        };
      } else {
        console.log('Setting up standard connection (hardcoded descriptor)...');
        poolConfig = {
          user: oracleConfig.user,
          password: oracleConfig.password,
          connectString: deriveConnectString(),
          poolMin: oracleConfig.poolMin,
          poolMax: oracleConfig.poolMax,
          poolIncrement: oracleConfig.poolIncrement,
          poolTimeout: oracleConfig.poolTimeout
        };
      }

      const safeLog = { ...poolConfig };
      if ('password' in safeLog) safeLog.password = '[HIDDEN]';
      if ('walletPassword' in safeLog && safeLog.walletPassword) safeLog.walletPassword = '[HIDDEN]';
      console.log('Pool configuration:', safeLog);

      pool = await oracledb.createPool(poolConfig);
      console.log('Oracle connection pool created successfully');
    }
    return pool;
  } catch (error) {
    console.error('Error creating Oracle pool:', error);
    throw error;
  }
}



/**
 * Get a connection from the pool
 */
export async function getConnection() {
  try {
    if (!pool) {
      await initializePool();
    }
    const connection = await pool.getConnection();
    return connection;
  } catch (error) {
    console.error('Error getting Oracle connection:', error);
    throw error;
  }
}

/**
 * Close the connection pool
 */
export async function closePool() {
  try {
    if (pool) {
      await pool.close(0); // Force close
      pool = null;
      console.log('Oracle connection pool closed');
    }
  } catch (error) {
    console.error('Error closing Oracle pool:', error);
    throw error;
  }
}

/**
 * Execute a query with automatic connection management
 */
export async function executeQuery(sql, binds = []) {
  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute(sql, binds);
    return result;
  } catch (error) {
    console.error('Error executing Oracle query:', error);
    throw error;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing Oracle connection:', err);
      }
    }
  }
}

/**
 * Execute a function with an Oracle connection
 */
export async function withOracleConnection(connectionFn) {
  let connection;
  try {
    connection = await getConnection();
    const result = await connectionFn(connection);
    return result;
  } catch (error) {
    console.error('Error in Oracle connection function:', error);
    throw error;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing Oracle connection:', err);
      }
    }
  }
}

/**
 * Execute a transaction with automatic rollback on error
 */
export async function withOracleTransaction(transactionFn) {
  let connection;
  try {
    connection = await getConnection();
    
    // Execute the transaction function
    const result = await transactionFn(connection);
    
    // Commit if successful
    await connection.commit();
    return result;
  } catch (error) {
    // Rollback on error
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Error during rollback:', rollbackError);
      }
    }
    throw error;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection after transaction:', err);
      }
    }
  }
}

/**
 * Convert PostgreSQL parameter style ($1, $2) to Oracle style (:1, :2)
 */
export function convertParameterStyle(sql) {
  let paramCount = 0;
  return sql.replace(/\$(\d+)/g, (match, num) => {
    paramCount = Math.max(paramCount, parseInt(num));
    return `:${num}`;
  });
}

/**
 * Convert PostgreSQL-specific SQL to Oracle-compatible SQL
 */
export function convertSQLToOracle(sql) {
  let oracleSQL = convertParameterStyle(sql);
  
  // Common PostgreSQL to Oracle conversions
  oracleSQL = oracleSQL
    .replace(/SERIAL/gi, 'NUMBER GENERATED BY DEFAULT AS IDENTITY')
    .replace(/BOOLEAN/gi, 'NUMBER(1)')
    .replace(/TEXT/gi, 'CLOB')
    .replace(/TIMESTAMP WITH TIME ZONE/gi, 'TIMESTAMP WITH TIME ZONE')
    .replace(/NOW\(\)/gi, 'CURRENT_TIMESTAMP')
    .replace(/LIMIT\s+(\d+)/gi, 'FETCH FIRST $1 ROWS ONLY')
    .replace(/ILIKE/gi, 'LIKE')
    .replace(/~~\*/gi, 'LIKE')
    .replace(/!~~\*/gi, 'NOT LIKE');
  
  return oracleSQL;
}

/**
 * Helper function to create Oracle BIND_OUT parameters
 */
export function createBindOut(type = oracledb.STRING) {
  return {
    dir: oracledb.BIND_OUT,
    type: type
  };
}

/**
 * Health check for Oracle connection
 */
export async function healthCheck() {
  try {
    const result = await executeQuery('SELECT 1 as health FROM dual');
    return result.rows[0][0] === 1;
  } catch (error) {
    console.error('Oracle health check failed:', error);
    return false;
  }
}

// Export oracledb for direct access to constants
export { oracledb };

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT, closing Oracle pool...');
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, closing Oracle pool...');
  await closePool();
  process.exit(0);
});
