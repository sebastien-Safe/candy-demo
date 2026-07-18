/**
 * [ candy-e ] — CLIENT API CENTRALISÉ
 * Fichier : core/api.js
 *
 * Point d'accès unique aux données : toutes les requêtes passent par
 * /api/* (backend Express, cf. server.js). Le JWT est posé par le serveur
 * dans un cookie httpOnly (POST /api/auth/login) — inaccessible en JS,
 * donc jamais manipulé ici ; le navigateur le joint automatiquement à
 * chaque requête same-origin (`credentials: 'same-origin'`).
 */

const BASE_URL = '/api';

async function requete(method, chemin, corps) {
  const headers = { 'Content-Type': 'application/json' };

  const reponse = await fetch(`${BASE_URL}${chemin}`, {
    method,
    headers,
    credentials: 'same-origin',
    body: corps !== undefined ? JSON.stringify(corps) : undefined,
  });

  // 401 = session absente/expirée : déconnexion propre.
  if (reponse.status === 401) {
    window.location.replace('login.html?fresh=1');
    throw new Error('Session expirée');
  }

  if (reponse.status === 204) return null;

  let data = null;
  try {
    data = await reponse.json();
  } catch {
    // pas de corps JSON (ex. erreur réseau bas niveau) — data reste null
  }

  if (!reponse.ok) {
    // 403 (rôle non autorisé) et autres erreurs remontent à l'appelant,
    // qui décide de l'affichage (pas de redirection automatique ici).
    const erreur = new Error(data?.error || `Erreur ${reponse.status}`);
    erreur.status = reponse.status;
    throw erreur;
  }

  return data;
}

// Téléchargement d'un fichier binaire (PDF...) — distinct de requete() qui
// suppose toujours une réponse JSON. Le cookie de session ne suffit pas à
// un simple lien <a href> pour gérer le 401 proprement : on récupère un
// Blob puis on déclenche le téléchargement via une ancre temporaire.
async function telecharger(chemin, nomFichier) {
  const reponse = await fetch(`${BASE_URL}${chemin}`, { credentials: 'same-origin' });
  if (reponse.status === 401) {
    window.location.replace('login.html?fresh=1');
    throw new Error('Session expirée');
  }
  if (!reponse.ok) {
    let message = `Erreur ${reponse.status}`;
    try { message = (await reponse.json())?.error || message; } catch { /* corps non JSON */ }
    throw new Error(message);
  }

  const blob = await reponse.blob();
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  get: (chemin) => requete('GET', chemin),
  post: (chemin, corps) => requete('POST', chemin, corps),
  patch: (chemin, corps) => requete('PATCH', chemin, corps),
  delete: (chemin) => requete('DELETE', chemin),
  telecharger,
};
