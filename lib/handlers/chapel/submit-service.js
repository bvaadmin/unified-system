// Crouse Chapel service applications (wedding and vow renewal, memorial/funeral,
// baptism, general use) → SharePoint "Chapel Services" list on the worship site.
// CORS and OPTIONS are handled by the router in api/index.js.

import { WORSHIP_LISTS, saveSubmission, spText, spNote, spDate, spNumber, spChoice } from '../../sharepoint.js';

const FORM_TYPES = ['wedding', 'memorial-funeral-service', 'baptism', 'general-use'];

export default async function handleChapelSubmission(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { formType, data: formData } = req.body || {};
  if (!FORM_TYPES.includes(formType) || !formData) {
    return res.status(400).json({ error: 'Invalid form type' });
  }

  const submissionId = `CHAPEL-${Date.now()}`;
  const submissionDate = new Date().toISOString();

  try {
    // Checkboxes arrive as 'on' from most forms but as booleans from the wedding form
    const isOn = (v) => v === true || v === 'on';
    const isVowRenewal = formType === 'wedding' && formData.ceremonyType === 'vow-renewal';

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
      fee = isMember ? 150 : 325;
    }

    let performanceLocation;
    if (isOn(formData.performSanctuary) && isOn(formData.performBalcony)) {
      performanceLocation = 'Both';
    } else if (isOn(formData.performSanctuary)) {
      performanceLocation = 'Sanctuary';
    } else if (isOn(formData.performBalcony)) {
      performanceLocation = 'Balcony';
    }

    const serviceType = formType === 'wedding' ? 'Wedding'
      : formType === 'baptism' ? 'Baptism'
      : formType === 'general-use' ? 'General Use'
      : 'Memorial';
    const bayViewMember = [formData.memberName, formData.memberContact].filter(Boolean).join(' | ');
    const additionalChairs = isOn(formData.needsChairs) ? `${formData.chairCount || 0} chairs - ${formData.chairPlacement || 'TBD'}` : '';
    const musiciansList = [
      formData.organistName ? `Organist: ${formData.organistName}` : '',
      formData.soloistName ? `Soloist: ${formData.soloistName}` : '',
      formData.otherMusicians || '',
      ...(Array.isArray(formData.musicians)
        ? formData.musicians.map(m => [m.name, m.instrument].filter(Boolean).join(' - '))
        : [])
    ].filter(Boolean).join('\n');
    const ropedSeating = isOn(formData.ropedSeating) ? `${formData.rowsLeft || 0} rows left, ${formData.rowsRight || 0} rows right` : '';

    let notes;
    if (formType === 'wedding') {
      notes = [isVowRenewal ? 'VOW RENEWAL' : '', formData.specialRequests || ''].filter(Boolean).join('\n');
    } else if (formType === 'general-use') {
      notes = formData.specialRequests || '';
    } else if (formType === 'baptism') {
      // DOB / POB have no dedicated columns; pack them into Notes alongside any free-form requests.
      notes = [
        formData.dateOfBirth ? `Date of Birth: ${formData.dateOfBirth}` : '',
        formData.placeOfBirth ? `Place of Birth: ${formData.placeOfBirth}` : '',
        formData.specialRequests || ''
      ].filter(Boolean).join('\n');
    } else {
      notes = [
        formData.placementDate ? `Garden placement: ${formData.placementDate} ${formData.placementTime || ''}`.trim() : '',
        formData.otherEquipment ? `Other equipment: ${formData.otherEquipment}` : '',
        formData.specialRequests || ''
      ].filter(Boolean).join('\n');
    }

    // Readable title, e.g. "Wedding: Bethany Drier and Mikah Hobson, 7/7/2028"; the CHAPEL- code goes to Submission ID.
    const titleLabel = isVowRenewal ? 'Vow renewal'
      : formType === 'general-use' ? 'General use'
      : serviceType;
    const titleWho = [formData.coupleNames, formData.deceasedName, formData.baptismPersonName, formData.organizationName, formData.contactName]
      .map(s => (s || '').trim()).find(Boolean) || 'name not given';
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec((formData.serviceDate || '').trim());
    const titleDate = dateMatch ? `, ${Number(dateMatch[2])}/${Number(dateMatch[3])}/${dateMatch[1]}` : '';

    const listFields = {
      Title: spText(`${titleLabel}: ${titleWho}${titleDate}`),
      SubmissionID: submissionId,
      ServiceType: serviceType,
      Status: 'Pending Review',
      ServiceDate: spDate(formData.serviceDate),
      ServiceTime: spText(formData.serviceTime),
      Submitted: spDate(submissionDate.split('T')[0]),
      ContactName: spText(formData.contactName),
      ContactEmail: spText(formData.contactEmail),
      ContactPhone: spText(formData.contactPhone),
      ContactAddress: spNote(formData.contactAddress),
      BayViewMember: spText(bayViewMember),
      MemberRelationship: spText(formData.memberRelationship),
      ClergyName: spText(formData.clergyName),
      HasMusic: isOn(formData.hasMusic),
      NeedsPiano: isOn(formData.needsPiano),
      NeedsOrgan: isOn(formData.needsOrgan),
      PerformanceLocation: performanceLocation,
      AdditionalChairs: spText(additionalChairs),
      MusiciansList: spNote(musiciansList),
      StandMicrophone: isOn(formData.standMic),
      WirelessMicrophone: isOn(formData.wirelessMic),
      CDPlayer: isOn(formData.cdPlayer),
      CommunionService: isOn(formData.communion),
      GuestBookStand: isOn(formData.guestBook),
      RopedSeating: spText(ropedSeating),
      PolicyAcknowledged: isOn(formData.policyAgreement),
      Notes: spNote(notes)
    };
    if (formType === 'wedding') {
      Object.assign(listFields, {
        CoupleNames: spText(formData.coupleNames),
        GuestCount: spNumber(parseInt(formData.guestCount) || 0),
        WeddingFee: fee,
        RehearsalDate: spDate(formData.rehearsalDate),
        RehearsalTime: spText(formData.rehearsalTime)
      });
    } else if (formType === 'general-use') {
      Object.assign(listFields, {
        EventDescription: spNote(formData.eventDescription),
        OrganizationName: spText(formData.organizationName)
      });
    } else if (formType === 'baptism') {
      Object.assign(listFields, {
        BaptismCandidateName: spText(formData.baptismPersonName),
        BaptismDate: spDate(formData.serviceDate),
        BaptismType: spChoice(formData.baptismType, ['Infant', 'Adult', 'Dedication']),
        ParentsNames: spText(formData.parentsNames),
        Witnesses: spNote(formData.witnessesGodparents),
        EventFee: fee
      });
    } else {
      Object.assign(listFields, {
        DeceasedName: spText(formData.deceasedName),
        MemorialGardenPlacement: formData.memorialGarden === 'yes',
        EventFee: fee
      });
    }

    const saved = await saveSubmission({ label: submissionId, listId: WORSHIP_LISTS.chapel, fields: listFields });

    return res.status(200).json({
      success: true,
      submissionId,
      applicationId: submissionId,
      submissionDate,
      sharePointItemId: saved.id,
      fee,
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
    return res.status(500).json({ error: 'Failed to submit application', message: error.message });
  }
}
