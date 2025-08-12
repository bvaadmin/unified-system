// memorial-garden.js
// Modular scaffold after extraction from inline script.
// TODO: Replace imperative DOM toggles with declarative state config.

const API_URL = 'https://unified-system.vercel.app/api/memorial/submit-garden';

// Fee tiers
const fees = Object.freeze({
  single_member: 400.0,
  single_nonMember: 1500.0,
  double_member: 800.0,
  double_nonMember: 3000.0
});

// Declarative scenario configuration
// Each applicationType + placementType defines which logical sections display and which logical field groups are required
const scenarioConfig = Object.freeze({
  future: {
    baseSections: ['purpose','membership','placementSelector','prepaymentNames','contact','policies','fee'],
    placement: {
      self: { persons:1, double:false, applicantIsSubject:true },
      self_and_other: { persons:2, double:true, applicantIsSubject:true },
      two_others: { persons:2, double:true, applicantIsSubject:false }
    },
    showPersonalHistory:false,
    showService:false
  },
  immediate: {
    baseSections: ['purpose','membership','placementSelector','personalHistory','contact','service','policies','fee'],
    placement: {
      one_person: { persons:1, double:false },
      two_people: { persons:2, double:true }
    },
    showPersonalHistory:true,
    showService:true
  }
});

// Field groups -> concrete element IDs & required fields.
// This translation layer keeps layout and logic loosely coupled.
const fieldGroups = Object.freeze({
  personalHistory: [ 'first_name','last_name' ],
  contact: [ 'contact_name','contact_phone','contact_street','contact_city','contact_state','contact_zip' ],
  deceasedSingle: [ 'deceased_name' ],
  secondPerson: [ 'second_first_name','second_last_name' ],
  prepaymentNames: [ 'prepayment_names','prepayment_person_1','prepayment_person_2' ],
  service: [ 'requested_service_date','requested_service_time' ]
});

let submittedData = {};
let currentState = { applicationType:null, placementType:null, isMember:null };

function qs(sel){ return document.querySelector(sel); }
function qsa(sel){ return Array.from(document.querySelectorAll(sel)); }
function byId(id){ return document.getElementById(id); }

function init(){
  // Defensive: only run if form present
  const form = byId('memorialGardenForm');
  if(!form) return;

  // Initial fee note
  const feeNote = byId('feeNote');
  if (feeNote) feeNote.textContent = 'Please select membership status above to see your fee';

  // Min date for service
  const today = new Date().toISOString().split('T')[0];
  const serviceDateInput = byId('requested_service_date');
  if (serviceDateInput) serviceDateInput.min = today;

  injectAriaLiveRegions();
  attachCoreListeners();
  updateUIFromState();
}

document.addEventListener('DOMContentLoaded', init);

function computeFee(){
  console.log('computeFee called with state:', currentState); // Debug log
  if(!currentState.isMember) {
    console.log('No member status selected');
    return null;
  }
  const isMember = currentState.isMember === 'Yes';
  const placementMeta = resolvePlacementMeta();
  console.log('Placement meta:', placementMeta); // Debug log
  if(!placementMeta) {
    console.log('No placement meta found');
    return null;
  }
  const key = `${placementMeta.double? 'double':'single'}_${isMember? 'member':'nonMember'}`;
  const amount = fees[key];
  console.log('Computing fee:', { isMember, placementMeta, key, amount, fees }); // Debug log
  return { amount, note: feeNoteText(placementMeta.double, isMember) };
}

function feeNoteText(isDouble, isMember){
  if(isMember) return isDouble ? 'Bay View Member/Relative Rate (Two Placements)' : 'Bay View Member/Relative Rate';
  return isDouble ? 'Non-Member Rate (Two Placements)' : 'Non-Member Rate';
}

