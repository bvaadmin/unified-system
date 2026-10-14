import sgMail from '@sendgrid/mail';

// Initialize SendGrid with API key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

/**
 * Send memorial garden confirmation email
 * @param {Object} data - Application data
 * @param {string} data.contactEmail - Recipient email
 * @param {string} data.contactName - Recipient name
 * @param {string} data.submissionId - Submission ID
 * @param {string} data.applicationType - 'immediate' or 'future'
 * @param {number} data.feeAmount - Fee amount
 * @param {boolean} data.isMember - Member status
 * @param {Array} data.persons - List of persons for placement
 * @returns {Promise<boolean>} Success status
 */
export async function sendMemorialConfirmation(data) {
  if (!process.env.SENDGRID_API_KEY) {
    console.log('SendGrid not configured, skipping email');
    return false;
  }

  const { 
    contactEmail, 
    contactName, 
    submissionId, 
    applicationType, 
    feeAmount,
    isMember,
    persons = []
  } = data;

  // Create email content based on application type
  const subject = applicationType === 'immediate' 
    ? 'Memorial Garden Application Received'
    : 'Memorial Garden Prepayment Application Received';

  const personsList = persons.length > 0 
    ? persons.map(p => `• ${p}`).join('\n')
    : 'Names to be determined';

  const memberStatus = isMember ? 'Bay View Member' : 'Non-Member';
  
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Thank You for Your Memorial Garden Application</h2>
      
      <p>Dear ${contactName},</p>
      
      <p>We have received your Memorial Garden ${applicationType === 'future' ? 'prepayment' : ''} application. 
      Your submission has been recorded and will be reviewed by our staff.</p>
      
      <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3>Application Details:</h3>
        <p><strong>Submission ID:</strong> ${submissionId}</p>
        <p><strong>Application Type:</strong> ${applicationType === 'immediate' ? 'Immediate Placement' : 'Prepayment for Future Use'}</p>
        <p><strong>Membership Status:</strong> ${memberStatus}</p>
        <p><strong>Fee Amount:</strong> $${feeAmount.toFixed(2)}</p>
        ${applicationType === 'immediate' ? `<p><strong>Placement for:</strong><br>${personsList}</p>` : ''}
      </div>
      
      <h3>Next Steps:</h3>
      <ol>
        <li>Our staff will review your application within 2-3 business days</li>
        <li>Payment of $${feeAmount.toFixed(2)} is required to secure your ${applicationType === 'future' ? 'prepayment' : 'placement'}</li>
        <li>Please mail your check to:<br>
            Bay View Association<br>
            P.O. Box 583<br>
            Petoskey, MI 49770<br>
            <em>Include "Memorial Garden - ${submissionId}" in the memo line</em>
        </li>
        ${applicationType === 'immediate' ? '<li>Once payment is received, we will coordinate the memorial placement details with you</li>' : '<li>Your prepayment locks in today\'s rate for future use</li>'}
      </ol>
      
      <div style="background: #e8f0ff; border: 1px solid #b8d4f0; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Questions?</strong><br>
        Contact the Bay View Business Office at (231) 347-6225<br>
        or email worshipservices@bayviewassociation.org</p>
      </div>
      
      <p>Thank you for choosing the Bay View Memorial Garden.</p>
      
      <p>Sincerely,<br>
      Bay View Association<br>
      Worship Services Department</p>
    </div>
  `;

  const textContent = `
Thank You for Your Memorial Garden Application

Dear ${contactName},

We have received your Memorial Garden ${applicationType === 'future' ? 'prepayment' : ''} application.

Application Details:
- Submission ID: ${submissionId}
- Application Type: ${applicationType === 'immediate' ? 'Immediate Placement' : 'Prepayment for Future Use'}
- Membership Status: ${memberStatus}
- Fee Amount: $${feeAmount.toFixed(2)}
${applicationType === 'immediate' ? `- Placement for:\n${personsList}` : ''}

Next Steps:
1. Our staff will review your application within 2-3 business days
2. Payment of $${feeAmount.toFixed(2)} is required
3. Please mail your check to:
   Bay View Association
   P.O. Box 583
   Petoskey, MI 49770
   Include "Memorial Garden - ${submissionId}" in the memo line

Questions? Contact us at (231) 347-6225 or worshipservices@bayviewassociation.org

Thank you for choosing the Bay View Memorial Garden.

Sincerely,
Bay View Association
Worship Services Department
  `;

  const msg = {
    to: contactEmail,
    from: {
      email: 'worshipservices@bayviewassociation.org',
      name: 'Bay View Association'
    },
    // cc: 'worshipservices@bayviewassociation.org', // Already sending from this address
    subject: subject,
    text: textContent,
    html: htmlContent,
    trackingSettings: {
      clickTracking: { enable: false },
      openTracking: { enable: false }
    }
  };

  try {
    await sgMail.send(msg);
    console.log(`Confirmation email sent to ${contactEmail} for submission ${submissionId}`);
    return true;
  } catch (error) {
    console.error('SendGrid error:', error);
    if (error.response) {
      console.error('SendGrid response error:', error.response.body);
    }
    return false;
  }
}

/**
 * Send chapel service confirmation email
 * @param {Object} data - Application data
 * @param {string} data.contactEmail - Recipient email
 * @param {string} data.contactName - Recipient name
 * @param {string} data.submissionId - Application ID
 * @param {string} data.formType - 'wedding', 'memorial-funeral-service', 'baptism', or 'general-use'
 * @param {string} data.serviceDate - Service date
 * @param {string} data.serviceTime - Service time
 * @param {number} data.fee - Calculated fee amount
 * @param {string} [data.coupleNames] - Wedding couple names
 * @param {string} [data.deceasedName] - Deceased name (memorial/funeral)
 * @param {string} [data.baptismPersonName] - Person being baptized
 * @param {string} [data.organizationName] - Organization (general-use)
 * @returns {Promise<boolean>} Success status
 */
export async function sendChapelConfirmation(data) {
  if (!process.env.SENDGRID_API_KEY) {
    console.log('SendGrid not configured, skipping chapel email');
    return false;
  }

  const {
    contactEmail,
    contactName,
    submissionId,
    formType,
    serviceDate,
    serviceTime,
    fee,
    isVowRenewal,
    coupleNames,
    deceasedName,
    baptismPersonName,
    organizationName
  } = data;

  const isWedding = formType === 'wedding';
  const isBaptism = formType === 'baptism';
  const isGeneralUse = formType === 'general-use';
  const serviceLabel = isWedding ? (isVowRenewal ? 'Vow Renewal' : 'Wedding')
    : isBaptism ? 'Baptism'
    : isGeneralUse ? 'Chapel Use'
    : 'Memorial Service';
  const subject = `Chapel ${serviceLabel} Application Received`;

  const formattedDate = serviceDate
    ? new Date(serviceDate + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      })
    : 'To be confirmed';

  const detailLine = isWedding && coupleNames
    ? `<p><strong>Couple:</strong> ${coupleNames}</p>`
    : isBaptism && baptismPersonName
      ? `<p><strong>Person to be Baptized:</strong> ${baptismPersonName}</p>`
      : isGeneralUse && organizationName
        ? `<p><strong>Organization:</strong> ${organizationName}</p>`
        : (!isWedding && !isBaptism && !isGeneralUse && deceasedName ? `<p><strong>In Memory of:</strong> ${deceasedName}</p>` : '');

  const nextSteps = isWedding
    ? `<ol>
        <li>Your ${serviceLabel.toLowerCase()} application will be reviewed by the Director of Worship</li>
        <li>You will be contacted within 2-3 business days</li>
        <li>Payment of $${fee.toFixed(2)} is required to secure your date</li>
        <li>Clergy must be approved before the service</li>
        <li>The Altar Guild will be notified upon approval</li>
      </ol>`
    : isBaptism
      ? `<ol>
        <li>Your baptism application will be reviewed by the Director of Worship and Religious Life</li>
        <li>You will be contacted within 2-3 business days to confirm the date and clergy</li>
        <li>The Altar Guild will be notified upon approval</li>
      </ol>`
      : isGeneralUse
        ? `<ol>
        <li>Your application will be reviewed by chapel staff</li>
        <li>You will be contacted within 2-3 business days to confirm availability</li>
        <li>Fees will be determined based on the nature of your event and communicated upon approval</li>
      </ol>`
        : `<ol>
        <li>Your memorial service application will be reviewed</li>
        <li>You will be contacted within 2-3 business days</li>
        <li>Clergy arrangements will be confirmed</li>
      </ol>`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Thank You for Your Crouse Chapel ${serviceLabel} Application</h2>

      <p>Dear ${contactName},</p>

      <p>We have received your ${serviceLabel.toLowerCase()} application for Crouse Chapel.
      Your submission has been recorded and will be reviewed by our staff.</p>

      <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3>Application Details:</h3>
        <p><strong>Application ID:</strong> ${submissionId}</p>
        <p><strong>Service Type:</strong> ${serviceLabel}</p>
        <p><strong>Service Date:</strong> ${formattedDate}</p>
        ${serviceTime ? `<p><strong>Service Time:</strong> ${serviceTime}</p>` : ''}
        ${detailLine}
        ${isGeneralUse ? '<p><strong>Fee:</strong> To be determined upon review</p>' : `<p><strong>Fee:</strong> $${fee.toFixed(2)}</p>`}
      </div>

      <h3>Next Steps:</h3>
      ${nextSteps}

      ${`<p><strong>Payment:</strong> Please mail a check payable to Bay View Association to P.O. Box 583, Petoskey, MI 49770, Attn: Chapel.${isGeneralUse ? ' We will confirm the amount once your request is reviewed.' : ''}</p>`}

      <div style="background: #e8f0ff; border: 1px solid #b8d4f0; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Questions?</strong><br>
        Contact the Bay View Business Office at (231) 347-6225<br>
        or email worshipservices@bayviewassociation.org</p>
      </div>

      <p>Thank you for choosing Crouse Chapel at Bay View.</p>

      <p>Sincerely,<br>
      Bay View Association<br>
      Worship Services Department</p>
    </div>
  `;

  const textContent = `
Thank You for Your Crouse Chapel ${serviceLabel} Application

Dear ${contactName},

We have received your ${serviceLabel.toLowerCase()} application for Crouse Chapel.

Application Details:
- Application ID: ${submissionId}
- Service Type: ${serviceLabel}
- Service Date: ${formattedDate}
${serviceTime ? `- Service Time: ${serviceTime}` : ''}
${isWedding && coupleNames ? `- Couple: ${coupleNames}` : ''}
${isBaptism && baptismPersonName ? `- Person to be Baptized: ${baptismPersonName}` : ''}
${isGeneralUse && organizationName ? `- Organization: ${organizationName}` : ''}
${!isWedding && !isBaptism && !isGeneralUse && deceasedName ? `- In Memory of: ${deceasedName}` : ''}
${isGeneralUse ? '- Fee: To be determined upon review' : `- Fee: $${fee.toFixed(2)}`}

Next Steps:
${isWedding
  ? `1. Your ${serviceLabel.toLowerCase()} application will be reviewed by the Director of Worship
2. You will be contacted within 2-3 business days
3. Payment of $${fee.toFixed(2)} is required to secure your date
4. Clergy must be approved before the service
5. The Altar Guild will be notified upon approval`
  : isBaptism
    ? `1. Your baptism application will be reviewed by the Director of Worship and Religious Life
2. You will be contacted within 2-3 business days to confirm the date and clergy
3. The Altar Guild will be notified upon approval`
    : isGeneralUse
      ? `1. Your application will be reviewed by chapel staff
2. You will be contacted within 2-3 business days to confirm availability
3. Fees will be determined based on the nature of your event and communicated upon approval`
      : `1. Your memorial service application will be reviewed
2. You will be contacted within 2-3 business days
3. Clergy arrangements will be confirmed`}

${`Payment: Please mail a check payable to Bay View Association to P.O. Box 583, Petoskey, MI 49770, Attn: Chapel.${isGeneralUse ? ' We will confirm the amount once your request is reviewed.' : ''}

`}Questions? Contact us at (231) 347-6225 or worshipservices@bayviewassociation.org

Thank you for choosing Crouse Chapel at Bay View.

Sincerely,
Bay View Association
Worship Services Department
  `;

  const msg = {
    to: contactEmail,
    from: {
      email: 'worshipservices@bayviewassociation.org',
      name: 'Bay View Association'
    },
    subject: subject,
    text: textContent,
    html: htmlContent,
    trackingSettings: {
      clickTracking: { enable: false },
      openTracking: { enable: false }
    }
  };

  try {
    await sgMail.send(msg);
    console.log(`Chapel confirmation email sent to ${contactEmail} for ${submissionId}`);
    return true;
  } catch (error) {
    console.error('SendGrid error (chapel):', error);
    if (error.response) {
      console.error('SendGrid response error:', error.response.body);
    }
    return false;
  }
}

