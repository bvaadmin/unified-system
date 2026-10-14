// API handler for Crouse Chapel service applications (wedding, memorial, funeral, baptism, general-use)
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

  if (!formType || !['wedding', 'memorial-funeral-service', 'baptism', 'general-use'].includes(formType)) {
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

    // Checkboxes arrive as 'on' from most forms but as booleans from the wedding form
    const isOn = (v) => v === true || v === 'on';
    const isVowRenewal = formType === 'wedding' && formData.ceremonyType === 'vow-renewal';

    // Calculate fee
    const isMember = formData.isBayViewMember === 'yes';
    let fee = 0;
    if (isVowRenewal) {
      fee = isMember ? 225 : 560; // 3/4 of the wedding fee, set June 2026
    } else if (formType === 'wedding') {
      fee = isMember ? 300 : 750;
    } else if (formType === 'baptism') {
      // Chapel-use fee only; the officiant takes no honorarium for a baptism (Jason Byassee, 8/1/26)
      fee = isMember ? 75 : 150;
    } else if (formType === 'general-use') {
      fee = 0; // Non-traditional use; staff sets fee on review per policy
    } else {
      fee = isMember ? 150 : 325; // As per policy for members, non-member fee from previous logic
    }

    // Determine performance location
    let performanceLocation = null;
    if (isOn(formData.performSanctuary) && isOn(formData.performBalcony)) {
      performanceLocation = 'Both';
    } else if (isOn(formData.performSanctuary)) {
      performanceLocation = 'Sanctuary';
    } else if (isOn(formData.performBalcony)) {
      performanceLocation = 'Balcony';
    }

    // Build Notion properties
    const notionProperties = {
      'Application ID': toNotionProperty(submissionId, 'title'),
      'Type': toNotionProperty(
        formType === 'wedding' ? 'Wedding'
          : formType === 'baptism' ? 'Baptism'
          : formType === 'general-use' ? 'General Use'
          : 'Memorial',
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
      'Bay View Member': toNotionProperty(
        [formData.memberName, formData.memberContact].filter(Boolean).join(' | '), 'rich_text'
      ),
      'Member Relationship': toNotionProperty(formData.memberRelationship || '', 'rich_text'),

      // Clergy info
      'Clergy Name': toNotionProperty(formData.clergyName || '', 'rich_text'),

      // Music
      'Has Music': toNotionProperty(isOn(formData.hasMusic), 'checkbox'),
      'Needs Piano': toNotionProperty(isOn(formData.needsPiano), 'checkbox'),
      'Needs Organ': toNotionProperty(isOn(formData.needsOrgan), 'checkbox'),
      'Performance Location': performanceLocation ? toNotionProperty(performanceLocation, 'select') : undefined,
      'Additional Chairs': toNotionProperty(
        isOn(formData.needsChairs) ? `${formData.chairCount || 0} chairs - ${formData.chairPlacement || 'TBD'}` : '', 'rich_text'
      ),
      'Musicians List': toNotionProperty([
        formData.organistName ? `Organist: ${formData.organistName}` : '',
        formData.soloistName ? `Soloist: ${formData.soloistName}` : '',
        formData.otherMusicians || '',
        ...(Array.isArray(formData.musicians)
          ? formData.musicians.map(m => [m.name, m.instrument].filter(Boolean).join(' - '))
          : [])
      ].filter(Boolean).join('\n'), 'rich_text'),

      // Equipment
      'Stand Microphone': toNotionProperty(isOn(formData.standMic), 'checkbox'),
      'Wireless Microphone': toNotionProperty(isOn(formData.wirelessMic), 'checkbox'),
      'CD Player': toNotionProperty(isOn(formData.cdPlayer), 'checkbox'),
      'Communion Service': toNotionProperty(isOn(formData.communion), 'checkbox'),
      'Guest Book Stand': toNotionProperty(isOn(formData.guestBook), 'checkbox'),
      'Roped Seating': toNotionProperty(
        isOn(formData.ropedSeating) ? `${formData.rowsLeft || 0} rows left, ${formData.rowsRight || 0} rows right` : '', 'rich_text'
      ),

      // Policy
      'Policy Acknowledged': toNotionProperty(isOn(formData.policyAgreement), 'checkbox'),
    };

    // Add form-type specific fields
    if (formType === 'wedding') {
      notionProperties['Couple Names'] = toNotionProperty(formData.coupleNames || '', 'rich_text');
      notionProperties['Guest Count'] = toNotionProperty(parseInt(formData.guestCount) || 0, 'number');
      notionProperties['Wedding Fee'] = toNotionProperty(fee, 'number');
      notionProperties['Rehearsal Date'] = formData.rehearsalDate ?
        toNotionProperty(formData.rehearsalDate, 'date') : undefined;
      notionProperties['Rehearsal Time'] = toNotionProperty(formData.rehearsalTime || '', 'rich_text');
      const weddingNotes = [
        isVowRenewal ? 'VOW RENEWAL' : '',
        formData.specialRequests || ''
      ].filter(Boolean).join('\n');
      if (weddingNotes) {
        notionProperties['Notes'] = toNotionProperty(weddingNotes, 'rich_text');
      }
    } else if (formType === 'general-use') {
      notionProperties['Event Description'] = toNotionProperty(formData.eventDescription || '', 'rich_text');
      notionProperties['Organization Name'] = toNotionProperty(formData.organizationName || '', 'rich_text');
      if (formData.specialRequests) {
        notionProperties['Notes'] = toNotionProperty(formData.specialRequests, 'rich_text');
      }
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
      const memorialNotes = [
        formData.placementDate ? `Garden placement: ${formData.placementDate} ${formData.placementTime || ''}`.trim() : '',
        formData.otherEquipment ? `Other equipment: ${formData.otherEquipment}` : '',
        formData.specialRequests || ''
      ].filter(Boolean).join('\n');
      if (memorialNotes) {
        notionProperties['Notes'] = toNotionProperty(memorialNotes, 'rich_text');
      }
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
          isVowRenewal,
          coupleNames: formData.coupleNames,
          deceasedName: formData.deceasedName,
          baptismPersonName: formData.baptismPersonName,
          organizationName: formData.organizationName
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
        `Your ${isVowRenewal ? 'vow renewal' : 'wedding'} application will be reviewed by the Director of Worship`,
        'You will be contacted within 2-3 business days',
        'Full payment is required to secure your date',
        'Clergy must be approved before the service',
        'The Altar Guild will be notified upon approval'
      ] : formType === 'baptism' ? [
        'Your baptism application will be reviewed by the Director of Worship and Religious Life',
        'You will be contacted within 2-3 business days to confirm the date and clergy',
        'The Altar Guild will be notified upon approval'
      ] : formType === 'general-use' ? [
        'Your application will be reviewed by chapel staff',
        'You will be contacted within 2-3 business days to confirm availability and fees',
        'Fees will be determined based on the nature of your event'
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
