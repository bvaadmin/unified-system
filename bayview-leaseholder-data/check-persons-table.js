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
  
  // Check core.persons structure
  const personColumns = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'core' AND table_name = 'persons'
    ORDER BY ordinal_position
  `);
  
  console.log('👥 core.persons columns:');
  console.table(personColumns.rows);
  
  await client.end();
} catch (error) {
  console.error('❌ Error:', error.message);
}