import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL?.replace('?sslmode=require', '');
const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

try {
  await client.connect();
  console.log('✅ Connected to database');
  
  const result = await client.query('SELECT current_database(), current_schema(), version()');
  console.log('Database:', result.rows[0].current_database);
  console.log('Schema:', result.rows[0].current_schema);
  console.log('Version:', result.rows[0].version.split(',')[0]);
  
  await client.end();
} catch (error) {
  console.error('❌ Connection failed:', error.message);
  process.exit(1);
}