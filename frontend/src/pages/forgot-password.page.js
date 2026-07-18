import { requestPasswordReset } from '../core/auth.js';

const form      = document.getElementById('forgot-form');
const btnSubmit = document.getElementById('btn-submit');
const errorEl   = document.getElementById('forgot-error');
const successEl = document.getElementById('forgot-success');

function setLoading(v) {
  btnSubmit.classList.toggle('btn--loading', v);
  btnSubmit.disabled = v;
}

function showError(msg) {
  successEl.classList.remove('visible');
  errorEl.textContent = msg;
  errorEl.classList.add('visible');
}

function showSuccess(msg) {
  errorEl.classList.remove('visible');
  successEl.textContent = msg;
  successEl.classList.add('visible');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  if (!email) {
    showError('Veuillez renseigner votre adresse e-mail.');
    return;
  }

  setLoading(true);
  try {
    await requestPasswordReset(email);
  } catch (err) {
    // On ne révèle jamais si l'email existe ou non côté message.
    console.error('[candy-e] Erreur reset password :', err?.message);
  } finally {
    setLoading(false);
    form.querySelector('#email').disabled = true;
    btnSubmit.disabled = true;
    showSuccess('Si un compte existe avec cet e-mail, un lien de réinitialisation vient d\'être envoyé. Pensez à vérifier vos spams.');
  }
});
