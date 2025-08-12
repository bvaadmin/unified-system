// api/memorial/submit-garden-v2.js
// Clean implementation for normalized memorial garden database structure

import { Client } from 'pg';
import { applyCors } from '../../cors.js';

export default async function handler(req, res) {
  // Apply CORS
  applyCors(req, res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const DATABASE_URL = process.env.DATABASE_URL_CLEAN || process.env.DATABASE_URL;
  const NOTION_API_KEY = process.env.NOTION_API_KEY;
  const NOTION_DATABASE_ID = 'e438c3bd041a4977baacde59ea4cc1e7';
  
  if (!DATABASE_URL) {
    return res.status(500).json({ error: 'Database not configured' });
  }
  
  const pgClient = new Client({
    connectionString: DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    const { properties } = req.body;
    
    // Connect to database
    await pgClient.connect();
    await pgClient.query('BEGIN');
    
    // 1. Create main application record
    const appResult = await pgClient.query(`
      INSERT INTO bayview.memorial_applications (
        submission_id,
        application_type,
        status,
        contact_name,
        contact_email,
        contact_phone,
        contact_address,
        is_member,
        member_name,
        member_relationship,
        service_date,
        service_time,
        celebrant_requested,
        fee_amount,
        payment_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id, created_at
    `, [
      properties['Submission ID'],
      properties['Application Type'], // 'immediate' or 'future'
      'pending',
      properties['Contact Name'],
      properties['Contact Email'] || null,
      properties['Contact Phone'],
      properties['Contact Address'] || null,
      properties['Bay View Member'] === 'Yes',
      properties['Member Name'] || null,
      properties['Member Relationship'] || null,
      properties['Requested Service Date'] || null,
      properties['Requested Service Time'] || null,
      properties['Celebrant Requested'] || null,
      parseFloat(properties['Fee Amount']) || 0,
      'pending'
    ]);
    
    const applicationId = appResult.rows[0].id;
    
    // 2. Handle based on application type
    if (properties['Application Type'] === 'immediate') {
      // Create person records for immediate placement
      const persons = [];
      
      // Parse immediate placement data from form
      // Expecting format like "First Name|Last Name|Middle Name|Maiden Name|Memorial Name"
      if (properties['Immediate Person 1']) {
        const p1 = parsePersonData(properties['Immediate Person 1']);
        persons.push({ ...p1, order: 1 });
      }
      
      if (properties['Immediate Person 2']) {
        const p2 = parsePersonData(properties['Immediate Person 2']);
        persons.push({ ...p2, order: 2 });
      }
      
      // Insert person records
      for (const person of persons) {
        await pgClient.query(`
          INSERT INTO bayview.memorial_persons (
            application_id,
            person_order,
            first_name,
            middle_name,
            last_name,
            maiden_name,
            memorial_name,
            birth_date,
            death_date,
            birth_place,
            home_address,
            bayview_address,
            mother_name,
            father_name,
            bayview_history,
            message,
            placement_status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        `, [
          applicationId,
          person.order,
          person.firstName || null,
          person.middleName || null,
          person.lastName || null,
          person.maidenName || null,
          person.memorialName || `${person.firstName || ''} ${person.lastName || ''}`.trim(),
          person.birthDate || null,
          person.deathDate || null,
          person.birthPlace || null,
          person.homeAddress || null,
          person.bayviewAddress || null,
          person.motherName || null,
          person.fatherName || null,
          person.bayviewHistory || null,
          person.message || null,
          'pending'
        ]);
      }
      
    } else if (properties['Application Type'] === 'future') {
      // Create prepayment record
      await pgClient.query(`
        INSERT INTO bayview.prepayments (
          application_id,
          person1_name,
          person2_name,
          status,
          notes
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
        applicationId,
        properties['Prepayment Person 1'] || null,
        properties['Prepayment Person 2'] || null,
        'active',
        'Prepayment for future memorial garden placement'
      ]);
    }
    
    // Commit transaction
    await pgClient.query('COMMIT');
    
    // 3. Save to Notion if configured
    let notionResult = null;
    if (NOTION_API_KEY) {
      try {
        notionResult = await saveToNotion(properties, NOTION_API_KEY, NOTION_DATABASE_ID);
      } catch (notionError) {
        console.error('Notion save failed:', notionError);
        // Continue - database save was successful
      }
    }
    
    // Return success response
    return res.status(200).json({
      success: true,
      applicationId,
      submissionId: properties['Submission ID'],
      message: 'Memorial garden application submitted successfully',
      notionId: notionResult?.id,
      syncStatus: notionResult ? 'complete' : 'database_only'
    });
    
  } catch (error) {
    // Rollback on error
    try {
      await pgClient.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError);
    }
    
    console.error('Memorial submission error:', error);
    return res.status(500).json({
      error: 'Failed to submit memorial garden application',
      message: error.message
    });
    
  } finally {
    await pgClient.end();
  }
}

// Helper function to parse person data from form
function parsePersonData(personString) {
  // Handle different formats the form might send
  if (typeof personString === 'object') {
    return personString;
  }
  
  // If it's a pipe-delimited string
  if (typeof personString === 'string' && personString.includes('|')) {
    const parts = personString.split('|');
    return {
      firstName: parts[0] || null,
      lastName: parts[1] || null,
      middleName: parts[2] || null,
      maidenName: parts[3] || null,
      memorialName: parts[4] || null
    };
  }
  
  // If it's just a name
  const nameParts = (personString || '').trim().split(' ');
  return {
    firstName: nameParts[0] || null,
    lastName: nameParts.slice(-1)[0] || null,
    middleName: nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : null
  };
}

// Helper function to save to Notion
async function saveToNotion(properties, apiKey, databaseId) {
  const notionProperties = {
    'Submission ID': {
      title: [{ text: { content: properties['Submission ID'] || '' } }]
    },
    'Submission Date': properties['Submission Date'] ? {
      date: { start: properties['Submission Date'] }
    } : undefined,
    'Application Type': properties['Application Type'] ? {
      select: { name: properties['Application Type'] }
    } : undefined,
    'Bay View Member': properties['Bay View Member'] ? {
      select: { name: properties['Bay View Member'] }
    } : undefined,
    'Contact Name': properties['Contact Name'] ? {
      rich_text: [{ text: { content: properties['Contact Name'] } }]
    } : undefined,
    'Contact Email': properties['Contact Email'] ? {
      email: properties['Contact Email']
    } : undefined,
    'Contact Phone': properties['Contact Phone'] ? {
      phone_number: properties['Contact Phone']
    } : undefined,
    'Fee Amount': properties['Fee Amount'] ? {
      number: Number(properties['Fee Amount'])
    } : undefined,
    'Status': {
      select: { name: 'Pending' }
    }
  };
  
  // Remove undefined properties
  Object.keys(notionProperties).forEach(key => {
    if (notionProperties[key] === undefined) {
      delete notionProperties[key];
    }
  });
  
  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    },
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties: notionProperties
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Notion API error: ${error}`);
  }
  
  return await response.json();
}