function updateFeeDisplay(){
  console.log('updateFeeDisplay called'); // Debug log
  const feeInfo = computeFee();
  const feeDisplay = byId('feeDisplay');
  console.log('Fee info:', feeInfo, 'Fee display element:', feeDisplay); // Debug log
  if(!feeDisplay) {
    console.log('No fee display element found');
    return;
  }
  
  if(!feeInfo){ 
    // Show a message about what's needed to calculate fee
    if (currentState.isMember && currentState.applicationType && !currentState.placementType) {
      feeDisplay.classList.remove('hidden');
      byId('feeAmount').textContent = '';
      byId('feeNote').textContent = 'Please select a placement type to see your fee';
    } else if (currentState.applicationType && !currentState.isMember) {
      feeDisplay.classList.remove('hidden');
      byId('feeAmount').textContent = '';
      byId('feeNote').textContent = 'Please select membership status to see your fee';
    } else {
      feeDisplay.classList.add('hidden');
    }
    return; 
  }
  
  feeDisplay.classList.remove('hidden');
  const feeAmountEl = byId('feeAmount');
  const feeNoteEl = byId('feeNote');
  console.log('Setting fee display:', { feeAmountEl, feeNoteEl, amount: feeInfo.amount }); // Debug
  if (feeAmountEl) feeAmountEl.textContent = `$${feeInfo.amount.toFixed(2)}`;
  if (feeNoteEl) feeNoteEl.textContent = feeInfo.note;
  const paymentInput = byId('payment_amount');
  if (paymentInput) paymentInput.value = feeInfo.amount.toFixed(2);
  announce(`Fee updated to $${feeInfo.amount.toFixed(2)} (${feeInfo.note}).`);
  console.log('Fee display classes after update:', feeDisplay.classList.toString()); // Debug
}

function attachCoreListeners(){
  qsa('input[name="is_member"]').forEach(r => r.addEventListener('change', e => {
    currentState.isMember = e.target.value;
    updateUIFromState();
  }));
  qsa('input[name="placementType"]').forEach(r => r.addEventListener('change', e => {
    currentState.placementType = e.target.value;
    updateUIFromState();
  }));
  qsa('input[name="applicationType"]').forEach(r => r.addEventListener('change', e => {
    currentState.applicationType = e.target.value;
    // Reset placement type when switching application types
    currentState.placementType = null;
    updateUIFromState();
  }));
  const form = byId('memorialGardenForm');
  form.addEventListener('submit', handleSubmit);
}

function resolvePlacementMeta(){
  const type = currentState.applicationType;
  const placement = currentState.placementType;
  console.log('resolvePlacementMeta:', { type, placement }); // Debug log
  if(!type || !placement) {
    console.log('Missing type or placement');
    return null;
  }
  const scenario = scenarioConfig[type];
  console.log('Scenario config:', scenario); // Debug log
  if(!scenario) {
    console.log('No scenario found for type:', type);
    return null;
  }
  const result = scenario.placement[placement];
  console.log('Placement result:', result); // Debug log
  return result || null;
}

function updateUIFromState(){
  // Helper function to toggle visibility using class
  function setVisible(elementId, shouldShow) {
    const element = byId(elementId);
    if (!element) return;
    if (shouldShow) {
      element.classList.remove('hidden');
    } else {
      element.classList.add('hidden');
    }
  }
  
  // Helper to set visibility for multiple elements by class
  function setClassVisible(className, shouldShow) {
    const elements = document.querySelectorAll(`.${className}`);
    elements.forEach(el => {
      if (shouldShow) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    });
  }

  // Member details visibility
  setVisible('memberDetails', currentState.isMember === 'Yes');
  setVisible('inPersonOption', currentState.isMember === 'Yes');

  // Sections
  const placementMeta = resolvePlacementMeta();
  const appType = currentState.applicationType;
  
  // Show/hide placement options based on application type
  if (appType === 'future') {
    setClassVisible('placement-future', true);
    setClassVisible('placement-immediate', false);
    // Clear immediate placement selection if switching from immediate to future
    qsa('input[name="placementType"][value="one_person"], input[name="placementType"][value="two_people"]').forEach(r => r.checked = false);
  } else if (appType === 'immediate') {
    setClassVisible('placement-future', false);
    setClassVisible('placement-immediate', true);
    // Clear future placement selection if switching from future to immediate
    qsa('input[name="placementType"][value="self"], input[name="placementType"][value="self_and_other"], input[name="placementType"][value="two_others"]').forEach(r => r.checked = false);
  }
  
  // Toggle second person section
  setVisible('secondPersonSection', placementMeta && placementMeta.persons === 2 && appType === 'immediate');
  
  // Personal history section
  setVisible('personalHistorySection', appType === 'immediate');
  
  // Service planning
  setVisible('servicePlanningSection', appType === 'immediate');
  
  // Prepayment name block
  setVisible('prepaymentInfoSection', appType === 'future');
  
  // Deceased name group visibility only for immediate
  setVisible('deceasedNameGroup', appType === 'immediate');
  
  updateRequiredFields(placementMeta, appType);
  updateFeeDisplay();
  syncPrepaymentNameFields();
}

