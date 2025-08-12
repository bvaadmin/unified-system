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
  prepaymentNames: [], // Now handled dynamically
  service: [ 'requested_service_date','requested_service_time' ]
});

let submittedData = {};
let currentState = { applicationType:null, isMember:null };

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
  initPrepaymentNamesList();
  initImmediatePlacementList();
  updateUIFromState();
}

document.addEventListener('DOMContentLoaded', init);

function computeFee(){
  if(!currentState.isMember) {
    return null;
  }
  const isMember = currentState.isMember === 'Yes';
  
  // For immediate placement, determine fee based on number of people
  if (currentState.applicationType === 'immediate') {
    const immediatePeople = collectImmediatePlacementData();
    const isDouble = immediatePeople.length === 2;
    const key = `${isDouble? 'double':'single'}_${isMember? 'member':'nonMember'}`;
    const amount = fees[key];
    return { amount, note: feeNoteText(isDouble, isMember) };
  }
  
  // For future placement, use the selected placement type
  const placementMeta = resolvePlacementMeta();
  if(!placementMeta) {
    return null;
  }
  const key = `${placementMeta.double? 'double':'single'}_${isMember? 'member':'nonMember'}`;
  const amount = fees[key];
  return { amount, note: feeNoteText(placementMeta.double, isMember) };
}

function feeNoteText(isDouble, isMember){
  if(isMember) return isDouble ? 'Bay View Member/Relative Rate (Two Placements)' : 'Bay View Member/Relative Rate';
  return isDouble ? 'Non-Member Rate (Two Placements)' : 'Non-Member Rate';
}

