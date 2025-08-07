// api/submit-memorial-garden.js
// Enhanced version that saves to both DigitalOcean PostgreSQL and Notion

import { Client } from 'pg';

export default async function handler(req, res) {
  // Enable CORS for your GitHub Pages domain
  // Deployment timestamp: 2025-08-05T05:20:00Z
  const allowedOrigins = [
    'https://bvaadmin.github.io',
    'https://vercel.com',
    'http://localhost:3000',
    'http://127.0.0.1:5500'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://bvaadmin.github.io');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Configuration
  const NOTION_API_KEY = process.env.NOTION_API_KEY;
  const DATABASE_URL = process.env.DATABASE_URL_CLEAN || process.env.DATABASE_URL;
  const NOTION_DATABASE_ID = 'e438c3bd041a4977baacde59ea4cc1e7';
  
  // Log which database we're using (temporary for debugging)
  console.log('Using DATABASE_URL:', DATABASE_URL?.includes('clean') ? 'NEW clean database' : 'OLD database');

  if (!NOTION_API_KEY) {
    return res.status(500).json({ error: 'Notion API key not configured' });
  }

  // PostgreSQL client with working SSL configuration
  let pgClient = null;
  if (DATABASE_URL) {
    try {
      // Clean URL and create client
      const cleanUrl = DATABASE_URL.replace('?sslmode=require', '');
      
      pgClient = new Client({
        connectionString: cleanUrl,
        ssl: {
          rejectUnauthorized: false
        }
      });
      
      console.log('PostgreSQL client created successfully');
    } catch (error) {
      console.error('Error creating PostgreSQL client:', error);
    }
  } else {
    console.log('No DATABASE_URL provided');
  }

  try {
    const { properties } = req.body;

    // Extract personal history from JSON
    let personalHistory = {};
    try {
      personalHistory = JSON.parse(properties['Personal History JSON'] || '{}');
    } catch (e) {
      console.error('Error parsing personal history:', e);
    }

    // 1. Save to PostgreSQL (if available)
    let pgResult = null;
    if (pgClient) {
      try {
        console.log('Attempting PostgreSQL connection...');
        await pgClient.connect();
        console.log('PostgreSQL connected successfully');
        
        // Create the memorial record with all form data including new placement fields
        const insertQuery = `
          INSERT INTO bayview.memorials (
            submission_id,
            first_name, 
            last_name, 
            middle_name,
            maiden_name,
            birth_date, 
            death_date,
            birth_place,
            home_address,
            bayview_address,
            mother_name,
            father_name,
            message,
            bayview_history,
            application_type,
            placement_type,
            is_member,
            member_name,
            member_relationship,
            contact_name,
            contact_email,
            contact_phone,
            contact_address,
            service_date,
            celebrant_requested,
            fee_amount,
            other_first_name,
            other_middle_name,
            other_last_name,
            other_maiden_name,
            other_birth_date,
            other_death_date,
            other_birth_place,
            other_home_address,
            other_bayview_address,
            other_bayview_history,
            second_first_name,
            second_middle_name,
            second_last_name,
            second_maiden_name,
            second_birth_date,
            second_death_date,
            second_birth_place,
            second_home_address,
            second_bayview_address,
            second_bayview_history
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46)
          RETURNING id, created_at
        `;
        
        // Parse other person and second person data if present
        let otherPersonHistory = {};
        let secondPersonHistory = {};
        try {
          if (properties['Other Person JSON']) {
            otherPersonHistory = JSON.parse(properties['Other Person JSON']);
          }
          if (properties['Second Person JSON']) {
            secondPersonHistory = JSON.parse(properties['Second Person JSON']);
          }
        } catch (e) {
          console.error('Error parsing additional person data:', e);
        }
        
        const values = [
          properties['Submission ID'] || '',
          properties.first_name || personalHistory.firstName || properties['Deceased Name']?.split(' ')[0] || '',
          properties.last_name || personalHistory.lastName || properties['Deceased Name']?.split(' ').slice(-1)[0] || '',
          properties.middle_name || personalHistory.middleName || '',
          properties.maiden_name || personalHistory.maidenName || '',
          personalHistory.birthDate || null,
          personalHistory.deathDate || null,
          personalHistory.birthPlace || '',
          personalHistory.homeAddress || '',
          personalHistory.bayviewAddress || '',
          personalHistory.motherName || '',
          personalHistory.fatherName || '',
          properties.message || properties['Bay View History'] || '',
          personalHistory.bayviewHistory || '',
          properties.application_type || properties['Application Type'] || '',
          properties.placement_type || properties['Placement Type'] || null,
          properties.is_member !== undefined ? properties.is_member : (properties['Bay View Member'] === 'Yes'),
          properties.member_name || properties['Member Name'] || '',
          properties.member_relationship || properties['Member Relationship'] || '',
          properties.contact_name || properties['Contact Name'] || '',
          properties.contact_email || properties['Contact Email'] || '',
          properties.contact_phone || properties['Contact Phone'] || '',
          properties.contact_address || properties['Contact Address'] || '',
          properties['date:Service Date:start'] || null,
          properties['Celebrant Requested'] || '',
          parseFloat(properties['Fee Amount']) || 0,
          // Other person fields (26-36) - handle both naming conventions
          otherPersonHistory.firstName || properties['Other First Name'] || properties['Other Person First Name'] || null,
          otherPersonHistory.middleName || properties['Other Middle Name'] || properties['Other Person Middle Name'] || null,
          otherPersonHistory.lastName || properties['Other Last Name'] || properties['Other Person Last Name'] || null,
          otherPersonHistory.maidenName || properties['Other Maiden Name'] || properties['Other Person Maiden Name'] || null,
          otherPersonHistory.birthDate || properties['Other Birth Date'] || properties['Other Person Birth Date'] || null,
          otherPersonHistory.deathDate || properties['Other Death Date'] || properties['Other Person Death Date'] || null,
          otherPersonHistory.birthPlace || properties['Other Birth Place'] || properties['Other Person Birth Place'] || null,
          otherPersonHistory.homeAddress || properties['Other Home Address'] || properties['Other Person Home Address'] || null,
          otherPersonHistory.bayviewAddress || properties['Other Bayview Address'] || properties['Other Person Bayview Address'] || null,
          otherPersonHistory.bayviewHistory || properties['Other Bayview History'] || properties['Other Person Bayview History'] || null,
          // Second person fields (37-46) - handle both naming conventions
          secondPersonHistory.firstName || properties['Second First Name'] || properties['Second Person First Name'] || null,
          secondPersonHistory.middleName || properties['Second Middle Name'] || properties['Second Person Middle Name'] || null,
          secondPersonHistory.lastName || properties['Second Last Name'] || properties['Second Person Last Name'] || null,
          secondPersonHistory.maidenName || properties['Second Maiden Name'] || properties['Second Person Maiden Name'] || null,
          secondPersonHistory.birthDate || properties['Second Birth Date'] || properties['Second Person Birth Date'] || null,
          secondPersonHistory.deathDate || properties['Second Death Date'] || properties['Second Person Death Date'] || null,
          secondPersonHistory.birthPlace || properties['Second Birth Place'] || properties['Second Person Birth Place'] || null,
          secondPersonHistory.homeAddress || properties['Second Home Address'] || properties['Second Person Home Address'] || null,
          secondPersonHistory.bayviewAddress || properties['Second Bayview Address'] || properties['Second Person Bayview Address'] || null,
          secondPersonHistory.bayviewHistory || properties['Second Bayview History'] || properties['Second Person Bayview History'] || null
        ];
        
        pgResult = await pgClient.query(insertQuery, values);
        console.log('PostgreSQL insert successful:', pgResult.rows[0]);
        
      } catch (pgError) {
        console.error('PostgreSQL error:', pgError.message);
        console.error('PostgreSQL error stack:', pgError.stack);
        // Continue with Notion even if PostgreSQL fails
      } finally {
        try {
          await pgClient.end();
        } catch (e) {
          console.error('Error closing PostgreSQL connection:', e);
        }
      }
    } else {
      console.log('No PostgreSQL client available');
    }

    // 2. Save to Notion
    const notionResponse = await fetch(`https://api.notion.com/v1/pages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        parent: { database_id: NOTION_DATABASE_ID },
        properties: {
          'Submission ID': {
            title: [{ text: { content: properties['Submission ID'] || '' } }]
          },
          'Submission Date': properties['date:Submission Date:start'] ? {
            date: { start: properties['date:Submission Date:start'] }
          } : undefined,
          'Service Date': properties['date:Service Date:start'] ? {
            date: { start: properties['date:Service Date:start'] }
          } : undefined,
          'Status': properties['Status'] ? {
            select: { name: properties['Status'] }
          } : undefined,
          'Application Type': properties['Application Type'] ? {
            select: { name: properties['Application Type'] }
          } : undefined,
          'Bay View Member': properties['Bay View Member'] ? {
            select: { name: properties['Bay View Member'] }
          } : undefined,
          'Celebrant Requested': properties['Celebrant Requested'] ? {
            select: { name: properties['Celebrant Requested'] }
          } : undefined,
          'Contact Name': properties['Contact Name'] ? {
            rich_text: [{ text: { content: properties['Contact Name'] } }]
          } : undefined,
          'Contact Phone': properties['Contact Phone'] ? {
            phone_number: properties['Contact Phone']
          } : undefined,
          'Contact Email': properties['Contact Email'] ? {
            email: properties['Contact Email']
          } : undefined,
          'Contact Address': properties['Contact Address'] ? {
            rich_text: [{ text: { content: properties['Contact Address'] } }]
          } : undefined,
          'Deceased Name': properties['Deceased Name'] ? {
            rich_text: [{ text: { content: properties['Deceased Name'] } }]
          } : undefined,
          'Member Name': properties['Member Name'] ? {
            rich_text: [{ text: { content: properties['Member Name'] } }]
          } : undefined,
          'Member Relationship': properties['Member Relationship'] ? {
            rich_text: [{ text: { content: properties['Member Relationship'] } }]
          } : undefined,
          'Bay View History': properties['Bay View History'] ? {
            rich_text: [{ text: { content: properties['Bay View History'] } }]
          } : undefined,
          'Personal History JSON': properties['Personal History JSON'] ? {
            rich_text: [{ text: { content: properties['Personal History JSON'] } }]
          } : undefined,
          'Prepayment Names': properties['Prepayment Names'] ? {
            rich_text: [{ text: { content: properties['Prepayment Names'] } }]
          } : undefined,
          'Placement Type': properties['Placement Type'] ? {
            select: { name: properties['Placement Type'] }
          } : undefined,
          'Other Person JSON': properties['Other Person JSON'] ? {
            rich_text: [{ text: { content: properties['Other Person JSON'] } }]
          } : undefined,
          'Second Person JSON': properties['Second Person JSON'] ? {
            rich_text: [{ text: { content: properties['Second Person JSON'] } }]
          } : undefined,
          'Fee Amount': properties['Fee Amount'] ? {
            number: Number(properties['Fee Amount'])
          } : undefined,
          'Policy Agreement': {
            checkbox: properties['Policy Agreement'] === '__YES__'
          },
          // Add PostgreSQL ID if successful
          'Database ID': pgResult ? {
            rich_text: [{ text: { content: pgResult.rows[0].id.toString() } }]
          } : undefined
        }
      })
    });

    if (!notionResponse.ok) {
      const errorData = await notionResponse.json();
      console.error('Notion API error:', errorData);
      return res.status(notionResponse.status).json({ 
        error: 'Failed to create Notion entry',
        details: errorData,
        pgSuccess: !!pgResult
      });
    }

    const notionData = await notionResponse.json();
    
    // If we have both successful saves, update the PostgreSQL record with Notion ID
    if (pgResult && notionData.id) {
      try {
        const updateClient = new Client({
          connectionString: DATABASE_URL.replace('?sslmode=require', ''),
          ssl: {
            rejectUnauthorized: false
          }
        });
        
        await updateClient.connect();
        await updateClient.query(
          'UPDATE bayview.memorials SET notion_id = $1 WHERE id = $2',
          [notionData.id, pgResult.rows[0].id]
        );
        await updateClient.end();
        
        console.log('PostgreSQL updated with Notion ID');
      } catch (updateError) {
        console.error('Error updating PostgreSQL with Notion ID:', updateError);
      }
    }
    
    return res.status(200).json({
      success: true,
      submissionId: properties['Submission ID'],
      notionId: notionData.id,
      notionUrl: notionData.url,
      pgId: pgResult ? pgResult.rows[0].id : null,
      message: pgResult ? 'Successfully saved to both databases' : 'Saved to Notion only',
      syncStatus: pgResult ? 'complete' : 'partial'
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}