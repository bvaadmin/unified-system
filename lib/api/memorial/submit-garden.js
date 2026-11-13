// Memorial Garden placement and prepayment applications → SharePoint
// "Memorial Garden Applications" list on the worship site.
// The form (forms/memorial-garden.js) posts { properties } keyed by the old
// Notion property names; this maps them onto the List's columns.
// CORS and OPTIONS are handled by the router in api/index.js.

import { WORSHIP_LISTS, saveSubmission, spText, spNote, spDate, spNumber, spChoice } from '../../sharepoint.js';

// The person sections arrive as JSON strings; the List keeps each detail in its own column.
function parsePerson(json) {
  try { return JSON.parse(json || '{}') || {}; } catch { return {}; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { properties } = req.body || {};
  if (!properties || typeof properties !== 'object') {
    return res.status(400).json({ error: 'Missing application details' });
  }

  try {
    const isSimplifiedPrepayment = properties['Application Type'] === 'future' && properties['Simplified'] === true;
    const isPrepayment = properties['Application Type'] === 'future';

    // Choice columns reject unknown values, so anything off-list goes to Process Notes.
    const celebrant = properties['Celebrant Requested'];
    const celebrantChoice = spChoice(celebrant, ['Yes - Bay View celebrant', 'No - Own celebrant', 'Undecided', 'Yes - Request Bay View celebrant']);

    const primary = parsePerson(properties['Personal History JSON']);
    const other = parsePerson(properties['Other Person JSON'] || properties['Second Person JSON']);
    const otherName = [other.firstName, other.middleName, other.lastName].map(s => (s || '').trim()).filter(Boolean).join(' ');

    // Readable title, e.g. "James Lynn Frick (placement)"; the MG- code goes to Submission ID.
    let titleNames;
    if (isSimplifiedPrepayment) {
      titleNames = [properties['Prepayment Person 1'], properties['Prepayment Person 2']].map(s => (s || '').trim()).filter(Boolean).join(' and ');
    } else {
      titleNames = (properties['Deceased Name'] || '').trim();
      if (otherName && !titleNames.includes((other.firstName || '').trim())) {
        titleNames = titleNames ? `${titleNames} and ${otherName}` : otherName;
      }
    }
    const title = titleNames
      ? `${titleNames} (${isPrepayment ? 'prepayment' : 'placement'})`
      : `${isPrepayment ? 'Prepayment' : 'Placement'}, name not given (${(properties['Contact Name'] || 'no contact').trim()})`;

    const listFields = {
      Title: spText(title),
      SubmissionID: spText(properties['Submission ID']),
      Status: spChoice(properties['Status'], ['Submitted', 'Under Review', 'Approved', 'Payment Pending', 'Completed', 'Rejected', 'Pending']),
      ApplicationType: spChoice(properties['Application Type'], ['Immediate Placement', 'Prepayment', 'Payment for immediate placement of ashes', 'future', 'immediate']),
      PlacementType: spChoice(properties['Placement Type'], ['self', 'self_and_other', 'two_others', 'one_person', 'two_people', 'single', 'double', 'immediate']),
      SubmissionDate: spDate(properties['date:Submission Date:start']),
      BayViewMember: spChoice(properties['Bay View Member'], ['Yes', 'No']),
      ContactName: spText(properties['Contact Name']),
      ContactPhone: spText(properties['Contact Phone']),
      ContactEmail: spText(properties['Contact Email']),
      ContactAddress: spNote(properties['Contact Address']),
      FeeAmount: spNumber(properties['Fee Amount']),
      PolicyAgreement: properties['Policy Agreement'] === '__YES__'
    };
    if (isSimplifiedPrepayment) {
      Object.assign(listFields, {
        PrepaymentNames: spNote(properties['Prepayment Names']),
        BayViewHistory: `SIMPLIFIED PREPAYMENT - Names only: ${properties['Prepayment Person 1'] || ''}${properties['Prepayment Person 2'] ? ', ' + properties['Prepayment Person 2'] : ''}`
      });
    } else {
      Object.assign(listFields, {
        ServiceDate: spDate(properties['date:Service Date:start']),
        DeceasedName: spText(properties['Deceased Name']),
        MemberName: spText(properties['Member Name']),
        MemberRelationship: spText(properties['Member Relationship']),
        BayViewHistory: spNote(properties['Bay View History']),
        CelebrantRequested: celebrantChoice,
        ProcessNotes: celebrant && !celebrantChoice ? spNote(`Celebrant requested: ${celebrant}`) : undefined,
        BirthDate: spDate(primary.birthDate),
        DeathDate: spDate(primary.deathDate),
        BirthPlace: spText(primary.birthPlace),
        MaidenName: spText(primary.maidenName),
        MotherName: spText(primary.motherName),
        FatherName: spText(primary.fatherName),
        SecondPersonName: spText(otherName),
        SecondPersonBirthDate: spDate(other.birthDate),
        SecondPersonDeathDate: spDate(other.deathDate),
        SecondPersonMaidenName: spText(other.maidenName),
        SecondPersonMotherName: spText(other.motherName),
        SecondPersonFatherName: spText(other.fatherName),
        SecondPersonBayViewHistory: spNote(other.bayviewHistory)
      });
    }

    const submissionId = properties['Submission ID'];
    const saved = await saveSubmission({ label: submissionId || 'memorial-garden', listId: WORSHIP_LISTS.memorialGarden, fields: listFields });

    return res.status(200).json({
      success: true,
      submissionId,
      sharePointItemId: saved.id,
      submissionType: isSimplifiedPrepayment ? 'prepayment' : 'memorial',
      message: isSimplifiedPrepayment ? 'Prepayment application saved successfully' : 'Application saved successfully'
    });
  } catch (error) {
    console.error('Error submitting memorial garden application:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
