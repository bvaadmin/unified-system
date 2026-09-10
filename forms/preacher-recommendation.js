const API_URL = 'https://unified-system.vercel.app/api/preachers/submit-recommendation';

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('preacherRecommendationForm').addEventListener('submit', handleSubmit);
});

async function handleSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = document.getElementById('submitBtn');
  const loading = document.getElementById('loading');
  const errorMessage = document.getElementById('errorMessage');
  const errorText = document.getElementById('errorText');

  errorMessage.classList.add('hidden');

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';
  loading.classList.remove('hidden');

  try {
    const data = Object.fromEntries(new FormData(form).entries());
    delete data.formType;

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formType: 'preacher-recommendation', data })
    });
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || result.error || 'Submission failed');
    }
    showThankYou(result, data);
  } catch (error) {
    console.error('Submission error:', error);
    errorText.textContent = error.message || 'An error occurred while submitting your recommendation. Please try again.';
    errorMessage.classList.remove('hidden');
    errorMessage.scrollIntoView({ behavior: 'smooth' });
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Recommendation';
    loading.classList.add('hidden');
  }
}

function showThankYou(result, data) {
  document.getElementById('applicationForm').classList.add('hidden');
  document.getElementById('confirmationId').textContent = result.submissionId;
  document.getElementById('confirmationDate').textContent = new Date(result.submissionDate).toLocaleDateString();
  document.getElementById('confirmationPreacher').textContent = data.preacherName;

  const dynamic = document.getElementById('thankYouDynamic');
  dynamic.textContent = '';
  const heading = document.createElement('h3');
  heading.textContent = 'What happens next';
  const list = document.createElement('ul');
  list.style.cssText = 'text-align: left; margin: 20px auto; max-width: 600px;';
  for (const step of result.nextSteps || []) {
    const li = document.createElement('li');
    li.textContent = step;
    list.appendChild(li);
  }
  const note = document.createElement('p');
  note.style.marginTop = '20px';
  note.textContent = result.emailSent?.confirmation
    ? 'A confirmation email has been sent to the address you provided.'
    : 'Please keep your confirmation ID for your records.';
  dynamic.append(heading, list, note);

  document.getElementById('thankYouPage').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
