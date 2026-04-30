// API handler for Crouse Chapel service applications (wedding, memorial, funeral, baptism)
// Notion-only version - saves directly to Notion database for workflow management

import { createNotionPage, toNotionProperty } from '../../notion.js';
import { sendChapelConfirmation } from '../../email/sendgrid.js';

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

  if (!formType || !['wedding', 'memorial-funeral-service', 'baptism'].includes(formType)) {
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
    const isMember = formData.isBayViewMember === 'yes';
    let fee = 0;
    if (formType === 'wedding') {
      fee = (isMember ? 300 : 750) + 25; // Base + audio fee
    } else if (formType === 'baptism') {
      fee = isMember ? 75 : 150;
    } else {
      fee = isMember ? 150 : 325; // As per policy for members, non-member fee from previous logic
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
      'Application ID': toNotionProperty(submissionId, 'title'),
      'Type': toNotionProperty(
        formType === 'wedding' ? 'Wedding' : formType === 'baptism' ? 'Baptism' : 'Memorial',
        'select'
      ),
      'Status': toNotionProperty('Pending Review', 'select'),
      'Service Date': toNotionProperty(formData.serviceDate, 'date'),
      'Service Time': toNotionProperty(formData.serviceTime || '', 'rich_text'),
      'Submitted': toNotionProperty(submissionDate.split('T')[0], 'date'),

      // Contact info
      'Contact Name': toNotionProperty(formData.contactName || '', 'rich_text'),
      'Contact Email': toNotionProperty(formData.contactEmail || null, 'email'),
      'Contact Phone': toNotionProperty(formData.contactPhone || null, 'phone_number'),
      'Contact Address': toNotionProperty(formData.contactAddress || '', 'rich_text'),

      // Bay View member info
      'Bay View Member': toNotionProperty(formData.memberName || '', 'rich_text'),
      'Member Relationship': toNotionProperty(formData.memberRelationship || '', 'rich_text'),

      // Clergy info
      'Clergy Name': toNotionProperty(formData.clergyName || '', 'rich_text'),

      // Music
      'Has Music': toNotionProperty(formData.hasMusic === 'on', 'checkbox'),
      'Needs Piano': toNotionProperty(formData.needsPiano === 'on', 'checkbox'),
      'Needs Organ': toNotionProperty(formData.needsOrgan === 'on', 'checkbox'),
      'Performance Location': performanceLocation ? toNotionProperty(performanceLocation, 'select') : undefined,
      'Additional Chairs': toNotionProperty(
        formData.needsChairs === 'on' ? `${formData.chairCount || 0} chairs - ${formData.chairPlacement || 'TBD'}` : '', 'rich_text'
      ),
      'Musicians List': toNotionProperty([
        formData.organistName ? `Organist: ${formData.organistName}` : '',
        formData.soloistName ? `Soloist: ${formData.soloistName}` : '',
        formData.otherMusicians || ''
      ].filter(Boolean).join('\n'), 'rich_text'),

      // Equipment
      'Stand Microphone': toNotionProperty(formData.standMic === 'on', 'checkbox'),
      'Wireless Microphone': toNotionProperty(formData.wirelessMic === 'on', 'checkbox'),
      'CD Player': toNotionProperty(formData.cdPlayer === 'on', 'checkbox'),
      'Communion Service': toNotionProperty(formData.communion === 'on', 'checkbox'),
      'Guest Book Stand': toNotionProperty(formData.guestBook === 'on', 'checkbox'),
      'Roped Seating': toNotionProperty(
        formData.ropedSeating === 'on' ? `${formData.rowsLeft || 0} rows left, ${formData.rowsRight || 0} rows right` : '', 'rich_text'
      ),

      // Policy
      'Policy Acknowledged': toNotionProperty(formData.policyAgreement === 'on', 'checkbox'),
    };

    // Add form-type specific fields
    if (formType === 'wedding') {
      notionProperties['Couple Names'] = toNotionProperty(formData.coupleNames || '', 'rich_text');
      notionProperties['Guest Count'] = toNotionProperty(parseInt(formData.guestCount) || 0, 'number');
      notionProperties['Wedding Fee'] = toNotionProperty(fee, 'number');
      notionProperties['Rehearsal Date'] = formData.rehearsalDate ?
        toNotionProperty(formData.rehearsalDate, 'date') : undefined;
      notionProperties['Rehearsal Time'] = toNotionProperty(formData.rehearsalTime || '', 'rich_text');
    } else if (formType === 'baptism') {
      notionProperties['Baptism Candidate Name'] = toNotionProperty(formData.baptismPersonName || '', 'rich_text');
      if (formData.serviceDate) {
        notionProperties['Baptism Date'] = toNotionProperty(formData.serviceDate, 'date');
      }
      if (formData.baptismType) {
        notionProperties['Baptism Type'] = toNotionProperty(formData.baptismType, 'select');
      }
      notionProperties['Parents Names'] = toNotionProperty(formData.parentsNames || '', 'rich_text');
      notionProperties['Witnesses'] = toNotionProperty(formData.witnessesGodparents || '', 'rich_text');
      notionProperties['Event Fee'] = toNotionProperty(fee, 'number');
      // DOB / POB have no dedicated columns; pack them into Notes alongside any free-form requests.
      const notes = [
        formData.dateOfBirth ? `Date of Birth: ${formData.dateOfBirth}` : '',
        formData.placeOfBirth ? `Place of Birth: ${formData.placeOfBirth}` : '',
        formData.specialRequests || ''
      ].filter(Boolean).join('\n');
      if (notes) {
        notionProperties['Notes'] = toNotionProperty(notes, 'rich_text');
      }
    } else {
      // Memorial/Funeral specific
      notionProperties['Deceased Name'] = toNotionProperty(formData.deceasedName || '', 'rich_text');
      notionProperties['Memorial Garden Placement'] = toNotionProperty(formData.memorialGarden === 'yes', 'checkbox');
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

    // Send confirmation email
    let emailSent = false;
    if (formData.contactEmail) {
      try {
        emailSent = await sendChapelConfirmation({
          contactEmail: formData.contactEmail,
          contactName: formData.contactName || 'Applicant',
          submissionId,
          formType,
          serviceDate: formData.serviceDate,
          serviceTime: formData.serviceTime,
          fee,
          coupleNames: formData.coupleNames,
          deceasedName: formData.deceasedName,
          baptismPersonName: formData.baptismPersonName
        });
      } catch (emailError) {
        console.error('Error sending chapel confirmation email:', emailError);
        // Don't fail the submission if email fails
      }
    }

    // Return success response
    return res.status(200).json({
      success: true,
      submissionId: submissionId,
      applicationId: submissionId,
      submissionDate: submissionDate,
      notionId: notionResult.id,
      notionUrl: notionResult.url || `https://www.notion.so/${notionResult.id.replace(/-/g, '')}`,
      fee,
      emailSent,
      message: 'Application submitted successfully',
      nextSteps: formType === 'wedding' ? [
        'Your wedding application will be reviewed by the Director of Worship',
        'You will be contacted within 2-3 business days',
        'Full payment is required to secure your date',
        'Clergy must be approved before the service',
        'The Altar Guild will be notified upon approval'
      ] : formType === 'baptism' ? [
        'Your baptism application will be reviewed by the Director of Worship and Religious Life',
        'You will be contacted within 2-3 business days to confirm the date and clergy',
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
