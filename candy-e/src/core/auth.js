/**
 * [ candy-e ] — SERVICE D'AUTHENTIFICATION (DÉMO STATIQUE)
 *
 * ⚠️ Version DÉMO : pas de backend, pas de JWT. La « session » est un simple
 * marqueur en sessionStorage (`demo_auth`), et le mot de passe est vérifié
 * en clair côté client (mot de passe unique de démonstration). Aucune
 * donnée sensible n'est en jeu : il s'agit d'une vitrine publique en lecture
 * seule avec données 100% fictives.
 */

import { setUser, setProfile } from './state.js';
import { profiles } from '../mock-data.js';

const SESSION_KEY   = 'demo_auth';
const DEMO_PASSWORD = 'candy-demo';

const demoProfile = profiles.find(p => p.id === 'demo-cadre');

function isAuthenticated() {
  return sessionStorage.getItem(SESSION_KEY) === 'true';
}

// ─── Initialisation ───────────────────────────────────────────────────────────

export async function initAuth() {
  if (!isAuthenticated()) return;
  setUser({ id: 'demo-cadre' });
  setProfile(demoProfile);
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Connexion démo : un seul mot de passe (`candy-demo`), pas d'e-mail.
 * @param {string} password
 * @returns {Promise<boolean>}
 */
export async function login(password) {
  if (password !== DEMO_PASSWORD) {
    throw new Error('Mot de passe incorrect.');
  }
  sessionStorage.setItem(SESSION_KEY, 'true');
  setUser({ id: 'demo-cadre' });
  setProfile(demoProfile);
  return true;
}

export async function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  window.location.replace('login.html?fresh=1');
}

// ─── Guards de route ──────────────────────────────────────────────────────────

/**
 * Vérifie qu'une session démo est active.
 * Si absente → redirige vers login?fresh=1 (démarrage propre garanti).
 */
export async function requireAuth() {
  if (!isAuthenticated()) {
    window.location.replace('login.html?fresh=1');
    return false;
  }
  return true;
}

/**
 * Sur la page login : redirige si déjà « connecté ».
 * ?fresh=1 → efface systématiquement la session (démarrage propre).
 */
export async function redirectIfAuthenticated() {
  if (new URLSearchParams(window.location.search).get('fresh') === '1') {
    sessionStorage.removeItem(SESSION_KEY);
    window.history.replaceState({}, '', window.location.pathname);
    return;
  }
  if (isAuthenticated()) {
    window.location.replace('index.html');
  }
}