const WORSHIP_OFFICE_EMAIL = 'worshipservices@bayviewassociation.org';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Send preacher recommendation emails: a confirmation to the recommender and a
 * notification to the worship office.
 * @returns {Promise<{confirmation: boolean, notification: boolean}>}
 */
export async function sendPreacherRecommendationEmails({ submissionId, submissionDate, formData, notionUrl }) {
  const result = { confirmation: false, notification: false };
  if (!process.env.SENDGRID_API_KEY) {
    console.log('SendGrid not configured, skipping email');
    return result;
  }

  const from = { email: WORSHIP_OFFICE_EMAIL, name: 'Bay View Association' };
  const noTracking = { clickTracking: { enable: false }, openTracking: { enable: false } };
  const preacherName = formData.preacherName?.trim() || 'the recommended preacher';
  const recommenderName = formData.recommenderName?.trim() || 'Friend';
  const submitted = new Date(submissionDate).toLocaleString('en-US', { timeZone: 'America/Detroit' });

  const rows = [
    ['Recommended Preacher', formData.preacherName],
    ['Title / Position', formData.preacherTitle],
    ['Preacher Address', formData.preacherAddress],
    ['Preacher Email', formData.preacherEmail],
    ['Preacher Phone', formData.preacherPhone],
    ['Why Bay View', formData.whyBayView],
    ['Online Sources', formData.onlineSources],
    ['Relationship', formData.relationship],
    ['Additional Materials', formData.additionalMaterials],
    ['Recommended By', formData.recommenderName],
    ['Recommender Email', formData.recommenderEmail],
    ['Recommender Phone', formData.recommenderPhone],
    ['Recommender Address', formData.recommenderAddress]
  ].filter(([, v]) => (v ?? '').toString().trim());

  const tableHtml = rows.map(([k, v]) =>
    `<tr><td style="padding:6px 10px;vertical-align:top;font-weight:bold;white-space:nowrap;">${escapeHtml(k)}</td><td style="padding:6px 10px;white-space:pre-wrap;">${escapeHtml(v)}</td></tr>`
  ).join('');
  const tableText = rows.map(([k, v]) => `${k}: ${v}`).join('\n');

  try {
    await sgMail.send({
      to: formData.recommenderEmail,
      from,
      subject: `Thank you for recommending ${preacherName} to Bay View`,
      text: `Dear ${recommenderName},

Thank you for recommending ${preacherName} as a visiting preacher at Bay View. We have received your recommendation.

Confirmation ID: ${submissionId}
Submitted: ${submitted}

The Director of Worship and Religious Life reviews every recommendation as the preaching roster is planned. If we would like more information, we will reach out to you at this address. Supporting materials (vita, testimonials, recordings) can be emailed to ${WORSHIP_OFFICE_EMAIL} — please include your confirmation ID.

Your submission:
${tableText}

Bay View Worship
Bay View Association of the United Methodist Church
1715 Encampment Ave., P.O. Box 583, Petoskey, MI 49770
${WORSHIP_OFFICE_EMAIL} · 231.881.9771`,
      html: `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
      <h2>Thank You for Your Recommendation</h2>
      <p>Dear ${escapeHtml(recommenderName)},</p>
      <p>Thank you for recommending <strong>${escapeHtml(preacherName)}</strong> as a visiting preacher at Bay View. We have received your recommendation.</p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Confirmation ID:</strong> ${escapeHtml(submissionId)}<br>
        <strong>Submitted:</strong> ${escapeHtml(submitted)}</p>
      </div>
      <p>The Director of Worship and Religious Life reviews every recommendation as the preaching roster is planned. If we would like more information, we will reach out to you at this address. Supporting materials (vita, testimonials, recordings) can be emailed to <a href="mailto:${WORSHIP_OFFICE_EMAIL}">${WORSHIP_OFFICE_EMAIL}</a> &mdash; please include your confirmation ID.</p>
      <h3>Your submission</h3>
      <table style="border-collapse: collapse; width: 100%; font-size: 14px;">${tableHtml}</table>
      <p style="margin-top: 30px; color: #555;">Bay View Worship<br>
      Bay View Association of the United Methodist Church<br>
      1715 Encampment Ave., P.O. Box 583, Petoskey, MI 49770<br>
      ${WORSHIP_OFFICE_EMAIL} &middot; 231.881.9771</p>
    </div>`,
      trackingSettings: noTracking
    });
    result.confirmation = true;
  } catch (error) {
    console.error('SendGrid error (preacher confirmation):', error.response?.body || error);
  }

  try {
    await sgMail.send({
      to: WORSHIP_OFFICE_EMAIL,
      from,
      replyTo: formData.recommenderEmail,
      subject: `New preacher recommendation: ${preacherName} (from ${recommenderName})`,
      text: `New visiting preacher recommendation ${submissionId}, submitted ${submitted}.

${tableText}

Notion: ${notionUrl || ''}`,
      html: `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
      <h2>New Visiting Preacher Recommendation</h2>
      <p><strong>${escapeHtml(submissionId)}</strong> &middot; submitted ${escapeHtml(submitted)}</p>
      <table style="border-collapse: collapse; width: 100%; font-size: 14px;">${tableHtml}</table>
      ${notionUrl ? `<p style="margin-top: 20px;"><a href="${escapeHtml(notionUrl)}">Open in Notion</a></p>` : ''}
    </div>`,
      trackingSettings: noTracking
    });
    result.notification = true;
  } catch (error) {
    console.error('SendGrid error (preacher notification):', error.response?.body || error);
  }

  return result;
}

/**
 * Send a test email to verify configuration
 * @param {string} toEmail - Email to send test to
 * @returns {Promise<boolean>} Success status
 */
export async function sendTestEmail(toEmail) {
  if (!process.env.SENDGRID_API_KEY) {
    throw new Error('SENDGRID_API_KEY not configured');
  }

  const msg = {
    to: toEmail,
    from: {
      email: 'worshipservices@bayviewassociation.org',
      name: 'Bay View Association'
    },
    subject: 'Test Email - Memorial Garden System',
    text: 'This is a test email from the Bay View Memorial Garden system.',
    html: '<p>This is a test email from the Bay View Memorial Garden system.</p>'
  };

  try {
    await sgMail.send(msg);
    return true;
  } catch (error) {
    console.error('Test email error:', error);
    throw error;
  }
}