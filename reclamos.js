import { request } from './membership.js';
const form = document.getElementById('claim-form');
const result = document.getElementById('claim-result');
form?.addEventListener('submit', async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  data.privacyAccepted = form.elements.privacyAccepted.checked;
  const button = form.querySelector('button');
  button.disabled = true;
  try {
    const response = await request('/api/claims', data);
    form.classList.add('hidden');
    result.classList.remove('hidden');
    result.textContent = `Solicitud registrada. Tu código de constancia es ${response.claimCode}. Guárdalo para tu seguimiento.`;
  } catch (cause) {
    result.classList.remove('hidden');
    result.className = 'notice';
    result.textContent = cause.message;
    button.disabled = false;
  }
});
