/**
 * [ candy-e ] — SERVICE D'AUTHENTIFICATION
 *
 * Authentification via backend JWT (routes/auth.js) : le JWT est posé par
 * le serveur dans un cookie httpOnly après /api/auth/login (cf.
 * core/api.js) — inaccessible en JS, donc la présence d'une session valide
 * se vérifie uniquement via GET /api/auth/me.
 */

import { api }                 from './api.js';
import { setUser, setProfile } from './state.js';

// ─── Initialisation ───────────────────────────────────────────────────────────

export async function initAuth() {
  try {
    const profil = await api.get('/auth/me');
    setUser({ id: profil.id });
    setProfile(profil);

    if (!profil.actif) {
      console.warn('[candy-e] Compte désactivé — déconnexion.');
      await logout();
    }
  } catch {
    // Token invalide/expiré : core/api.js redirige déjà vers login sur 401.
  }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function login(email, password) {
  const { user } = await api.post('/auth/login', { email, password });

  const profil = await api.get('/auth/me');
  if (!profil?.actif) {
    await logout();
    throw new Error('Compte désactivé');
  }

  setUser(user);
  setProfile(profil);
  return user;
}

/**
 * Envoie l'email de réinitialisation de mot de passe.
 * ⚠️ Aucun service d'envoi d'email n'est encore branché côté serveur — le
 * lien est journalisé côté backend en attendant un choix de fournisseur
 * SMTP. Le mécanisme (token, expiration, vérification) est fonctionnel
 * dès aujourd'hui.
 */
export async function requestPasswordReset(email) {
  await api.post('/auth/forgot-password', { email });
}

/**
 * À appeler sur reset-password.html au chargement. Le lien envoyé par le
 * backend porte le token en paramètre de requête (`?token=...`, pas en
 * fragment d'URL comme avec le service d'authentification d'origine).
 * @returns {Promise<boolean>} true si un token de récupération est présent
 */
let _resetToken = null;

export async function verifyRecoverySession() {
  const token = new URLSearchParams(window.location.search).get('token');
  window.history.replaceState({}, '', window.location.pathname);

  if (!token) return false;
  _resetToken = token;
  return true;
}

/**
 * Définit un nouveau mot de passe (nécessite verifyRecoverySession() au
 * préalable dans la même page).
 */
export async function updatePassword(newPassword) {
  if (!_resetToken) throw new Error('Session de réinitialisation invalide');
  await api.post('/auth/reset-password', { token: _resetToken, newPassword });
  _resetToken = null;
}

export async function logout() {
  try {
    await api.post('/auth/logout');
  } catch {
    // best-effort : la déconnexion locale doit se faire même si l'appel échoue
  }
  setUser(null);
  setProfile(null);
  window.location.replace('login.html?fresh=1');
}

// ─── Guards de route ──────────────────────────────────────────────────────────

/**
 * Vérifie qu'un token valide existe.
 * Si absent/invalide → redirige vers login?fresh=1 (déconnexion propre
 * garantie, pas de boucle).
 */
export async function requireAuth() {
  try {
    await api.get('/auth/me');
    return true;
  } catch {
    // core/api.js redirige déjà sur 401 ; on couvre les autres cas (réseau, etc.)
    window.location.replace('login.html?fresh=1');
    return false;
  }
}

/**
 * Sur la page login : redirige si déjà connecté.
 * ?fresh=1 → déconnecte toujours (démarrage propre), y compris le cookie
 * serveur (best-effort : un token déjà invalide/expiré ne doit pas bloquer
 * l'affichage de la page de login).
 */
export async function redirectIfAuthenticated() {
  if (new URLSearchParams(window.location.search).get('fresh') === '1') {
    window.history.replaceState({}, '', window.location.pathname);
    try {
      await api.post('/auth/logout');
    } catch {
      // best-effort
    }
    return;
  }
  try {
    await api.get('/auth/me');
    window.location.replace('index.html');
  } catch {
    // pas de session valide : rester sur la page de login
  }
}
