// API handler for Crouse Chapel service applications (wedding, memorial, funeral)
// Notion-only version - saves directly to Notion database for workflow management

import { createNotionPage, toNotionProperty } from '../../notion.js';

export default async function handleChapelSubmission(req, res) {
  // Enable CORS
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

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { formType, data: formData } = req.body;

  if (!formType || !['wedding', 'memorial-funeral-service'].includes(formType)) {
    return res.status(400).json({ error: 'Invalid form type' });
  }

  // Generate submission ID
  const submissionId = `CHAPEL-${Date.now()}`;
  const submissionDate = new Date().toISOString();

  try {
    const CHAPEL_NOTION_DB_ID = process.env.CHAPEL_NOTION_DB_ID;

    if (!CHAPEL_NOTION_DB_ID) {
      return res.status(500).json({
        error: 'Notion database not configured',
        message: 'CHAPEL_NOTION_DB_ID environment variable is required'
      });
    }

    // Calculate fee
    const isMember = formData.isMember === 'yes' || formData.memberRelationship === 'self';
    let fee = 0;
    if (formType === 'wedding') {
      fee = (isMember ? 300 : 750) + 25; // Base + audio fee
    } else {
      fee = isMember ? 25 : 325; // Audio fee only for members, full fee for non-members
    }

    // Determine performance location
    let performanceLocation = null;
    if (formData.performSanctuary === 'on' && formData.performBalcony === 'on') {
      performanceLocation = 'Both';
    } else if (formData.performSanctuary === 'on') {
      performanceLocation = 'Sanctuary';
    } else if (formData.performBalcony === 'on') {
      performanceLocation = 'Balcony';
    }

    // Build Notion properties
    const notionProperties = {
      'Application ID': toNotionProperty('title', submissionId),
      'Type': toNotionProperty('select', formType === 'wedding' ? 'Wedding' : 'Memorial'),
      'Status': toNotionProperty('select', 'Pending Review'),
      'Service Date': toNotionProperty('date', { start: formData.serviceDate }),
      'Service Time': toNotionProperty('rich_text', formData.serviceTime || ''),
      'Submitted': toNotionProperty('date', { start: submissionDate.split('T')[0] }),

      // Contact info
      'Contact Name': toNotionProperty('rich_text', formData.contactName || ''),
      'Contact Email': toNotionProperty('email', formData.contactEmail || null),
      'Contact Phone': toNotionProperty('phone_number', formData.contactPhone || null),
      'Contact Address': toNotionProperty('rich_text', formData.contactAddress || ''),

      // Bay View member info
      'Bay View Member': toNotionProperty('rich_text', formData.memberName || ''),
      'Member Relationship': toNotionProperty('rich_text', formData.memberRelationship || ''),

      // Clergy info
      'Clergy Name': toNotionProperty('rich_text', formData.clergyName || ''),
      'Clergy Email': toNotionProperty('email', formData.clergyEmail || null),
      'Clergy Phone': toNotionProperty('phone_number', formData.clergyPhone || null),

      // Music
      'Has Music': toNotionProperty('checkbox', formData.hasMusic === 'on'),
      'Needs Piano': toNotionProperty('checkbox', formData.needsPiano === 'on'),
      'Needs Organ': toNotionProperty('checkbox', formData.needsOrgan === 'on'),
      'Performance Location': performanceLocation ? toNotionProperty('select', performanceLocation) : undefined,
      'Additional Chairs': toNotionProperty('rich_text',
        formData.needsChairs === 'on' ? `${formData.chairCount || 0} chairs - ${formData.chairPlacement || 'TBD'}` : ''
      ),
      'Musicians List': toNotionProperty('rich_text', [
        formData.organistName ? `Organist: ${formData.organistName}` : '',
        formData.soloistName ? `Soloist: ${formData.soloistName}` : '',
        formData.otherMusicians || ''
      ].filter(Boolean).join('\n')),

      // Equipment
      'Stand Microphone': toNotionProperty('checkbox', formData.standMic === 'on'),
      'Wireless Microphone': toNotionProperty('checkbox', formData.wirelessMic === 'on'),
      'CD Player': toNotionProperty('checkbox', formData.cdPlayer === 'on'),
      'Communion Service': toNotionProperty('checkbox', formData.communion === 'on'),
      'Guest Book Stand': toNotionProperty('checkbox', formData.guestBook === 'on'),
      'Roped Seating': toNotionProperty('rich_text',
        formData.ropedSeating === 'on' ? `${formData.rowsLeft || 0} rows left, ${formData.rowsRight || 0} rows right` : ''
      ),

      // Policy
      'Policy Acknowledged': toNotionProperty('checkbox', formData.policyAgreement === 'on'),
    };

    // Add form-type specific fields
    if (formType === 'wedding') {
      notionProperties['Couple Names'] = toNotionProperty('rich_text', formData.coupleNames || '');
      notionProperties['Guest Count'] = toNotionProperty('number', parseInt(formData.guestCount) || 0);
      notionProperties['Wedding Fee'] = toNotionProperty('number', fee);
      notionProperties['Rehearsal Date'] = formData.rehearsalDate ?
        toNotionProperty('date', { start: formData.rehearsalDate }) : undefined;
      notionProperties['Rehearsal Time'] = toNotionProperty('rich_text', formData.rehearsalTime || '');
    } else {
      // Memorial/Funeral specific
      notionProperties['Deceased Name'] = toNotionProperty('rich_text', formData.deceasedName || '');
      notionProperties['Memorial Garden Placement'] = toNotionProperty('checkbox', formData.memorialGarden === 'yes');
    }

    // Remove undefined properties
    Object.keys(notionProperties).forEach(key => {
      if (notionProperties[key] === undefined) {
        delete notionProperties[key];
      }
    });

    // Create Notion page
    const notionResult = await createNotionPage(CHAPEL_NOTION_DB_ID, notionProperties);

    console.log('Chapel application saved to Notion:', notionResult.id);

    // Return success response
    return res.status(200).json({
      success: true,
      submissionId: submissionId,
      applicationId: submissionId,
      submissionDate: submissionDate,
      notionId: notionResult.id,
      notionUrl: notionResult.url || `https://www.notion.so/${notionResult.id.replace(/-/g, '')}`,
      message: 'Application submitted successfully',
      nextSteps: formType === 'wedding' ? [
        'Your wedding application will be reviewed by the Director of Worship',
        'You will be contacted within 2-3 business days',
        'Full payment is required to secure your date',
        'Clergy must be approved before the service',
        'The Altar Guild will be notified upon approval'
      ] : [
        'Your memorial service application will be reviewed',
        'You will be contacted within 2-3 business days',
        'Clergy arrangements will be confirmed'
      ]
    });

  } catch (error) {
    console.error('Error submitting chapel application:', error);
    return res.status(500).json({
      error: 'Failed to submit application',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
