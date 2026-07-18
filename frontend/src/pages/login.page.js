import { login, redirectIfAuthenticated } from '../core/auth.js';

// Redirige automatiquement si déjà connecté
await redirectIfAuthenticated();

const form    = document.getElementById('login-form');
const btnLogin = document.getElementById('btn-login');
const errorEl  = document.getElementById('login-error');

function setLoading(v) {
  btnLogin.classList.toggle('btn--loading', v);
  btnLogin.disabled = v;
}

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.add('visible');
}

function clearError() {
  errorEl.classList.remove('visible');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();

  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!email || !password) {
    showError('Veuillez renseigner votre e-mail et votre mot de passe.');
    return;
  }

  setLoading(true);
  try {
    await login(email, password);
    window.location.href = 'index.html';
  } catch (err) {
    const msg = err?.status === 401
      ? 'Identifiants incorrects. Veuillez réessayer.'
      : err?.message ?? 'Erreur de connexion. Contactez l\'administrateur.';
    showError(msg);
  } finally {
    setLoading(false);
  }
});