function updateRequiredFields(placementMeta, appType){
  // Clear all required first (only those we manage)
  Object.values(fieldGroups).flat().forEach(id => { const el = byId(id); if(el){ el.removeAttribute('aria-required'); el.required = false; }});
  // Contact always required
  fieldGroups.contact.forEach(id => markRequired(id));
  if(appType === 'immediate'){
    fieldGroups.personalHistory.forEach(id=> markRequired(id));
    fieldGroups.deceasedSingle.forEach(id=> markRequired(id));
    if(placementMeta && placementMeta.persons === 2){
      fieldGroups.secondPerson.forEach(id=> markRequired(id));
    }
    fieldGroups.service.forEach(id=> markRequired(id));
  } else if(appType === 'future') {
    // Mark all prepayment name inputs so native UI highlights whichever user chooses
    fieldGroups.prepaymentNames.forEach(id=> markRequired(id));
  }
}

function markRequired(id){ const el = byId(id); if(!el) return; el.required = true; el.setAttribute('aria-required','true'); }

// Accessibility live region
function injectAriaLiveRegions(){
  if(!byId('ariaLive')){
    const div = document.createElement('div');
    div.id = 'ariaLive';
    div.className = 'sr-only';
    div.setAttribute('role','status');
    div.setAttribute('aria-live','polite');
    document.body.appendChild(div);
  }
}
function announce(msg){ const region = byId('ariaLive'); if(region){ region.textContent = msg; }}

function handleSubmit(e){
  e.preventDefault();
  const submitButton = byId('submitButton');
  const loading = byId('loading');
  const errorMessage = byId('errorMessage');
  const errorText = byId('errorText');

  const membershipSelected = qs('input[name="is_member"]:checked');
  if(!membershipSelected){
    alert('Please select your Bay View membership status to calculate the correct fee.');
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = 'Submitting...';
  loading.classList.remove('hidden');
  errorMessage.classList.add('hidden');

  const submissionId = 'MG-' + Date.now();
  const validationIssues = validateForm();
  if(validationIssues.length){
    errorMessage.classList.remove('hidden');
    errorText.textContent = 'Please fix: ' + validationIssues.join('; ');
    submitButton.disabled=false;
    submitButton.textContent='Submit Memorial Garden Application';
    return;
  }

  const payload = buildStructuredPayload(submissionId, membershipSelected.value);
  const formData = legacyTransform(payload); // keep existing downstream expectations
  submittedData = formData;

  fetch(API_URL, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ properties: formData })
  })
    .then(r=> r.json().then(j=>({ok:r.ok, body:j})))
    .then(({ok, body})=>{
      if(!ok || !body.success) throw new Error(body.error || 'Submission failed');
      loading.classList.add('hidden');
      showThankYouPage();
    })
    .catch(err=>{
      loading.classList.add('hidden');
      errorMessage.classList.remove('hidden');
      errorText.textContent = err.message || 'An error occurred while submitting your application.';
      submitButton.disabled=false;
      submitButton.textContent='Submit Memorial Garden Application';
    });
}

function combineAddress(street, city, state, zip){
  return [street, city, state, zip].filter(Boolean).join(', ');
}