function updateFeeDisplay(){
  const feeInfo = computeFee();
  const feeDisplay = byId('feeDisplay');
  if(!feeDisplay) {
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
  if (feeAmountEl) feeAmountEl.textContent = `$${feeInfo.amount.toFixed(2)}`;
  if (feeNoteEl) feeNoteEl.textContent = feeInfo.note;
  const paymentInput = byId('payment_amount');
  if (paymentInput) paymentInput.value = feeInfo.amount.toFixed(2);
  announce(`Fee updated to $${feeInfo.amount.toFixed(2)} (${feeInfo.note}).`);
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
  if(!type || !placement) {
    return null;
  }
  const scenario = scenarioConfig[type];
  if(!scenario) {
    return null;
  }
  const result = scenario.placement[placement];
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
  
  // Show placement type section only for future applications
  setVisible('placementTypeSection', appType === 'future');
  
  // Clear placement type when switching application types
  if (appType === 'immediate') {
    // Clear any future placement selections
    qsa('input[name="placementType"]').forEach(r => r.checked = false);
    // For immediate, we'll auto-detect based on number of people added
  }
  
  // Show appropriate names section based on application type
  setVisible('prepaymentInfoSection', appType === 'future');
  setVisible('immediatePlacementSection', appType === 'immediate');
  
  // Service planning for immediate placement
  setVisible('servicePlanningSection', appType === 'immediate');
  
  // Old sections - hide them as we're using dynamic lists now
  setVisible('personalHistorySection', false);
  setVisible('secondPersonSection', false);
  setVisible('deceasedNameGroup', false);
  
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
    // Prepayment names are now handled dynamically
    // Mark dynamic inputs as required
    prepaymentNamesList.forEach(item => {
      const input = byId(item.id);
      if (input) {
        input.required = true;
        input.setAttribute('aria-required', 'true');
      }
    });
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
  let placementType = '';
  
  // Collect immediate placement data if applicable
  let primary = {};
  let secondary = null;
  let immediatePeopleCount = 0;
  
  if (appType === 'immediate') {
    const immediatePeople = collectImmediatePlacementData();
    immediatePeopleCount = immediatePeople.length;
    
    // Auto-determine placement type based on number of people
    if (immediatePeopleCount === 1) {
      placementType = 'one_person';
    } else if (immediatePeopleCount === 2) {
      placementType = 'two_people';
    }
    
    if (immediatePeople.length > 0) {
      primary = {
        firstName: immediatePeople[0].firstName || '',
        lastName: immediatePeople[0].lastName || '',
        middleName: immediatePeople[0].middleName || '',
        maidenName: immediatePeople[0].maidenName || '',
        deceasedName: immediatePeople[0].memorialName || ''
      };
    }
    if (immediatePeople.length > 1) {
      secondary = {
        firstName: immediatePeople[1].firstName || '',
        lastName: immediatePeople[1].lastName || ''
      };
    }
  } else {
    // For future/prepayment, get the selected placement type
    placementType = qs('input[name="placementType"]:checked')?.value || '';
  }
  
  // Update current state for fee calculation
  currentState.placementType = placementType;
  const placementMeta = resolvePlacementMeta();
  const feeInfo = computeFee();
  
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
    // Validate that names are not empty
    pre.list.forEach((name, index) => {
      if (!name || name.trim() === '') {
        issues.push(`Prepayment name ${index + 1} cannot be empty`);
      }
    });
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

// ---- Prepayment Names Management ----
let prepaymentNamesList = [];

function initPrepaymentNamesList() {
  const addBtn = byId('addNameBtn');
  if (addBtn) {
    addBtn.addEventListener('click', addPrepaymentName);
    // Start with one empty field
    addPrepaymentName();
  }
}

function addPrepaymentName() {
  // Maximum 2 names (database limitation)
  if (prepaymentNamesList.length >= 2) {
    alert('Maximum of 2 names allowed for prepayment.');
    return;
  }
  
  const container = byId('prepaymentNamesList');
  if (!container) return;
  
  const index = prepaymentNamesList.length;
  const nameId = `prepayment_name_${index}`;
  
  const nameDiv = document.createElement('div');
  nameDiv.className = 'prepayment-name-item';
  nameDiv.style.cssText = 'display:flex; align-items:center; gap:10px; margin-bottom:10px;';
  nameDiv.innerHTML = `
    <input type="text" 
           id="${nameId}" 
           placeholder="Enter full name" 
           style="flex:1; padding:10px; border:1px solid #ddd; border-radius:4px;"
           data-index="${index}">
    <button type="button" 
            onclick="removePrepaymentName(${index})" 
            style="background:#dc3545; color:white; border:none; padding:8px 15px; border-radius:4px; cursor:pointer;">
      Remove
    </button>
  `;
  
  container.appendChild(nameDiv);
  prepaymentNamesList.push({ id: nameId, element: nameDiv });
  
  // Update add button visibility
  updateAddNameButton();
}

function removePrepaymentName(index) {
  const container = byId('prepaymentNamesList');
  if (!container) return;
  
  // Remove from DOM
  const item = prepaymentNamesList[index];
  if (item && item.element) {
    container.removeChild(item.element);
  }
  
  // Remove from list and reindex
  prepaymentNamesList.splice(index, 1);
  
  // Reindex remaining items
  prepaymentNamesList.forEach((item, i) => {
    const input = item.element.querySelector('input');
    const button = item.element.querySelector('button');
    if (input) {
      input.id = `prepayment_name_${i}`;
      input.dataset.index = i;
    }
    if (button) {
      button.setAttribute('onclick', `removePrepaymentName(${i})`);
    }
    item.id = `prepayment_name_${i}`;
  });
  
  // If no names left, add one empty field
  if (prepaymentNamesList.length === 0) {
    addPrepaymentName();
  }
  
  updateAddNameButton();
}

function updateAddNameButton() {
  const addBtn = byId('addNameBtn');
  if (addBtn) {
    addBtn.style.display = prepaymentNamesList.length >= 2 ? 'none' : 'inline-block';
  }
}

// Make removePrepaymentName globally accessible
window.removePrepaymentName = removePrepaymentName;

// ---- Immediate Placement Names Management ----
let immediatePlacementList = [];

function initImmediatePlacementList() {
  const addBtn = byId('addImmediateNameBtn');
  if (addBtn) {
    addBtn.addEventListener('click', addImmediatePlacementName);
    // Start with one empty entry
    addImmediatePlacementName();
  }
}

function addImmediatePlacementName() {
  // Maximum 2 people (database limitation)
  if (immediatePlacementList.length >= 2) {
    alert('Maximum of 2 individuals allowed for placement.');
    return;
  }
  
  const container = byId('immediatePlacementList');
  if (!container) return;
  
  const index = immediatePlacementList.length;
  const personNum = index + 1;
  
  const personDiv = document.createElement('div');
  personDiv.className = 'immediate-person-item';
  personDiv.style.cssText = 'border:1px solid #dee2e6; padding:15px; border-radius:5px; margin-bottom:15px; background:#f8f9fa;';
  personDiv.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
      <h4 style="margin:0; color:#2c5aa0;">Person ${personNum}</h4>
      <button type="button" 
              onclick="removeImmediatePlacementName(${index})" 
              style="background:#dc3545; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:14px;">
        Remove
      </button>
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
      <div>
        <label style="display:block; margin-bottom:5px; font-weight:500;">First Name <span style="color:red;">*</span></label>
        <input type="text" 
               id="immediate_first_${index}" 
               placeholder="First name" 
               required
               style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
      </div>
      <div>
        <label style="display:block; margin-bottom:5px; font-weight:500;">Last Name <span style="color:red;">*</span></label>
        <input type="text" 
               id="immediate_last_${index}" 
               placeholder="Last name" 
               required
               style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
      </div>
      <div>
        <label style="display:block; margin-bottom:5px;">Middle Name</label>
        <input type="text" 
               id="immediate_middle_${index}" 
               placeholder="Middle name (optional)" 
               style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
      </div>
      <div>
        <label style="display:block; margin-bottom:5px;">Maiden Name</label>
        <input type="text" 
               id="immediate_maiden_${index}" 
               placeholder="Maiden name (optional)" 
               style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
      </div>
    </div>
    <div style="margin-top:15px;">
      <label style="display:block; margin-bottom:5px; font-weight:500;">Name for Memorial Record <span style="color:red;">*</span></label>
      <input type="text" 
             id="immediate_memorial_${index}" 
             placeholder="Full name as it should appear on memorial" 
             required
             style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
    </div>
  `;
  
  container.appendChild(personDiv);
  immediatePlacementList.push({ 
    index: index,
    element: personDiv 
  });
  
  // Update add button visibility
  updateAddImmediateButton();
  
  // Update fee display when people are added
  if (currentState.applicationType === 'immediate') {
    updateFeeDisplay();
  }
}

function removeImmediatePlacementName(index) {
  const container = byId('immediatePlacementList');
  if (!container) return;
  
  // Find and remove the element
  const itemIndex = immediatePlacementList.findIndex(item => item.index === index);
  if (itemIndex > -1) {
    container.removeChild(immediatePlacementList[itemIndex].element);
    immediatePlacementList.splice(itemIndex, 1);
  }
  
  // Renumber remaining items
  immediatePlacementList.forEach((item, i) => {
    const h4 = item.element.querySelector('h4');
    if (h4) h4.textContent = `Person ${i + 1}`;
    
    // Update button onclick
    const button = item.element.querySelector('button');
    if (button) {
      button.setAttribute('onclick', `removeImmediatePlacementName(${item.index})`);
    }
  });
  
  // If no people left, add one empty entry
  if (immediatePlacementList.length === 0) {
    addImmediatePlacementName();
  }
  
  updateAddImmediateButton();
  
  // Update fee display when people are removed
  if (currentState.applicationType === 'immediate') {
    updateFeeDisplay();
  }
}

function updateAddImmediateButton() {
  const addBtn = byId('addImmediateNameBtn');
  if (addBtn) {
    addBtn.style.display = immediatePlacementList.length >= 2 ? 'none' : 'inline-block';
  }
}

// Make removeImmediatePlacementName globally accessible
window.removeImmediatePlacementName = removeImmediatePlacementName;

// ---- Domain helpers ----
function collectPrepaymentNames(){
  const names = [];
  
  // Collect from dynamic list
  prepaymentNamesList.forEach((item, index) => {
    const input = byId(item.id);
    if (input && input.value.trim()) {
      names.push(input.value.trim());
    }
  });
  
  // Update hidden fields for API compatibility
  const p1Input = byId('prepayment_person_1');
  const p2Input = byId('prepayment_person_2');
  if (p1Input) p1Input.value = names[0] || '';
  if (p2Input) p2Input.value = names[1] || '';
  
  return { 
    list: names, 
    rawBulk: names.join(', '), 
    p1: names[0] || '', 
    p2: names[1] || '' 
  };
}

function collectImmediatePlacementData() {
  const people = [];
  
  immediatePlacementList.forEach((item, i) => {
    const firstName = byId(`immediate_first_${item.index}`)?.value || '';
    const lastName = byId(`immediate_last_${item.index}`)?.value || '';
    const middleName = byId(`immediate_middle_${item.index}`)?.value || '';
    const maidenName = byId(`immediate_maiden_${item.index}`)?.value || '';
    const memorialName = byId(`immediate_memorial_${item.index}`)?.value || '';
    
    if (firstName || lastName) {
      people.push({
        firstName,
        lastName,
        middleName,
        maidenName,
        memorialName: memorialName || `${firstName} ${lastName}`.trim()
      });
    }
  });
  
  // Update hidden fields for API compatibility
  if (people.length > 0) {
    const p1 = people[0];
    byId('first_name').value = p1.firstName;
    byId('last_name').value = p1.lastName;
    byId('middle_name').value = p1.middleName;
    byId('maiden_name').value = p1.maidenName;
    byId('deceased_name').value = p1.memorialName;
  }
  
  if (people.length > 1) {
    const p2 = people[1];
    byId('second_first_name').value = p2.firstName;
    byId('second_last_name').value = p2.lastName;
  }
  
  return people;
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
