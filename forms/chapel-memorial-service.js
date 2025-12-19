// Chapel Memorial Service Form JavaScript
const API_URL = 'https://unified-system-api.vercel.app/api/chapel/submit-service';

// State management
const state = {
    hasMemorialGarden: false,
    hasMusic: false,
    hasAdditionalChairs: false,
    hasRopedSeating: false
};

// Initialize form when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('chapelMemorialForm');
    const submitBtn = document.getElementById('submitBtn');
    const statusMessage = document.getElementById('statusMessage');
    
    // Initialize all toggle handlers
    initializeMemorialGardenToggle();
    initializeMusicToggle();
    initializeChairToggle();
    initializeRopedSeatingToggle();
    
    // Handle form submission
    if (form) {
        form.addEventListener('submit', handleFormSubmission);
    }
});

// Memorial Garden placement toggle
function initializeMemorialGardenToggle() {
    const memorialRadios = document.querySelectorAll('input[name="memorialGarden"]');
    const placementDetails = document.getElementById('placementDetails');

    memorialRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            state.hasMemorialGarden = this.value === 'yes';
            if (state.hasMemorialGarden) {
                placementDetails?.classList.remove('hidden');
            } else {
                placementDetails?.classList.add('hidden');
                // Clear placement fields when hidden
                const placementDate = document.getElementById('placementDate');
                const placementTime = document.getElementById('placementTime');
                if (placementDate) placementDate.value = '';
                if (placementTime) placementTime.value = '';
            }
        });
    });
}

// Music requirements toggle
function initializeMusicToggle() {
    const hasMusicCheckbox = document.getElementById('hasMusic');
    const musicDetails = document.getElementById('musicDetails');
    
    if (hasMusicCheckbox) {
        hasMusicCheckbox.addEventListener('change', function() {
            state.hasMusic = this.checked;
            if (state.hasMusic) {
                musicDetails?.classList.remove('hidden');
            } else {
                musicDetails?.classList.add('hidden');
                // Clear music fields when hidden
                clearMusicFields();
            }
        });
    }
}

// Additional chairs toggle
function initializeChairToggle() {
    const additionalChairsCheckbox = document.getElementById('needsChairs');
    const chairDetails = document.getElementById('chairDetails');
    
    if (additionalChairsCheckbox) {
        additionalChairsCheckbox.addEventListener('change', function() {
            state.hasAdditionalChairs = this.checked;
            if (state.hasAdditionalChairs) {
                chairDetails?.classList.remove('hidden');
            } else {
                chairDetails?.classList.add('hidden');
                // Clear chair fields when hidden
                const chairCount = document.getElementById('chairCount');
                const chairPlacement = document.getElementById('chairPlacement');
                if (chairCount) chairCount.value = '';
                if (chairPlacement) chairPlacement.value = '';
            }
        });
    }
}

// Roped seating toggle
function initializeRopedSeatingToggle() {
    const ropedSeatingCheckbox = document.getElementById('ropedSeating');
    const ropedDetails = document.getElementById('ropedDetails');
    
    if (ropedSeatingCheckbox) {
        ropedSeatingCheckbox.addEventListener('change', function() {
            state.hasRopedSeating = this.checked;
            if (state.hasRopedSeating) {
                ropedDetails?.classList.remove('hidden');
            } else {
                ropedDetails?.classList.add('hidden');
                // Clear roped seating fields when hidden
                const rowsLeft = document.getElementById('rowsLeft');
                const rowsRight = document.getElementById('rowsRight');
                if (rowsLeft) rowsLeft.value = '';
                if (rowsRight) rowsRight.value = '';
            }
        });
    }
}

// Clear music-related fields
function clearMusicFields() {
    const musicCheckboxes = ['needsPiano', 'needsOrgan', 'performSanctuary', 'performBalcony'];
    musicCheckboxes.forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) checkbox.checked = false;
    });
    
    const organistName = document.getElementById('organistName');
    const organistPhone = document.getElementById('organistPhone');
    const organistEmail = document.getElementById('organistEmail');
    const soloistName = document.getElementById('soloistName');
    const otherMusicians = document.getElementById('otherMusicians');
    
    if (organistName) organistName.value = '';
    if (organistPhone) organistPhone.value = '';
    if (organistEmail) organistEmail.value = '';
    if (soloistName) soloistName.value = '';
    if (otherMusicians) otherMusicians.value = '';
    
    // Also clear chair fields if music is unchecked
    const needsChairs = document.getElementById('needsChairs');
    if (needsChairs) {
        needsChairs.checked = false;
        needsChairs.dispatchEvent(new Event('change'));
    }
}

