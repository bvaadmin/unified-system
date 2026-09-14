// Visiting Preacher Recommendation form → Notion "Visiting Preacher Recommendations" DB

import { createNotionPage, toNotionProperty } from '../../notion.js';
import { sendPreacherRecommendationEmails } from '../../email/sendgrid.js';

const DEFAULT_DB_ID = '0aa6341b-d62e-46f0-8b2c-962cd699e3bb';
const NOTION_TEXT_LIMIT = 2000;

const REQUIRED = ['preacherName', 'whyBayView', 'relationship', 'recommenderName', 'recommenderEmail'];

function text(value) {
  const s = (value ?? '').toString().trim();
  return s ? toNotionProperty(s.slice(0, NOTION_TEXT_LIMIT), 'rich_text') : undefined;
}

export default async function handlePreacherRecommendation(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { formType, data: formData } = req.body || {};
  if (formType !== 'preacher-recommendation' || !formData) {
    return res.status(400).json({ error: 'Invalid form type' });
  }

  const missing = REQUIRED.filter(k => !(formData[k] ?? '').toString().trim());
  if (missing.length) {
    return res.status(400).json({ error: 'Missing required fields', fields: missing });
  }

  const submissionId = `PREACHER-${Date.now()}`;
  const submissionDate = new Date().toISOString();
  const dbId = process.env.PREACHER_NOTION_DB_ID || DEFAULT_DB_ID;

  try {
    const properties = {
      'Preacher Name': toNotionProperty(formData.preacherName.trim(), 'title'),
      'Status': toNotionProperty('New', 'select'),
      'Submission Date': toNotionProperty(submissionDate, 'date'),
      'Recommendation ID': toNotionProperty(submissionId, 'rich_text'),
      'Preacher Title': text(formData.preacherTitle),
      'Preacher Address': text(formData.preacherAddress),
      'Preacher Email': formData.preacherEmail?.trim() ? toNotionProperty(formData.preacherEmail.trim(), 'email') : undefined,
      'Preacher Phone': formData.preacherPhone?.trim() ? toNotionProperty(formData.preacherPhone.trim(), 'phone_number') : undefined,
      'Why Bay View': text(formData.whyBayView),
      'Online Sources': text(formData.onlineSources),
      'Relationship': text(formData.relationship),
      'Additional Materials': text(formData.additionalMaterials),
      'Recommender Name': text(formData.recommenderName),
      'Recommender Email': toNotionProperty(formData.recommenderEmail.trim(), 'email'),
      'Recommender Phone': formData.recommenderPhone?.trim() ? toNotionProperty(formData.recommenderPhone.trim(), 'phone_number') : undefined,
      'Recommender Address': text(formData.recommenderAddress)
    };
    for (const key of Object.keys(properties)) {
      if (properties[key] === undefined) delete properties[key];
    }

    const notionResult = await createNotionPage(dbId, properties);
    console.log('Preacher recommendation saved to Notion:', notionResult.id);

    let emailSent = { confirmation: false, notification: false };
    try {
      emailSent = await sendPreacherRecommendationEmails({
        submissionId,
        submissionDate,
        formData,
        notionUrl: notionResult.url
      });
    } catch (emailError) {
      console.error('Error sending preacher recommendation emails:', emailError);
    }

    return res.status(200).json({
      success: true,
      submissionId,
      applicationId: submissionId,
      submissionDate,
      notionId: notionResult.id,
      notionUrl: notionResult.url || `https://www.notion.so/${notionResult.id.replace(/-/g, '')}`,
      emailSent,
      message: 'Recommendation submitted successfully',
      nextSteps: [
        'The Director of Worship and Religious Life reviews every recommendation as the preaching roster is planned',
        'If we would like more information, we will reach out to you at the email address you provided',
        'Supporting materials (vita, testimonials, recordings) can be emailed to worshipservices@bayviewassociation.org — please include your confirmation ID'
      ]
    });
  } catch (error) {
    console.error('Error submitting preacher recommendation:', error);
    return res.status(500).json({
      error: 'Failed to submit recommendation',
      message: error.message
    });
  }
}