function buildStructuredPayload(submissionId, memberValue){
  const appType = qs('input[name="applicationType"]:checked')?.value || '';
  const placementType = qs('input[name="placementType"]:checked')?.value || '';
  const placementMeta = resolvePlacementMeta();
  const feeInfo = computeFee();
  const primary = {
    firstName: byId('first_name')?.value || '',
    lastName: byId('last_name')?.value || '',
    middleName: byId('middle_name')?.value || '',
    maidenName: byId('maiden_name')?.value || '',
    deceasedName: byId('deceased_name')?.value || ''
  };
  const secondary = (placementMeta && placementMeta.persons===2 && appType==='immediate') ? {
    firstName: byId('second_first_name')?.value || '',
    lastName: byId('second_last_name')?.value || ''
  }: null;
  return {
    meta:{
      submissionId,
      submittedAt: new Date().toISOString(),
      status:'Submitted',
      applicationType: appType,
      placementType,
      fee: feeInfo ? feeInfo.amount : 0
    },
    membership:{
      isMember: memberValue === 'Yes',
      raw: memberValue,
      memberName: byId('member_name')?.value || '',
      relationship: byId('member_relationship')?.value || ''
    },
    contact:{
      name: byId('contact_name')?.value || '',
      phone: byId('contact_phone')?.value || '',
      email: byId('contact_email')?.value || '',
      address: combineAddress(byId('contact_street')?.value, byId('contact_city')?.value, byId('contact_state')?.value, byId('contact_zip')?.value)
    },
  persons:{ primary, secondary },
  prepayment: appType==='future' ? collectPrepaymentNames() : null,
  service: appType==='immediate' ? collectServiceInfo() : null,
  agreements:{ policies: !!byId('policy_agreement')?.checked }
  };
}

function legacyTransform(payload){
  // Flatten to previous key schema to avoid backend disruption
  return {
    'Submission ID': payload.meta.submissionId,
    'Submission Date': payload.meta.submittedAt,
    'date:Submission Date:start': payload.meta.submittedAt.split('T')[0],
    'Status': payload.meta.status,
    'Application Type': payload.meta.applicationType,
    'Placement Type': payload.meta.placementType,
    'Bay View Member': payload.membership.raw,
    'Member Name': payload.membership.memberName,
    'Member Relationship': payload.membership.relationship,
    'Fee Amount': payload.meta.fee,
    'Policy Agreement': payload.agreements.policies ? '__YES__' : '__NO__',
    'Contact Name': payload.contact.name,
    'Contact Phone': payload.contact.phone,
    'Contact Email': payload.contact.email,
    'Contact Address': payload.contact.address,
    'Deceased Name': payload.persons.primary.deceasedName,
    // Add prepayment names for future placements
    'Prepayment Person 1': payload.prepayment?.p1 || '',
    'Prepayment Person 2': payload.prepayment?.p2 || ''
  };
}

function validateForm(){
  const issues = [];
  // Required element validation (native validity first)
  qsa('input, textarea, select').forEach(el=>{
    if(el.required && !el.value.trim()){
      issues.push(`${el.name || el.id} is required`);
    }
  });
  // Policy agreement
  if(!byId('policy_agreement')?.checked){ issues.push('Policy agreement must be accepted'); }
  // Cross-field: service date must be >= today for immediate
  const appType = qs('input[name="applicationType"]:checked')?.value;
  if(appType==='immediate'){
    const d = byId('requested_service_date')?.value;
    if(d){
      const dt = new Date(d);
      const today = new Date(); today.setHours(0,0,0,0);
      if(dt < today) issues.push('Service date must be today or later');
    }
  }
  if(appType==='future'){
    const pre = collectPrepaymentNames();
    if(pre.list.length === 0) issues.push('At least one prepayment name required');
  }
  const trap = byId('website');
  if(trap && trap.value.trim()) issues.push('Spam detected');
  return issues;
}

function showThankYouPage(){
  const formWrapper = byId('applicationForm');
  const thankYou = byId('thankYouPage');
  if(formWrapper) formWrapper.classList.add('hidden');
  if(thankYou) thankYou.classList.remove('hidden');
  // Populate minimal confirmation details if elements exist
  const idEl = byId('confirmationId');
  if(idEl) idEl.textContent = submittedData['Submission ID'];
  const dateEl = byId('confirmationDate');
  if(dateEl) dateEl.textContent = new Date().toLocaleDateString('en-US', {year:'numeric', month:'long', day:'numeric'});
  const feeEl = byId('confirmationFee');
  if(feeEl) feeEl.textContent = `$${Number(submittedData['Fee Amount']||0).toFixed(2)}`;
  renderThankYouVariants();
}

// ---- Domain helpers ----
function collectPrepaymentNames(){
  const names = [];
  const bulk = byId('prepayment_names')?.value.trim();
  const p1 = byId('prepayment_person_1')?.value.trim();
  const p2 = byId('prepayment_person_2')?.value.trim();
  if(p1) names.push(p1);
  if(p2) names.push(p2);
  if(names.length===0 && bulk) names.push(bulk);
  return { list: names, rawBulk: bulk, p1, p2 };
}

