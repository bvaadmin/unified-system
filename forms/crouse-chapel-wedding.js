// crouse-chapel-wedding.js
// Modular JavaScript for Crouse Chapel Wedding Application Form

const API_URL = 'https://unified-system.vercel.app/api/chapel/submit-service';

// Fee structure - aligned with config system
const fees = Object.freeze({
  member: 300.0,
  nonMember: 750.0,
  audioSupport: 25.0
});

// DOM helper functions
function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }
function byId(id) { return document.getElementById(id); }

// State management
let currentState = {
  isMember: null,
  hasMusic: false,
  musicianCount: 0,
  hasAudioSupport: false
};

function init() {
  console.log('Crouse Chapel Wedding JS: Initializing...');
  
  const form = byId('weddingForm');
  if (!form) {
    console.error('Crouse Chapel Wedding JS: Form not found!');
    return;
  }
  
  console.log('Crouse Chapel Wedding JS: Form found, attaching listeners...');
  
  // Set minimum dates
  const today = new Date();
  const minDate = new Date(today.setMonth(today.getMonth() + 2));
  const serviceDateInput = byId('serviceDate');
  if (serviceDateInput) {
    serviceDateInput.min = minDate.toISOString().split('T')[0];
  }
  
  attachEventListeners();
  updateFeeDisplay();
  
  console.log('Crouse Chapel Wedding JS: Initialization complete');
}

document.addEventListener('DOMContentLoaded', init);