// Handle form submission
async function handleFormSubmission(e) {
    e.preventDefault();
    
    const form = e.target;
    const submitBtn = document.getElementById('submitBtn');
    const statusMessage = document.getElementById('statusMessage');
    const loadingDiv = document.getElementById('loading');
    const errorMessage = document.getElementById('errorMessage');
    
    // Show loading state
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
    }
    if (loadingDiv) {
        loadingDiv.classList.remove('hidden');
    }
    if (statusMessage) {
        statusMessage.className = 'hidden';
    }
    if (errorMessage) {
        errorMessage.classList.add('hidden');
    }
    
    try {
        // Collect form data
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // Handle checkboxes properly
        const checkboxes = [
            'hasMusic', 'needsPiano', 'needsOrgan', 'performSanctuary', 'performBalcony',
            'needsChairs', 'standMic', 'wirelessMic', 'cdPlayer', 'communion',
            'guestBook', 'ropedSeating', 'policyAgreement', 'feeAgreement'
        ];

        checkboxes.forEach(name => {
            const element = document.getElementById(name) || document.querySelector(`[name="${name}"]`);
            data[name] = element ? (element.checked ? 'on' : '') : '';
        });

        // Handle member relationship field mapping
        const memberRelationship = document.getElementById('memberRelationship');
        if (memberRelationship) {
            data.memberRelationship = memberRelationship.value;
        }

        // Convert numbers
        if (data.chairCount) data.chairCount = parseInt(data.chairCount) || 0;
        if (data.rowsLeft) data.rowsLeft = parseInt(data.rowsLeft) || 0;
        if (data.rowsRight) data.rowsRight = parseInt(data.rowsRight) || 0;

        // Prepare payload in the format expected by the API
        const payload = {
            formType: 'memorial-funeral-service',
            data: data
        };

        console.log('Submitting payload:', payload);

        // Submit to API
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            // Show success page
            showSuccessPage(result);
        } else {
            throw new Error(result.message || result.error || 'Submission failed');
        }
        
    } catch (error) {
        console.error('Submission error:', error);
        
        // Show error message
        if (errorMessage) {
            const errorText = document.getElementById('errorText');
            if (errorText) {
                errorText.textContent = error.message || 'An error occurred while submitting your application. Please try again.';
            }
            errorMessage.classList.remove('hidden');
        } else if (statusMessage) {
            statusMessage.className = 'error';
            statusMessage.innerHTML = `
                <h3>❌ Submission Failed</h3>
                <p>${error.message}</p>
                <p>Please check your information and try again. If the problem persists, please contact the Chapel office.</p>
            `;
            statusMessage.classList.remove('hidden');
        }
        
        // Scroll to error message
        if (errorMessage) {
            errorMessage.scrollIntoView({ behavior: 'smooth' });
        } else if (statusMessage) {
            statusMessage.scrollIntoView({ behavior: 'smooth' });
        }
        
    } finally {
        // Reset button state
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Memorial Service Application';
        }
        if (loadingDiv) {
            loadingDiv.classList.add('hidden');
        }
    }
}

// Show success page
function showSuccessPage(result) {
    const applicationForm = document.getElementById('applicationForm');
    const thankYouPage = document.getElementById('thankYouPage');
    
    if (applicationForm && thankYouPage) {
        // Hide form
        applicationForm.classList.add('hidden');
        
        // Populate confirmation details
        const confirmationId = document.getElementById('confirmationId');
        const confirmationDate = document.getElementById('confirmationDate');
        const confirmationFee = document.getElementById('confirmationFee');
        
        if (confirmationId) {
            confirmationId.textContent = `#${result.applicationId}`;
        }
        if (confirmationDate) {
            confirmationDate.textContent = new Date(result.submissionDate).toLocaleDateString();
        }
        if (confirmationFee) {
            // Memorial services are free for members, $325 for non-members
            confirmationFee.textContent = '$25 (Audio Support Fee)';
        }
        
        // Add next steps
        const thankYouDynamic = document.getElementById('thankYouDynamic');
        if (thankYouDynamic && result.nextSteps) {
            thankYouDynamic.innerHTML = `
                <h3>Next Steps</h3>
                <ul style="text-align: left; margin: 20px auto; max-width: 600px;">
                    ${result.nextSteps.map(step => `<li>${step}</li>`).join('')}
                </ul>
                <p style="margin-top: 20px;">
                    You will receive a confirmation email at the address provided.
                </p>
            `;
        }
        
        // Show thank you page
        thankYouPage.classList.remove('hidden');
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
    } else {
        // Fallback to status message
        const statusMessage = document.getElementById('statusMessage');
        if (statusMessage) {
            statusMessage.className = 'success';
            statusMessage.innerHTML = `
                <h3>✅ Application Submitted Successfully!</h3>
                <p><strong>Application ID:</strong> ${result.applicationId}</p>
                <p><strong>Submission Date:</strong> ${new Date(result.submissionDate).toLocaleDateString()}</p>
                <div style="margin-top: 15px;">
                    <h4>Next Steps:</h4>
                    <ul style="margin-left: 20px;">
                        ${result.nextSteps.map(step => `<li>${step}</li>`).join('')}
                    </ul>
                </div>
            `;
            statusMessage.classList.remove('hidden');
            statusMessage.scrollIntoView({ behavior: 'smooth' });
            
            // Hide the form
            const form = document.getElementById('chapelMemorialForm');
            if (form) {
                form.style.display = 'none';
            }
        }
    }
}