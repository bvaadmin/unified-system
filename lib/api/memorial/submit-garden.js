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

    // Detect if this is a simplified prepayment submission
    const isSimplifiedPrepayment = properties['Application Type'] === 'future' && 
                                   properties['Simplified'] === true;

    // Extract personal history from JSON (only for non-simplified submissions)
    let personalHistory = {};
    if (!isSimplifiedPrepayment) {
      try {
        personalHistory = JSON.parse(properties['Personal History JSON'] || '{}');
      } catch (e) {
        console.error('Error parsing personal history:', e);
      }
    }

    // 1. Save to PostgreSQL (if available)
    let pgResult = null;
    if (pgClient) {
      try {
        console.log('Attempting PostgreSQL connection...');
        await pgClient.connect();
        console.log('PostgreSQL connected successfully');
        
        // Handle simplified prepayments differently
        if (isSimplifiedPrepayment) {
          console.log('Processing simplified prepayment submission');
          
          // Store prepayment in memorials table with special marker
          // TODO: Create dedicated prepayments table
          const prepaymentQuery = `
            INSERT INTO bayview.memorials (
              submission_id,
              first_name,
              last_name,
              message,
              bayview_history,
              application_type,
              is_member,
              member_name,
              member_relationship,
              contact_name,
              contact_email,
              contact_phone,
              contact_address,
              fee_amount
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING id, created_at
          `;
          
          const prepaymentValues = [
            properties['Submission ID'] || '',
            'PREPAYMENT', // Special marker in first_name
            'FUTURE', // Special marker in last_name
            `Prepayment Names: ${properties['Prepayment Person 1'] || ''}${properties['Prepayment Person 2'] ? ', ' + properties['Prepayment Person 2'] : ''}`,
            `Prepayment for future placement. Person 1: ${properties['Prepayment Person 1'] || 'N/A'}, Person 2: ${properties['Prepayment Person 2'] || 'N/A'}`,
            'future',
            properties['Bay View Member'] === 'Yes',
            properties['Member Name'] || null,
            properties['Member Relationship'] || null,
            properties['Contact Name'] || '',
            properties['Contact Email'] || null,
            properties['Contact Phone'] || '',
            properties['Contact Address'] || null,
            parseFloat(properties['Fee Amount']) || 0
          ];
          
          pgResult = await pgClient.query(prepaymentQuery, prepaymentValues);
          console.log('Prepayment stored in memorials table:', pgResult.rows[0]);
          
        } else {
          // Original full memorial record insertion
          console.log('Processing full memorial application');
        
        // Create the memorial record - matching ACTUAL database schema
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
            is_member,
            member_name,
            member_relationship,
            contact_name,
            contact_email,
            contact_phone,
            contact_address,
            service_date,
            celebrant_requested,
            fee_amount
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
          RETURNING id, created_at
        `;
        
        // Note: For multiple persons, we currently store first person only
        // TODO: Implement proper memorial_persons table for multiple deceased
        
        // For immediate placement, extract first person's details
        let primaryFirstName = '';
        let primaryLastName = '';
        let primaryMiddleName = '';
        let primaryMaidenName = '';
        
        if (properties['Application Type'] === 'immediate') {
          // Try to get from First Name/Last Name fields or parse from Deceased Name
          primaryFirstName = properties['First Name'] || personalHistory.firstName || properties['Deceased Name']?.split(' ')[0] || '';
          primaryLastName = properties['Last Name'] || personalHistory.lastName || properties['Deceased Name']?.split(' ').slice(-1)[0] || '';
          primaryMiddleName = properties['Middle Name'] || personalHistory.middleName || '';
          primaryMaidenName = properties['Maiden Name'] || personalHistory.maidenName || '';
        }
        
        // Build combined bayview history including all persons if multiple
        let combinedBayviewHistory = personalHistory.bayviewHistory || '';
        if (properties['Second First Name'] || properties['Second Last Name']) {
          combinedBayviewHistory += `\n\nSecond Person: ${properties['Second First Name'] || ''} ${properties['Second Last Name'] || ''}`;
        }
        
        const values = [
          properties['Submission ID'] || '',
          primaryFirstName,
          primaryLastName,
          primaryMiddleName,
          primaryMaidenName,
          personalHistory.birthDate || null,
          personalHistory.deathDate || null,
          personalHistory.birthPlace || '',
          personalHistory.homeAddress || '',
          personalHistory.bayviewAddress || '',
          personalHistory.motherName || '',
          personalHistory.fatherName || '',
          properties.message || properties['Bay View History'] || '',
          combinedBayviewHistory,
          properties['Application Type'] || '',
          properties['Bay View Member'] === 'Yes',
          properties['Member Name'] || '',
          properties['Member Relationship'] || '',
          properties['Contact Name'] || '',
          properties['Contact Email'] || '',
          properties['Contact Phone'] || '',
          properties['Contact Address'] || '',
          properties['date:Service Date:start'] || properties['Requested Service Date'] || null,
          properties['Celebrant Requested'] || '',
          parseFloat(properties['Fee Amount']) || 0
        ];
        
        pgResult = await pgClient.query(insertQuery, values);
        console.log('PostgreSQL insert successful:', pgResult.rows[0]);
        }
        
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
    // Prepare Notion properties based on submission type
    let notionProperties = {
      'Submission ID': {
        title: [{ text: { content: properties['Submission ID'] || '' } }]
      },
      'Submission Date': properties['date:Submission Date:start'] ? {
        date: { start: properties['date:Submission Date:start'] }
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
      'Fee Amount': properties['Fee Amount'] ? {
        number: Number(properties['Fee Amount'])
      } : undefined,
      'Policy Agreement': {
        checkbox: properties['Policy Agreement'] === '__YES__'
      },
      'Placement Type': properties['Placement Type'] ? {
        select: { name: properties['Placement Type'] }
      } : undefined
    };

    // Add simplified prepayment fields if applicable
    if (isSimplifiedPrepayment) {
      notionProperties['Prepayment Names'] = properties['Prepayment Names'] ? {
        rich_text: [{ text: { content: properties['Prepayment Names'] } }]
      } : undefined;
      // Add prepayment note in an existing field (Bay View History is available)
      notionProperties['Bay View History'] = {
        rich_text: [{ text: { content: `SIMPLIFIED PREPAYMENT - Names only: ${properties['Prepayment Person 1'] || ''}${properties['Prepayment Person 2'] ? ', ' + properties['Prepayment Person 2'] : ''}` } }]
      };
    } else {
      // Add full application fields for immediate placements
      notionProperties['Service Date'] = properties['date:Service Date:start'] ? {
        date: { start: properties['date:Service Date:start'] }
      } : undefined;
      notionProperties['Deceased Name'] = properties['Deceased Name'] ? {
        rich_text: [{ text: { content: properties['Deceased Name'] } }]
      } : undefined;
      notionProperties['Member Name'] = properties['Member Name'] ? {
        rich_text: [{ text: { content: properties['Member Name'] } }]
      } : undefined;
      notionProperties['Member Relationship'] = properties['Member Relationship'] ? {
        rich_text: [{ text: { content: properties['Member Relationship'] } }]
      } : undefined;
      notionProperties['Bay View History'] = properties['Bay View History'] ? {
        rich_text: [{ text: { content: properties['Bay View History'] } }]
      } : undefined;
      notionProperties['Personal History JSON'] = properties['Personal History JSON'] ? {
        rich_text: [{ text: { content: properties['Personal History JSON'] } }]
      } : undefined;
      notionProperties['Celebrant Requested'] = properties['Celebrant Requested'] ? {
        select: { name: properties['Celebrant Requested'] }
      } : undefined;
      notionProperties['Other Person JSON'] = properties['Other Person JSON'] ? {
        rich_text: [{ text: { content: properties['Other Person JSON'] } }]
      } : undefined;
      notionProperties['Second Person JSON'] = properties['Second Person JSON'] ? {
        rich_text: [{ text: { content: properties['Second Person JSON'] } }]
      } : undefined;
    }

    // Add PostgreSQL ID if successful
    if (pgResult) {
      notionProperties['Database ID'] = {
        rich_text: [{ text: { content: pgResult.rows[0].id.toString() } }]
      };
    }

    const notionResponse = await fetch(`https://api.notion.com/v1/pages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        parent: { database_id: NOTION_DATABASE_ID },
        properties: notionProperties
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
      message: isSimplifiedPrepayment 
        ? 'Prepayment application saved successfully' 
        : (pgResult ? 'Successfully saved to both databases' : 'Saved to Notion only'),
      syncStatus: pgResult ? 'complete' : 'partial',
      submissionType: isSimplifiedPrepayment ? 'prepayment' : 'memorial'
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}