function attachEventListeners() {
  const form = byId('weddingForm');
  const loadingDiv = byId('loading');
  const successMessage = byId('successMessage');
  const errorMessage = byId('errorMessage');
  const errorText = byId('errorText');

  // Music section toggle
  const hasMusic = byId('hasMusic');
  const musicDetails = byId('musicDetails');
  if (hasMusic && musicDetails) {
    hasMusic.addEventListener('change', function() {
      currentState.hasMusic = this.checked;
      musicDetails.classList.toggle('hidden', !this.checked);
      updateFeeDisplay();
    });
  }

  // Chair details toggle  
  const needsChairs = byId('needsChairs');
  const chairDetails = byId('chairDetails');
  if (needsChairs && chairDetails) {
    needsChairs.addEventListener('change', function() {
      chairDetails.classList.toggle('hidden', !this.checked);
    });
  }

  // Roped seating toggle
  const ropedSeating = byId('ropedSeating');
  const ropedSeatingDetails = byId('ropedSeatingDetails');
  if (ropedSeating && ropedSeatingDetails) {
    ropedSeating.addEventListener('change', function() {
      ropedSeatingDetails.classList.toggle('hidden', !this.checked);
    });
  }

  // Musician count management
  const addMusicianBtn = byId('addMusician');
  const removeMusicianBtn = byId('removeMusician');
  const musiciansContainer = byId('musiciansContainer');
  
  if (addMusicianBtn) {
    addMusicianBtn.addEventListener('click', function() {
      if (currentState.musicianCount < 10) {
        currentState.musicianCount++;
        const musicianRow = document.createElement('div');
        musicianRow.className = 'musician-row';
        musicianRow.innerHTML = `
          <input type="text" 
                 name="musicians[${currentState.musicianCount}][name]" 
                 placeholder="Musician name"
                 style="width: 48%; margin-right: 2%;">
          <input type="text" 
                 name="musicians[${currentState.musicianCount}][instrument]" 
                 placeholder="Instrument/role"
                 style="width: 48%;">
        `;
        musiciansContainer.appendChild(musicianRow);
        removeMusicianBtn.disabled = false;
      }
      if (currentState.musicianCount >= 10) {
        addMusicianBtn.disabled = true;
      }
    });
  }
  
  if (removeMusicianBtn) {
    removeMusicianBtn.addEventListener('click', function() {
      if (currentState.musicianCount > 0) {
        musiciansContainer.lastElementChild?.remove();
        currentState.musicianCount--;
        addMusicianBtn.disabled = false;
      }
      if (currentState.musicianCount === 0) {
        removeMusicianBtn.disabled = true;
      }
    });
  }

  // Audio support checkbox
  const audioSupport = byId('audioSupport');
  if (audioSupport) {
    audioSupport.addEventListener('change', function() {
      currentState.hasAudioSupport = this.checked;
      updateFeeDisplay();
    });
  }

  // Member radio buttons for fee calculation
  const memberRadios = qsa('input[name="isMember"]');
  memberRadios.forEach(radio => {
    radio.addEventListener('change', function() {
      currentState.isMember = this.value === 'yes' ? 'Yes' : 'No';
      updateFeeDisplay();
      
      // Toggle sponsor fields visibility based on membership
      // Non-members need sponsor info to be visible
      const sponsorFields = qsa('.sponsor-field');
      sponsorFields.forEach(field => {
        field.classList.toggle('hidden', this.value === 'yes');
      });
    });
  });

  // Form submission
  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      // Hide any existing messages
      successMessage?.classList.add('hidden');
      errorMessage?.classList.add('hidden');
      loadingDiv?.classList.remove('hidden');
      
      try {
        const formData = new FormData(form);
        const data = {
          formType: 'wedding',
          // Service details
          serviceDate: formData.get('weddingDate'),
          serviceTime: formData.get('weddingTime'),
          rehearsalDate: formData.get('rehearsalDate'),
          rehearsalTime: formData.get('rehearsalTime'),
          
          // Couple information
          coupleNames: formData.get('coupleNames'),
          brideArrivalTime: formData.get('brideArrival'),
          guestCount: parseInt(formData.get('guestCount') || '0'),
          dressingAtChapel: formData.get('dressingAtChapel') === 'yes',
          
          // Contact person
          contactName: formData.get('contactName'),
          contactEmail: formData.get('contactEmail'),
          contactPhone: formData.get('contactPhone'),
          contactAddress: formData.get('contactAddress'),
          contactRelationship: formData.get('contactRelationship'),
          
          // Clergy
          clergyName: formData.get('clergyName'),
          clergyDenomination: formData.get('clergyDenomination'),
          clergyPhone: formData.get('clergyPhone'),
          clergyEmail: formData.get('clergyEmail'),
          clergyAddress: formData.get('clergyAddress'),
          
          // Music
          hasMusic: hasMusic?.checked || false,
          needsPiano: formData.get('needsPiano') === 'on',
          needsOrgan: formData.get('needsOrgan') === 'on',
          performSanctuary: formData.get('performSanctuary') === 'on',
          performBalcony: formData.get('performBalcony') === 'on',
          
          // Equipment
          standMic: formData.get('standMic') === 'on',
          wirelessMic: formData.get('wirelessMic') === 'on',
          cdPlayer: formData.get('cdPlayer') === 'on',
          communion: formData.get('communion') === 'on',
          guestBook: formData.get('guestBook') === 'on',
          needsChairs: formData.get('needsChairs') === 'on',
          chairCount: parseInt(formData.get('chairCount') || '0'),
          chairPlacement: formData.get('chairPlacement'),
          ropedSeating: formData.get('ropedSeating') === 'on',
          rowsLeft: parseInt(formData.get('rowsLeft') || '0'),
          rowsRight: parseInt(formData.get('rowsRight') || '0'),
          
          // Membership
          isMember: formData.get('isMember') === 'yes',
          memberName: formData.get('memberName'),
          memberRelationship: formData.get('memberRelationship'),
          
          // Policies
          policyAgreement: formData.get('policyAgreement') === 'on',
          
          // Additional info
          whyBayView: formData.get('whyBayView'),
          specialRequests: formData.get('specialRequests'),
          
          // Fee calculation
          weddingFee: calculateTotalFee()
        };
        
        // Collect musicians if any
        if (currentState.hasMusic && currentState.musicianCount > 0) {
          data.musicians = [];
          for (let i = 1; i <= currentState.musicianCount; i++) {
            const name = formData.get(`musicians[${i}][name]`);
            const instrument = formData.get(`musicians[${i}][instrument]`);
            if (name || instrument) {
              data.musicians.push({ name, instrument });
            }
          }
        }
        
        // Submit to API
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok && result.success) {
          // Success
          form.reset();
          currentState = {
            isMember: null,
            hasMusic: false,
            musicianCount: 0,
            hasAudioSupport: false
          };
          updateFeeDisplay();
          
          const confirmationNumber = result.applicationId || 'PENDING';
          const confirmationDate = new Date().toLocaleDateString();
          
          byId('confirmationNumber').textContent = confirmationNumber;
          byId('confirmationDate').textContent = confirmationDate;
          successMessage?.classList.remove('hidden');
          
          // Scroll to success message
          successMessage?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          // API returned an error
          throw new Error(result.error || result.message || 'Submission failed');
        }
      } catch (error) {
        console.error('Submission error:', error);
        
        // Show appropriate error message
        let errorMsg = 'An unexpected error occurred. Please try again or contact the office.';
        
        if (error.message.includes('already booked') || error.message.includes('not available')) {
          errorMsg = 'This date and time is already booked. Please select a different time.';
        } else if (error.message.includes('Failed to fetch')) {
          errorMsg = 'Unable to connect to the server. Please check your internet connection and try again.';
        } else if (error.message.includes('validation')) {
          errorMsg = 'Please check that all required fields are filled correctly.';
        } else if (error.message.includes('conflict') || error.message.includes('unavailable')) {
          errorMsg = 'The selected date/time may not be available. Please choose a different time or contact the office.';
        } else if (error.message) {
          errorMsg = error.message;
        }
        
        errorText.textContent = errorMsg;
        errorMessage?.classList.remove('hidden');
        errorMessage?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } finally {
        loadingDiv?.classList.add('hidden');
      }
    });
  }
}

function calculateTotalFee() {
  let total = 0;
  
  // Base wedding fee
  if (currentState.isMember === 'Yes') {
    total += fees.member;
  } else if (currentState.isMember === 'No') {
    total += fees.nonMember;
  }
  
  // Audio support fee
  if (currentState.hasAudioSupport) {
    total += fees.audioSupport;
  }
  
  return total;
}

function updateFeeDisplay() {
  const feeNote = byId('feeNote');
  const feeAmount = byId('feeAmount');
  
  if (!feeNote || !feeAmount) return;
  
  if (!currentState.isMember) {
    feeNote.textContent = 'Please select membership status to see your fee';
    feeAmount.textContent = '';
    return;
  }
  
  const total = calculateTotalFee();
  const isMember = currentState.isMember === 'Yes';
  
  let noteText = `Wedding fee: $${isMember ? fees.member : fees.nonMember}`;
  if (currentState.hasAudioSupport) {
    noteText += ` + Audio support: $${fees.audioSupport}`;
  }
  
  feeNote.textContent = noteText;
  feeAmount.textContent = `Total: $${total.toFixed(2)}`;
  feeAmount.style.fontWeight = 'bold';
  feeAmount.style.fontSize = '1.1em';
  feeAmount.style.color = '#00457c';
}