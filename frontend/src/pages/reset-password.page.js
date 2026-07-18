import { verifyRecoverySession, updatePassword, logout } from '../core/auth.js';

const loadingBlock = document.getElementById('loading-block');
const invalidBlock = document.getElementById('invalid-block');
const form          = document.getElementById('reset-form');
const btnSubmit     = document.getElementById('btn-submit');
const errorEl       = document.getElementById('reset-error');
const successEl     = document.getElementById('reset-success');

function setLoading(v) {
  btnSubmit.classList.toggle('btn--loading', v);
  btnSubmit.disabled = v;
}

function showError(msg) {
  successEl.classList.remove('visible');
  errorEl.textContent = msg;
  errorEl.classList.add('visible');
}

(async () => {
  const ok = await verifyRecoverySession();
  loadingBlock.style.display = 'none';

  if (!ok) {
    invalidBlock.style.display = 'block';
    return;
  }
  form.style.display = 'flex';
})();

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const password        = document.getElementById('password').value;
  const passwordConfirm = document.getElementById('password-confirm').value;

  if (password.length < 8) {
    showError('Le mot de passe doit contenir au moins 8 caractères.');
    return;
  }
  if (password !== passwordConfirm) {
    showError('Les deux mots de passe ne correspondent pas.');
    return;
  }

  setLoading(true);
  try {
    await updatePassword(password);
    form.style.display = 'none';
    successEl.textContent = 'Mot de passe mis à jour. Redirection vers la connexion…';
    successEl.classList.add('visible');
    setTimeout(() => { logout(); }, 1800);
  } catch (err) {
    showError(err?.message ?? 'Erreur lors de la mise à jour du mot de passe.');
    setLoading(false);
  }
});
