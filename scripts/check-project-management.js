#!/usr/bin/env node

import { withDatabase } from '../lib/db.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function checkProjectManagement() {
  try {
    const result = await withDatabase(async (client) => {
      // Check if schema exists
      const schemaCheck = await client.query(`
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name = 'project_management';
      `);
      
      if (schemaCheck.rows.length === 0) {
        console.log('project_management schema does not exist.');
        return { schemaExists: false };
      }
      
      console.log('project_management schema exists.');
      
      // Get all tables in the schema
      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'project_management'
        ORDER BY table_name;
      `);
      
      console.log('\nTables in project_management schema:');
      tablesResult.rows.forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
      
      // Check if tasks table exists and get its structure
      const tasksExist = tablesResult.rows.some(row => row.table_name === 'tasks');
      
      if (tasksExist) {
        const columnsResult = await client.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'project_management' 
          AND table_name = 'tasks'
          ORDER BY ordinal_position;
        `);
        
        console.log('\nColumns in tasks table:');
        columnsResult.rows.forEach(col => {
          console.log(`  - ${col.column_name} (${col.data_type}, ${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
        });
        
        // Get task count by status
        const statusCount = await client.query(`
          SELECT status, COUNT(*) as count
          FROM project_management.tasks
          GROUP BY status
          ORDER BY count DESC;
        `);
        
        console.log('\nTask count by status:');
        statusCount.rows.forEach(row => {
          console.log(`  - ${row.status}: ${row.count}`);
        });
      }
      
      return { schemaExists: true, tasksExist };
    });

  } catch (error) {
    console.error('Error checking project management:', error.message);
    process.exit(1);
  }
}

checkProjectManagement();