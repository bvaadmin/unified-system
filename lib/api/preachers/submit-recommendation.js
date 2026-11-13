// Visiting Preacher Recommendation form → SharePoint "Visiting Preacher Recommendations" list on the worship site.
// CORS and OPTIONS are handled by the router in api/index.js.

import { WORSHIP_LISTS, saveSubmission, spText, spNote, spDate } from '../../sharepoint.js';

const REQUIRED = ['preacherName', 'whyBayView', 'relationship', 'recommenderName', 'recommenderEmail'];

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

  try {
    const listFields = {
      Title: spText(formData.preacherName),
      Status: 'New',
      SubmissionDate: spDate(submissionDate),
      RecommendationID: submissionId,
      PreacherTitle: spText(formData.preacherTitle),
      PreacherAddress: spNote(formData.preacherAddress),
      PreacherEmail: spText(formData.preacherEmail),
      PreacherPhone: spText(formData.preacherPhone),
      WhyBayView: spNote(formData.whyBayView),
      OnlineSources: spNote(formData.onlineSources),
      Relationship: spText(formData.relationship),
      AdditionalMaterials: spNote(formData.additionalMaterials),
      RecommenderName: spText(formData.recommenderName),
      RecommenderEmail: spText(formData.recommenderEmail),
      RecommenderPhone: spText(formData.recommenderPhone),
      RecommenderAddress: spNote(formData.recommenderAddress)
    };

    const saved = await saveSubmission({ label: submissionId, listId: WORSHIP_LISTS.preacherRecommendations, fields: listFields });

    return res.status(200).json({
      success: true,
      submissionId,
      applicationId: submissionId,
      submissionDate,
      sharePointItemId: saved.id,
      message: 'Recommendation submitted successfully',
      nextSteps: [
        'The Director of Worship and Religious Life reviews every recommendation as the preaching roster is planned',
        'If we would like more information, we will reach out to you at the email address you provided',
        'Supporting materials (vita, testimonials, recordings) can be emailed to worshipservices@bayviewassociation.org — please include your confirmation ID'
      ]
    });
  } catch (error) {
    console.error('Error submitting preacher recommendation:', error);
    return res.status(500).json({ error: 'Failed to submit recommendation', message: error.message });
  }
}