function collectServiceInfo(){
  return {
    requestedDate: byId('requested_service_date')?.value || '',
    requestedTime: byId('requested_service_time')?.value || '',
    celebrantPreference: byId('celebrant_preference')?.value || ''
  };
}

function renderThankYouVariants(){
  const container = byId('thankYouDynamic');
  if(!container) return;
  const appType = qs('input[name="applicationType"]:checked')?.value;
  const feeInfo = computeFee();
  if(appType==='future'){
    const pre = collectPrepaymentNames();
    container.innerHTML = `
      <h2>Thank You for Your Prepayment</h2>
      <p>Your Memorial Garden prepayment application has been successfully submitted. This prepayment locks in today's rate for future use.</p>
      <div style="background:#f8f9fa; padding:15px; border-radius:5px; margin:20px 0;">
        <p style="margin-bottom:10px;"><strong>Prepayment Details:</strong></p>
        <p>Names Covered:<br>${pre.list.map(n=>`• ${escapeHtml(n)}`).join('<br>') || '(no names provided)'}</p>
        <p style="margin-top:10px;">Prepayment Amount: <strong>$${feeInfo ? feeInfo.amount.toFixed(2):'0.00'}</strong></p>
      </div>
      <div style="background:#fff3cd; border:1px solid #ffeaa7; padding:15px; border-radius:5px; margin:20px 0;">
        <p style="margin:0;"><strong>Important:</strong> Please keep this confirmation for your records. You will need to reference your Submission ID when the time comes for placement.</p>
      </div>
      <p><strong>Next Steps:</strong></p>
      <ul style="line-height:1.8;">
        <li>Mail your check to: Bay View Association, P.O. Box 583, Petoskey, MI 49770</li>
        <li>Include "Memorial Garden" in the memo line</li>
        <li>Reference Submission ID in your payment</li>
      </ul>
    `;
  } else {
    const service = collectServiceInfo();
    container.innerHTML = `
      <h2>Thank You for Your Application</h2>
      <p>Your Memorial Garden placement application has been successfully submitted. The Bay View Association office will contact you within 2-3 business days to coordinate the placement ceremony.</p>
      <div style="background:#f8f9fa; padding:15px; border-radius:5px; margin:20px 0;">
        <p style="margin-bottom:10px;"><strong>Service Details:</strong></p>
        <p>Requested Service Date: ${service.requestedDate || 'To be determined'}</p>
        <p>Requested Time: ${service.requestedTime || 'To be determined'}</p>
        <p style="margin-top:10px;">Application Fee: <strong>$${feeInfo ? feeInfo.amount.toFixed(2):'0.00'}</strong></p>
      </div>
      <p><strong>Next Steps:</strong></p>
      <ul style="line-height:1.8;">
        <li>The office will contact you to confirm your service date and time</li>
        <li>Mail your check to: Bay View Association, P.O. Box 583, Petoskey, MI 49770</li>
        <li>Include "Memorial Garden" in the memo line</li>
        <li>Reference your Submission ID with your payment</li>
      </ul>
      <div style="background:#e8f0ff; border:1px solid #b8d4f0; padding:15px; border-radius:5px; margin:20px 0;">
        <p style="margin:0;">If you have any questions, please contact the Bay View Business Office at (231) 347-6225 or email admin@bayviewassociation.org</p>
      </div>
    `;
  }
}

function syncPrepaymentNameFields(){
  const appType = qs('input[name="applicationType"]:checked')?.value;
  if(appType!=='future') return;
  // Placeholder for potential sync logic.
}

function escapeHtml(str){
  return (str||'').replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[c]));
}

// Honeypot insertion
document.addEventListener('DOMContentLoaded', ()=>{
  if(!byId('website')){
    const form = byId('memorialGardenForm');
    if(form){
      const trapWrapper = document.createElement('div');
      trapWrapper.style.position='absolute';
      trapWrapper.style.left='-9999px';
      trapWrapper.innerHTML = '<label>Website: <input type="text" id="website" name="website" tabindex="-1" autocomplete="off"></label>';
      form.appendChild(trapWrapper);
    }
  }
});

// Expose for future modules (optional)
window.MemorialGardenForm = { updateFeeDisplay };
